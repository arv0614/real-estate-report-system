import { describe, it, expect } from "vitest";
import { filterForestRecords, FOREST_STAGE_LABELS } from "../similarSearch";
import type { TransactionRecord } from "@/types/api";

function makeForestRecord(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    type: "林地",
    tradePrice: 1_000_000,
    area: 5000,
    buildingYear: null,     // forest records have no buildingYear
    districtName: "美山町",
    municipalityCode: "26407",
    period: "2023年第2四半期",
    priceCategory: "",
    region: "",
    prefecture: "京都府",
    municipality: "南丹市",
    pricePerUnit: null,
    floorPlan: null,
    unitPrice: null,
    landShape: null,
    frontage: null,
    roadBreadth: null,
    totalFloorArea: null,
    structure: null,
    use: "",
    purpose: null,
    direction: null,
    classification: null,
    cityPlanning: "",
    coverageRatio: null,
    floorAreaRatio: null,
    renovation: null,
    remarks: null,
    timeToNearestStation: null,
    ...overrides,
  } as TransactionRecord;
}

describe("filterForestRecords", () => {
  const currentYear = 2025;
  const minYear3 = currentYear - 3; // 2022

  it("buildingYear がない林地レコードが正常にヒットする", () => {
    const records = Array.from({ length: 4 }, () =>
      makeForestRecord({ buildingYear: null, period: "2023年第1四半期" })
    );
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result.length).toBe(4);
  });

  it("period が範囲外(minYear 前)のレコードは除外される", () => {
    const records = [
      makeForestRecord({ period: "2021年第1四半期" }), // 2021 < 2022 → excluded
      makeForestRecord({ period: "2022年第1四半期" }), // 2022 >= 2022 → included
      makeForestRecord({ period: "2023年第1四半期" }), // included
    ];
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result.length).toBe(2);
  });

  it("面積フィルタ: forest は areaTolerance=0.5 で判定", () => {
    const records = [
      makeForestRecord({ area: 5000, period: "2023年第1四半期" }),  // 入力5000 → 0% diff → OK
      makeForestRecord({ area: 7400, period: "2023年第1四半期" }),  // 48% diff → OK (< 50%)
      makeForestRecord({ area: 7600, period: "2023年第1四半期" }),  // 52% diff → NG (> 50%)
    ];
    const result = filterForestRecords(records, "forest", 5000, minYear3);
    expect(result.length).toBe(2);
  });

  it("面積 undefined 時は面積条件をスキップ", () => {
    const records = [
      makeForestRecord({ area: 100, period: "2023年第1四半期" }),
      makeForestRecord({ area: 1_000_000, period: "2023年第1四半期" }),
    ];
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result.length).toBe(2);
  });

  it("municipalityCode フィルタが効く", () => {
    const records = [
      makeForestRecord({ municipalityCode: "26407", period: "2023年第1四半期" }),
      makeForestRecord({ municipalityCode: "26408", period: "2023年第1四半期" }),
    ];
    const result = filterForestRecords(records, "forest", undefined, minYear3, "26407");
    expect(result.length).toBe(1);
    expect(result[0].price).toBeGreaterThan(0);
  });

  it("type が林地以外のレコードは除外される", () => {
    const records = [
      makeForestRecord({ type: "農地", period: "2023年第1四半期" }),
      makeForestRecord({ type: "林地", period: "2023年第1四半期" }),
    ];
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result.length).toBe(1);
  });

  it("tradePrice=0 のレコードは除外される", () => {
    const records = [
      makeForestRecord({ tradePrice: 0, period: "2023年第1四半期" }),
      makeForestRecord({ tradePrice: 500_000, period: "2023年第1四半期" }),
    ];
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result.length).toBe(1);
  });

  it("SimilarTx.year は period の年（取引年）", () => {
    const records = [makeForestRecord({ period: "2023年第3四半期" })];
    const result = filterForestRecords(records, "forest", undefined, minYear3);
    expect(result[0].year).toBe(2023);
  });

  it("farmland モードでは農地のみヒット", () => {
    const records = [
      makeForestRecord({ type: "農地", period: "2023年第1四半期" }),
      makeForestRecord({ type: "林地", period: "2023年第1四半期" }),
    ];
    const result = filterForestRecords(records, "farmland", undefined, minYear3);
    expect(result.length).toBe(1);
    expect(result[0].period).toBe("2023年第1四半期");
  });
});

describe("FOREST_STAGE_LABELS", () => {
  it("3ステージすべてラベルが定義されている", () => {
    expect(FOREST_STAGE_LABELS.city_3yr).toBeTruthy();
    expect(FOREST_STAGE_LABELS.pref_3yr).toBeTruthy();
    expect(FOREST_STAGE_LABELS.pref_5yr).toBeTruthy();
  });
});
