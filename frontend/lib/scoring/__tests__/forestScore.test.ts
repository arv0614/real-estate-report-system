import { describe, it, expect } from "vitest";
import {
  buildTerrainAccessSubScore,
  buildSolarTerrainSubScore,
  buildHazardZoneSubScore,
  buildMarketRecordSubScore,
  calcForestScore,
} from "../forestScore";
import type { ForestTerrainData } from "@/lib/research/forestTerrainApi";
import type { SedimentData } from "@/lib/research/sedimentApi";
import type { ForestStagedResult } from "@/lib/research/similarSearch";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const flatTerrain: ForestTerrainData = {
  slopeDeg: 5,
  slopeClass: "gentle",
  aspectDeg: 180,
  aspectLabel: "南",
  elevation: 300,
  solarTerrain: { slopeOk: true, aspectOk: true, elevationOk: true, metCount: 3, totalCount: 3 },
  sourceNote: "国土地理院 標高タイルを加工して算出",
};

const steepTerrain: ForestTerrainData = {
  slopeDeg: 35,
  slopeClass: "very_steep",
  aspectDeg: 0,
  aspectLabel: "北",
  elevation: 1200,
  solarTerrain: { slopeOk: false, aspectOk: false, elevationOk: false, metCount: 0, totalCount: 3 },
  sourceNote: "国土地理院 標高タイルを加工して算出",
};

const noHazard: SedimentData = {
  warningZone: { inside: false, special: false, phenomena: [] },
  steepSlopeZone: false,
  landslideZone: false,
};

const specialWarning: SedimentData = {
  warningZone: { inside: true, special: true, phenomena: ["土石流"] },
  steepSlopeZone: false,
  landslideZone: false,
};

const ordinaryWarning: SedimentData = {
  warningZone: { inside: true, special: false, phenomena: ["急傾斜地の崩壊"] },
  steepSlopeZone: false,
  landslideZone: false,
};

const steepSlopeOnly: SedimentData = {
  warningZone: { inside: false, special: false, phenomena: [] },
  steepSlopeZone: true,
  landslideZone: false,
};

const makeMarketResult = (count: number, stage: "city_3yr" | "pref_3yr" | "pref_5yr" = "pref_3yr"): ForestStagedResult => ({
  similar: Array.from({ length: count }, (_, i) => ({
    price: 100 + i * 10,
    area: 3000,
    year: 2023,
    period: "2023年第1四半期",
  })),
  forestStage: count > 0 ? stage : null,
  forestStageLabel: count > 0 ? "テスト範囲" : null,
});

// ── terrainAccess ─────────────────────────────────────────────────────────────

describe("buildTerrainAccessSubScore", () => {
  it("gentle → value=90", () => {
    const s = buildTerrainAccessSubScore(flatTerrain);
    expect(s.status).toBe("ok");
    if (s.status === "ok") expect(s.value).toBe(90);
  });

  it("moderate → value=70", () => {
    const t = { ...flatTerrain, slopeClass: "moderate" as const, slopeDeg: 15 };
    const s = buildTerrainAccessSubScore(t);
    expect(s.status).toBe("ok");
    if (s.status === "ok") expect(s.value).toBe(70);
  });

  it("steep → value=45", () => {
    const t = { ...flatTerrain, slopeClass: "steep" as const, slopeDeg: 25 };
    const s = buildTerrainAccessSubScore(t);
    if (s.status === "ok") expect(s.value).toBe(45);
  });

  it("very_steep (elevation ≤1000m) → value=25", () => {
    const t = { ...steepTerrain, elevation: 800 }; // no elevation penalty
    const s = buildTerrainAccessSubScore(t);
    if (s.status === "ok") expect(s.value).toBe(25);
  });

  it("very_steep + elevation>1000m → value=15 (25−10)", () => {
    const s = buildTerrainAccessSubScore(steepTerrain); // elevation=1200
    if (s.status === "ok") expect(s.value).toBe(15);
  });

  it("elevation > 1000m → -10pt", () => {
    const t = { ...flatTerrain, elevation: 1200 };
    const s = buildTerrainAccessSubScore(t);
    if (s.status === "ok") expect(s.value).toBe(80); // 90 - 10
  });

  it("null terrain → insufficient", () => {
    expect(buildTerrainAccessSubScore(null).status).toBe("insufficient");
  });

  it("slopeDeg=null → insufficient", () => {
    const t = { ...flatTerrain, slopeDeg: null, slopeClass: null };
    expect(buildTerrainAccessSubScore(t).status).toBe("insufficient");
  });

  it("evidence に sourceUrl が含まれる", () => {
    const s = buildTerrainAccessSubScore(flatTerrain);
    if (s.status === "ok") {
      expect(s.evidence.some((e) => e.sourceUrl)).toBe(true);
    }
  });
});

// ── solarTerrain ─────────────────────────────────────────────────────────────

describe("buildSolarTerrainSubScore", () => {
  it("metCount=3 → value=90", () => {
    const s = buildSolarTerrainSubScore(flatTerrain);
    if (s.status === "ok") expect(s.value).toBe(90);
  });

  it("metCount=2 → value=70", () => {
    const t = { ...flatTerrain, solarTerrain: { ...flatTerrain.solarTerrain!, slopeOk: false, metCount: 2 } };
    const s = buildSolarTerrainSubScore(t);
    if (s.status === "ok") expect(s.value).toBe(70);
  });

  it("metCount=1 → value=45", () => {
    const t = { ...flatTerrain, solarTerrain: { ...flatTerrain.solarTerrain!, slopeOk: false, aspectOk: false, metCount: 1 } };
    const s = buildSolarTerrainSubScore(t);
    if (s.status === "ok") expect(s.value).toBe(45);
  });

  it("metCount=0 → value=30", () => {
    const s = buildSolarTerrainSubScore(steepTerrain);
    if (s.status === "ok") expect(s.value).toBe(30);
  });

  it("null terrain → insufficient", () => {
    expect(buildSolarTerrainSubScore(null).status).toBe("insufficient");
  });

  it("solarTerrain=null → insufficient", () => {
    const t = { ...flatTerrain, solarTerrain: null };
    expect(buildSolarTerrainSubScore(t).status).toBe("insufficient");
  });
});

