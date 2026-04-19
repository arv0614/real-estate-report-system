import { describe, it, expect } from "vitest";
import { calcTopReasons } from "../topReasons";

const goodSeismic  = { prob30: 0.05, probPct: 5,  riskLevel: "very_low" as const, riskLabel: "非常に低い" };
const badSeismic   = { prob30: 0.55, probPct: 55, riskLevel: "very_high" as const, riskLabel: "非常に高い" };
const neutSeismic  = { prob30: 0.20, probPct: 20, riskLevel: "moderate" as const,  riskLabel: "中程度" };

const goodPopulation = {
  cityCode: "13101", cityName: "東京都千代田区",
  history: [{ year: 2015, population: 50000 }, { year: 2020, population: 52000 }],
  trend: 0.015, proj5: 54000, proj10: 56000, source: "e-Stat",
};
const badPopulation = {
  cityCode: "99999", cityName: "過疎市",
  history: [{ year: 2015, population: 50000 }, { year: 2020, population: 47000 }],
  trend: -0.04, proj5: 44000, proj10: 41000, source: "e-Stat",
};
const neutPopulation = {
  cityCode: "13101", cityName: "東京都千代田区",
  history: [{ year: 2015, population: 50000 }, { year: 2020, population: 50200 }],
  trend: 0.0005, proj5: 50400, proj10: 50600, source: "e-Stat",
};

const PRICES_5 = [3000, 3100, 2900, 3050, 2980]; // median ≈ 3000

describe("calcTopReasons", () => {
  it("全 👍: 3 件選出（最大 3）", () => {
    const reasons = calcTopReasons(
      2700,          // 10% below median 3000
      PRICES_5,
      goodSeismic,
      goodPopulation
    );
    expect(reasons.length).toBe(3);
    expect(reasons.every((r) => r.sentiment === "good")).toBe(true);
    const categories = reasons.map((r) => r.category);
    expect(categories).toContain("market");
    expect(categories).toContain("disaster");
    expect(categories).toContain("future");
  });

  it("👍 2 + 👎 1: 👎 が必ず含まれ計 3 件", () => {
    const reasons = calcTopReasons(
      2700,          // 10% below median → good market
      PRICES_5,
      goodSeismic,   // good disaster
      badPopulation  // bad future
    );
    expect(reasons.length).toBe(3);
    const goods = reasons.filter((r) => r.sentiment === "good");
    const bads  = reasons.filter((r) => r.sentiment === "bad");
    expect(bads.length).toBeGreaterThanOrEqual(1);
    expect(goods.length).toBeGreaterThanOrEqual(1);
  });

  it("👎 のみ 1 件: bad だけ返る", () => {
    const reasons = calcTopReasons(
      3500,          // above median → bad market
      PRICES_5,
      neutSeismic,
      neutPopulation
    );
    expect(reasons.length).toBe(1);
    expect(reasons[0].sentiment).toBe("bad");
    expect(reasons[0].category).toBe("market");
  });

  it("全中立: 空配列を返す", () => {
    const reasons = calcTopReasons(
      3000,          // at median → neutral
      PRICES_5,
      neutSeismic,
      neutPopulation
    );
    expect(reasons).toHaveLength(0);
  });

  it("similarPrices < 5: 市場カテゴリは評価されない", () => {
    const reasons = calcTopReasons(
      100,           // would be very cheap but insufficient data
      [3000, 3100],  // < 5 → no market reason
      badSeismic,
      null
    );
    expect(reasons.some((r) => r.category === "market")).toBe(false);
    expect(reasons.some((r) => r.category === "disaster")).toBe(true);
  });
});
