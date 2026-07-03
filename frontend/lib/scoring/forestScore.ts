/**
 * 山林エリア指標サマリー — 公的データ集計グレード
 *
 * 免責(固定): 本グレードは公的データの地形・区域・取引記録の集計状況を
 * 段階表示したもので、不動産の価値や価格を示すものではありません
 */

import type { ScoreGrade, SubScore, TotalGrade, Evidence } from "./types";
import type { ForestTerrainData } from "@/lib/research/forestTerrainApi";
import type { SedimentData } from "@/lib/research/sedimentApi";
import type { ForestStagedResult } from "@/lib/research/similarSearch";

// ── Forest score result type ──────────────────────────────────────────────────

export interface ForestSubScores {
  terrainAccess: SubScore;  // weight: 30
  solarTerrain:  SubScore;  // weight: 25
  hazardZone:    SubScore;  // weight: 25
  marketRecord:  SubScore;  // weight: 20
}

export interface ForestScoreResult {
  total: TotalGrade;
  subScores: ForestSubScores;
  /** 固定免責文言 */
  disclaimer: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 85) return "A+";
  if (score >= 75) return "A";
  if (score >= 65) return "B+";
  if (score >= 55) return "B";
  if (score >= 45) return "C";
  return "D";
}

// ── Sub-scores ────────────────────────────────────────────────────────────────

const W_TERRAIN_ACCESS = 30;
const W_SOLAR_TERRAIN  = 25;
const W_HAZARD_ZONE    = 25;
const W_MARKET_RECORD  = 20;

export function buildTerrainAccessSubScore(
  terrain: ForestTerrainData | null | undefined
): SubScore {
  if (!terrain || terrain.slopeDeg === null || terrain.slopeClass === null) {
    return { status: "insufficient", reason: "標高タイルの取得に失敗しました", weight: W_TERRAIN_ACCESS };
  }

  const slopeValues: Record<string, number> = {
    gentle:    90,
    moderate:  70,
    steep:     45,
    very_steep: 25,
  };

  let value = slopeValues[terrain.slopeClass] ?? 50;
  if (terrain.elevation !== null && terrain.elevation > 1000) {
    value = clamp(value - 10);
  }

  const slopeLabel: Record<string, string> = {
    gentle:    "緩傾斜（10°未満）",
    moderate:  "中傾斜（10〜20°）",
    steep:     "急傾斜（20〜30°）",
    very_steep:"非常に急峻（30°以上）",
  };

  const evidence: Evidence[] = [
    {
      label: "傾斜角",
      value: `${terrain.slopeDeg}°（${slopeLabel[terrain.slopeClass]}）`,
      sourceUrl: "https://cyberjapandata.gsi.go.jp/",
    },
  ];
  if (terrain.elevation !== null) {
    evidence.push({ label: "標高", value: `${terrain.elevation}m` });
  }
  if (terrain.aspectLabel) {
    evidence.push({ label: "斜面方位", value: terrain.aspectLabel });
  }

  return { status: "ok", value: clamp(value), weight: W_TERRAIN_ACCESS, evidence };
}

export function buildSolarTerrainSubScore(
  terrain: ForestTerrainData | null | undefined
): SubScore {
  if (!terrain || !terrain.solarTerrain) {
    return { status: "insufficient", reason: "地形条件データを取得できませんでした", weight: W_SOLAR_TERRAIN };
  }

  const { metCount, totalCount, slopeOk, aspectOk, elevationOk } = terrain.solarTerrain;

  if (totalCount === 0) {
    return { status: "insufficient", reason: "太陽光地形条件を算出できませんでした", weight: W_SOLAR_TERRAIN };
  }

  const valueMap: Record<number, number> = { 3: 90, 2: 70, 1: 45, 0: 30 };
  const value = valueMap[metCount] ?? 30;

  const checkLabel = (v: boolean | null, okText: string, ngText: string) =>
    v === null ? "不明" : v ? okText : ngText;

  const evidence: Evidence[] = [
    {
      label: "太陽光利用に関する地形条件の集計",
      value: `${metCount}/${totalCount} 条件を充足`,
      sourceUrl: "https://cyberjapandata.gsi.go.jp/",
    },
    { label: "① 傾斜（≤15°）", value: checkLabel(slopeOk, "充足", "非充足") },
    { label: "② 方位（南/南東/南西）", value: checkLabel(aspectOk, "充足", "非充足") },
    { label: "③ 標高（≤800m）", value: checkLabel(elevationOk, "充足", "非充足") },
  ];

  return { status: "ok", value: clamp(value), weight: W_SOLAR_TERRAIN, evidence };
}