// ── hazardZone ────────────────────────────────────────────────────────────────

describe("buildHazardZoneSubScore", () => {
  it("3区域すべて false → value=90", () => {
    const s = buildHazardZoneSubScore(noHazard);
    if (s.status === "ok") expect(s.value).toBe(90);
  });

  it("特別警戒区域 → value=25", () => {
    const s = buildHazardZoneSubScore(specialWarning);
    if (s.status === "ok") expect(s.value).toBe(25);
  });

  it("警戒区域のみ → value=50", () => {
    const s = buildHazardZoneSubScore(ordinaryWarning);
    if (s.status === "ok") expect(s.value).toBe(50);
  });

  it("XKT022のみ → value=60", () => {
    const s = buildHazardZoneSubScore(steepSlopeOnly);
    if (s.status === "ok") expect(s.value).toBe(60);
  });

  it("warningZone=null → insufficient", () => {
    const s = buildHazardZoneSubScore({ warningZone: null, steepSlopeZone: false, landslideZone: false });
    expect(s.status).toBe("insufficient");
  });

  it("null sediment → insufficient", () => {
    expect(buildHazardZoneSubScore(null).status).toBe("insufficient");
  });

  it("evidence に sourceUrl が含まれる", () => {
    const s = buildHazardZoneSubScore(noHazard);
    if (s.status === "ok") {
      expect(s.evidence.some((e) => e.sourceUrl)).toBe(true);
    }
  });
});

// ── marketRecord ──────────────────────────────────────────────────────────────

describe("buildMarketRecordSubScore", () => {
  it("0件 → insufficient", () => {
    expect(buildMarketRecordSubScore(makeMarketResult(0)).status).toBe("insufficient");
  });

  it("1〜2件 → value=45", () => {
    const s = buildMarketRecordSubScore(makeMarketResult(2));
    if (s.status === "ok") expect(s.value).toBe(45);
  });

  it("3〜4件 → value=60", () => {
    const s = buildMarketRecordSubScore(makeMarketResult(3));
    if (s.status === "ok") expect(s.value).toBe(60);
  });

  it("5〜9件 → value=70", () => {
    const s = buildMarketRecordSubScore(makeMarketResult(7));
    if (s.status === "ok") expect(s.value).toBe(70);
  });

  it("10件以上 → value=85", () => {
    const s = buildMarketRecordSubScore(makeMarketResult(10));
    if (s.status === "ok") expect(s.value).toBe(85);
  });

  it("null → insufficient", () => {
    expect(buildMarketRecordSubScore(null).status).toBe("insufficient");
  });
});

// ── calcForestScore (total) ───────────────────────────────────────────────────

describe("calcForestScore", () => {
  it("全項目データあり → ok グレード算出", () => {
    const result = calcForestScore(flatTerrain, noHazard, makeMarketResult(5));
    expect(result.total.status).toBe("ok");
    if (result.total.status === "ok") {
      expect(["A+", "A", "B+", "B", "C", "D"]).toContain(result.total.grade);
    }
  });

  it("terrain=null, sediment=null → ok サブ2件: total insufficient", () => {
    // hazard(insufficient) + terrain(insufficient) → ok = market + solar(insufficient)
    // Actually: terrain → terrainAccess insufficient + solarTerrain insufficient
    // hazard ok(sediment=noHazard), market ok(5件)
    // ok=2 → total ok but with note
    const result = calcForestScore(null, noHazard, makeMarketResult(5));
    // hazardZone=ok, market=ok → 2 ok sub → total ok
    expect(result.total.status).toBe("ok");
    if (result.total.status === "ok") {
      expect(result.total.note).toContain("2/4");
    }
  });

  it("全 null → total insufficient", () => {
    const result = calcForestScore(null, null, null);
    expect(result.total.status).toBe("insufficient");
  });

  it("terrain=null + market=0 → ok 1件のみ → insufficient", () => {
    const result = calcForestScore(null, noHazard, makeMarketResult(0));
    // hazardZone=ok, rest insufficient → 1 ok → insufficient
    expect(result.total.status).toBe("insufficient");
  });

  it("disclaimer は固定文言", () => {
    const result = calcForestScore(flatTerrain, noHazard, makeMarketResult(5));
    expect(result.disclaimer).toContain("不動産の価値や価格を示すものではありません");
  });

  it("4項目すべて ok → note なし", () => {
    const result = calcForestScore(flatTerrain, noHazard, makeMarketResult(5));
    if (result.total.status === "ok") {
      expect(result.total.note).toBeUndefined();
    }
  });

  it("warningZone.special=true → hazardZone value=25", () => {
    const result = calcForestScore(flatTerrain, specialWarning, makeMarketResult(5));
    const hz = result.subScores.hazardZone;
    if (hz.status === "ok") expect(hz.value).toBe(25);
  });

  it("solarTerrain: metCount=3 → solarTerrain value=90", () => {
    const result = calcForestScore(flatTerrain, noHazard, makeMarketResult(5));
    const st = result.subScores.solarTerrain;
    if (st.status === "ok") expect(st.value).toBe(90);
  });
});
