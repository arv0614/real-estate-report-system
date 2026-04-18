import { describe, it, expect } from "vitest";
import { calcPropertyScore } from "../index";
import type { PropertyScore } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockHazard = {
  flood: { maxDepthRank: 0, depthLabel: "区域外", hasRisk: false },
  landslide: { hasRisk: false, zones: [] },
  tsunami: { hasRisk: false },
};

const mockSeismic = {
  prob30: 0.1,
  probPct: 10,
  riskLevel: "moderate" as const,
  riskLabel: "中程度",
};

const mockTerrain = {
  elevation: 15,
  elevSource: "5m標高",
  terrainClass: "台地",
  terrainRisk: "low" as const,
  riskNote: "台地に位置。比較的安定した地形です。",
};

const mockPopulation = {
  cityCode: "13101",
  cityName: "東京都千代田区",
  history: [
    { year: 2015, population: 50000 },
    { year: 2020, population: 51000 },
  ],
  trend: 0.004,
  proj5: 52000,
  proj10: 53000,
  source: "e-Stat 住民基本台帳",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("calcPropertyScore", () => {
  it("全項目 ok → 総合グレード算出成功", () => {
    const prices = [3000, 3100, 2900, 3050, 2980]; // 5件
    const score: PropertyScore = calcPropertyScore(
      3000,
      prices,
      mockHazard,
      "home",
      mockSeismic,
      mockTerrain,
      mockPopulation
    );

    expect(score.total.status).toBe("ok");
    expect(score.market.status).toBe("ok");
    expect(score.disaster.status).toBe("ok");
    expect(score.future.status).toBe("ok");

    if (score.total.status === "ok") {
      expect(["A+", "A", "B+", "B", "C", "D"]).toContain(score.total.grade);
      expect(score.total.score).toBeGreaterThanOrEqual(0);
      expect(score.total.score).toBeLessThanOrEqual(100);
    }
  });

  it("1 項目のみ ok → 総合 insufficient", () => {
    // market: < 5件 → insufficient
    // future: population null → insufficient
    // disaster only: ok
    const score: PropertyScore = calcPropertyScore(
      3000,
      [3000, 3100], // 2件 → insufficient
      mockHazard,
      "home",
      mockSeismic,
      mockTerrain,
      null // population null → future insufficient
    );

    expect(score.market.status).toBe("insufficient");
    expect(score.disaster.status).toBe("ok");
    expect(score.future.status).toBe("insufficient");
    expect(score.total.status).toBe("insufficient");
  });

  it("相場のみ insufficient（件数 < 5）→ 総合 ok・注記「2/3 項目で算出」付き", () => {
    const score: PropertyScore = calcPropertyScore(
      3000,
      [3000, 3100, 2900], // 3件 → market insufficient (< 5)
      mockHazard,
      "home",
      mockSeismic,
      mockTerrain,
      mockPopulation
    );

    expect(score.market.status).toBe("insufficient");
    expect(score.disaster.status).toBe("ok");
    expect(score.future.status).toBe("ok");
    expect(score.total.status).toBe("ok");

    if (score.total.status === "ok") {
      expect(score.total.note).toBe("2/3 項目で算出");
    }
  });

  it("disaster: 全データ null → insufficient", () => {
    const prices = [3000, 3100, 2900, 3050, 2980]; // 5件
    const score = calcPropertyScore(
      3000,
      prices,
      null,  // hazard null
      "home",
      null,  // seismic null
      null,  // terrain null
      mockPopulation
    );

    expect(score.disaster.status).toBe("insufficient");
  });

  it("disaster: seismicのみ取得 → ok（正規化）", () => {
    const prices = [3000, 3100, 2900, 3050, 2980];
    const score = calcPropertyScore(
      3000,
      prices,
      null,      // hazard null
      "home",
      mockSeismic,
      null,      // terrain null
      mockPopulation
    );

    expect(score.disaster.status).toBe("ok");
    if (score.disaster.status === "ok") {
      expect(score.disaster.value).toBeGreaterThanOrEqual(0);
      expect(score.disaster.value).toBeLessThanOrEqual(100);
      expect(score.disaster.evidence.length).toBeGreaterThan(0);
    }
  });
});
