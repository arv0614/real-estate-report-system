/**
 * Regression tests for mansion/house mode in stagedSimilarSearch.
 * These must stay green after any forest-mode changes.
 */
import { describe, it, expect } from "vitest";
import { stagedSimilarSearch } from "../similarSearch";
import type { TransactionRecord } from "@/types/api";

function makeRecord(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    type: "中古マンション等",
    tradePrice: 30_000_000,
    area: 65,
    buildingYear: 2010,
    districtName: "新宿区",
    municipalityCode: "13104",
    period: "2023年第1四半期",
    ...overrides,
  } as TransactionRecord;
}

const currentYear = 2025;

describe("mansion mode regression", () => {
  it("5件以上ヒット → strict range を返す", () => {
    const records = Array.from({ length: 6 }, () => makeRecord());
    const result = stagedSimilarSearch(records, 15, 65, currentYear, "新宿区", "13104", "mansion");
    expect(result.similar.length).toBeGreaterThanOrEqual(5);
    expect(result.searchRange).toBe("strict");
  });

  it("districtName 不一致 → city まで拡大して返す", () => {
    const records = Array.from({ length: 5 }, () => makeRecord({ districtName: "渋谷区" }));
    const result = stagedSimilarSearch(records, 15, 65, currentYear, "新宿区", "13104", "mansion");
    // district doesn't match → city stage skips district filter → city match
    // municipalityCode matches so city stage should hit
    expect(result.searchRange).toBe("city");
    expect(result.similar.length).toBeGreaterThanOrEqual(5);
  });

  it("buildingYear なしのレコードは mansion で除外される（ageOk=null → false）", () => {
    const records = Array.from({ length: 5 }, () =>
      makeRecord({ buildingYear: undefined })
    );
    const result = stagedSimilarSearch(records, 15, 65, currentYear, null, null, "mansion");
    expect(result.similar.length).toBe(0);
    expect(result.searchRange).toBeNull();
  });

  it("件数 0 → searchRange null", () => {
    const result = stagedSimilarSearch([], 15, 65, currentYear, null, null, "mansion");
    expect(result.similar.length).toBe(0);
    expect(result.searchRange).toBeNull();
  });

  it("価格 0 のレコードは除外される", () => {
    const records = Array.from({ length: 5 }, () => makeRecord({ tradePrice: 0 }));
    const result = stagedSimilarSearch(records, 15, 65, currentYear, null, null, "mansion");
    expect(result.similar.length).toBe(0);
  });

  it("house mode も正常動作", () => {
    const records = Array.from({ length: 5 }, () =>
      makeRecord({ type: "宅地(土地と建物)" })
    );
    const result = stagedSimilarSearch(records, 15, 65, currentYear, null, null, "house");
    expect(result.similar.length).toBeGreaterThanOrEqual(5);
    expect(result.searchRange).toBe("wide");
  });
});
