import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDefaultsIfNeeded, makeDefaultsCacheKey, type DefaultsCacheState } from "../defaultsCache";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";

const DEFAULTS_A: AreaDefaults = { priceMedian: 3000, areaMedian: 65, builtYearMedian: 2010, sampleSize: 20 };
const DEFAULTS_B: AreaDefaults = { priceMedian: 5000, areaMedian: 100, builtYearMedian: 2005, sampleSize: 15 };

function makeState(): DefaultsCacheState {
  return { cache: new Map(), lastKey: null, fetching: false };
}

describe("makeDefaultsCacheKey", () => {
  it("キーに lat(4桁) + lng(4桁) + propertyType が含まれる", () => {
    expect(makeDefaultsCacheKey(35.6812, 139.7671, "mansion")).toBe("35.6812,139.7671,mansion");
    expect(makeDefaultsCacheKey(35.6812, 139.7671, "house")).toBe("35.6812,139.7671,house");
  });
});

describe("fetchDefaultsIfNeeded", () => {
  const lat = 35.6812;
  const lng = 139.7671;

  it("初回呼び出し: fetchFn が 1 回呼ばれ applyDefaults が呼ばれる", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue(DEFAULTS_A);

    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(applyDefaults).toHaveBeenCalledWith(DEFAULTS_A);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("同じキーで 2 回目: キャッシュヒットで fetchFn が呼ばれない、applyDefaults は呼ばれる", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue(DEFAULTS_A);

    // 1st call
    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });
    // 2nd call — same key
    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();       // only once
    expect(applyDefaults).toHaveBeenCalledTimes(2); // both calls trigger applyDefaults
    expect(applyDefaults).toHaveBeenLastCalledWith(DEFAULTS_A);
  });

  it("propertyType 変更: 別キーなので新規フェッチ・別のキャッシュエントリが作られる", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(DEFAULTS_A)
      .mockResolvedValueOnce(DEFAULTS_B);

    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });
    await fetchDefaultsIfNeeded(lat, lng, "house",   state, { applyDefaults, setLoading, setError, fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(state.cache.size).toBe(2);
    expect(applyDefaults).toHaveBeenNthCalledWith(1, DEFAULTS_A);
    expect(applyDefaults).toHaveBeenNthCalledWith(2, DEFAULTS_B);
  });

  it("同じキーで進行中に 2 回目: スキップされる", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    let resolveFirst!: (v: AreaDefaults) => void;
    const pending = new Promise<AreaDefaults>((res) => { resolveFirst = res; });
    const fetchFn = vi.fn().mockReturnValueOnce(pending);

    // Start first call but don't await yet
    const p1 = fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });
    // Synchronously state.fetching should be true now (set before the await)
    // Second call with same key while fetching
    const p2 = fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });

    resolveFirst(DEFAULTS_A);
    await p1;
    await p2;

    expect(fetchFn).toHaveBeenCalledOnce(); // second was skipped
  });

  it("進行中のリクエスト完了後、同じキーで再呼び出し: キャッシュヒット", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue(DEFAULTS_A);

    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });
    expect(state.fetching).toBe(false); // completed

    // re-call after completion
    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce(); // still only once
    expect(applyDefaults).toHaveBeenCalledTimes(2);
  });

  it("fetchFn がエラーを投げた場合: setError が呼ばれ setLoading(false) になる", async () => {
    const state = makeState();
    const applyDefaults = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network failure"));

    await fetchDefaultsIfNeeded(lat, lng, "mansion", state, { applyDefaults, setLoading, setError, fetchFn });

    expect(applyDefaults).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith("Network failure");
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(state.fetching).toBe(false);
  });
});
