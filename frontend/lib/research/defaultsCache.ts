import type { PropertyType } from "@/types/research";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";
import { perfLog } from "@/lib/debug/perfLog";

export function makeDefaultsCacheKey(lat: number, lng: number, pt: PropertyType): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)},${pt}`;
}

export interface DefaultsCacheState {
  cache: Map<string, AreaDefaults>;
  lastKey: string | null;
  fetching: boolean;
}

export interface DefaultsCacheCallbacks {
  applyDefaults: (defaults: AreaDefaults) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  fetchFn: (lat: number, lng: number, pt: PropertyType) => Promise<AreaDefaults>;
}

export async function fetchDefaultsIfNeeded(
  lat: number,
  lng: number,
  pt: PropertyType,
  state: DefaultsCacheState,
  callbacks: DefaultsCacheCallbacks
): Promise<void> {
  const key = makeDefaultsCacheKey(lat, lng, pt);

  // 1. キャッシュヒット最優先 — 同じキーでも再描画のためapplyを呼ぶ
  if (state.cache.has(key)) {
    perfLog("fetchAreaDefaults (cache hit)", 0, { key });
    callbacks.applyDefaults(state.cache.get(key)!);
    return;
  }

  // 2. 同じキーで進行中なら二重呼び出しをスキップ
  if (state.fetching && state.lastKey === key) {
    return;
  }

  state.lastKey = key;
  state.fetching = true;
  callbacks.setLoading(true);

  try {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const defaults = await callbacks.fetchFn(lat, lng, pt);
    perfLog("fetchAreaDefaults (network)", (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0, { key });

    state.cache.set(key, defaults);
    callbacks.applyDefaults(defaults);
    callbacks.setError(null);
  } catch (err) {
    callbacks.setError(err instanceof Error ? err.message : "自動補完の取得に失敗しました");
  } finally {
    state.fetching = false;
    callbacks.setLoading(false);
  }
}