export function buildHazardZoneSubScore(
  sediment: SedimentData | null | undefined
): SubScore {
  if (!sediment) {
    return { status: "insufficient", reason: "土砂災害区域データを取得できませんでした", weight: W_HAZARD_ZONE };
  }

  // warningZone null → insufficient regardless of other results
  if (sediment.warningZone === null) {
    return { status: "insufficient", reason: "土砂災害警戒区域の取得に失敗しました", weight: W_HAZARD_ZONE };
  }

  const { warningZone, steepSlopeZone, landslideZone } = sediment;

  let value: number;
  if (!warningZone.inside && steepSlopeZone === false && landslideZone === false) {
    // All 3 zones: none
    value = 90;
  } else if (warningZone.inside && warningZone.special) {
    // 特別警戒区域 — most severe
    value = 25;
  } else if (warningZone.inside && !warningZone.special) {
    // 警戒区域のみ
    value = 50;
  } else if (!warningZone.inside && (steepSlopeZone === true || landslideZone === true)) {
    // XKT022/021 only
    value = 60;
  } else {
    value = 70; // partial data
  }

  const evidence: Evidence[] = [
    {
      label: "土砂災害警戒区域（XKT029）",
      value: warningZone.inside
        ? `該当する可能性あり（${warningZone.special ? "特別警戒区域含む" : "警戒区域"}${warningZone.phenomena.length ? "・" + warningZone.phenomena.join("・") : ""}）`
        : "該当なし",
      sourceUrl: "https://www.reinfolib.mlit.go.jp/",
    },
    {
      label: "急傾斜地崩壊危険区域（XKT022）",
      value: steepSlopeZone === null ? "取得失敗" : steepSlopeZone ? "該当する可能性あり" : "該当なし",
      sourceUrl: "https://www.reinfolib.mlit.go.jp/",
    },
    {
      label: "地すべり防止区域（XKT021）",
      value: landslideZone === null ? "取得失敗" : landslideZone ? "該当する可能性あり" : "該当なし",
      sourceUrl: "https://www.reinfolib.mlit.go.jp/",
    },
  ];

  return { status: "ok", value: clamp(value), weight: W_HAZARD_ZONE, evidence };
}

export function buildMarketRecordSubScore(
  forestResult: ForestStagedResult | null | undefined
): SubScore {
  const count = forestResult?.similar.length ?? 0;

  if (count === 0) {
    return {
      status: "insufficient",
      reason: "周辺エリアの林地取引記録なし",
      weight: W_MARKET_RECORD,
    };
  }

  let value: number;
  if (count >= 10) value = 85;
  else if (count >= 5)  value = 70;
  else if (count >= 3)  value = 60;
  else                  value = 45;

  const stageLabel = forestResult?.forestStageLabel ?? "";

  const evidence: Evidence[] = [
    {
      label: "林地取引記録件数",
      value: `${count}件`,
      sourceUrl: "https://www.reinfolib.mlit.go.jp/",
    },
  ];
  if (stageLabel) {
    evidence.push({ label: "検索範囲", value: stageLabel });
  }
  if (count >= 1) {
    const prices = forestResult!.similar.map((s) => s.price);
    const med = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
    evidence.push({ label: "取引価格中央値（集計値・参考）", value: `${med.toLocaleString()}万円` });
  }

  return { status: "ok", value: clamp(value), weight: W_MARKET_RECORD, evidence };
}

// ── Total grade ───────────────────────────────────────────────────────────────

function calcTotalGrade(subScores: ForestSubScores): TotalGrade {
  const all: SubScore[] = [
    subScores.terrainAccess,
    subScores.solarTerrain,
    subScores.hazardZone,
    subScores.marketRecord,
  ];
  const okSubs = all.filter(
    (s): s is Extract<SubScore, { status: "ok" }> => s.status === "ok"
  );

  if (okSubs.length < 2) {
    return { status: "insufficient", reason: "算出に必要なデータが不足しています" };
  }

  const totalW = okSubs.reduce((s, c) => s + c.weight, 0);
  const score = clamp(
    Math.round(okSubs.reduce((s, c) => s + c.value * c.weight, 0) / totalW)
  );
  const grade = scoreToGrade(score);
  const note = okSubs.length < 4 ? `${okSubs.length}/4 項目で算出` : undefined;

  return { status: "ok", grade, score, note };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DISCLAIMER =
  "本グレードは公的データの地形・区域・取引記録の集計状況を段階表示したもので、不動産の価値や価格を示すものではありません";

export function calcForestScore(
  terrain: ForestTerrainData | null | undefined,
  sediment: SedimentData | null | undefined,
  forestResult: ForestStagedResult | null | undefined
): ForestScoreResult {
  const subScores: ForestSubScores = {
    terrainAccess: buildTerrainAccessSubScore(terrain),
    solarTerrain:  buildSolarTerrainSubScore(terrain),
    hazardZone:    buildHazardZoneSubScore(sediment),
    marketRecord:  buildMarketRecordSubScore(forestResult),
  };

  return {
    total: calcTotalGrade(subScores),
    subScores,
    disclaimer: DISCLAIMER,
  };
}
