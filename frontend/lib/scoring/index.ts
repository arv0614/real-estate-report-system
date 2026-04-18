import type { HazardInfo } from "@/types/api";
import type { PropertyMode, SeismicData, TerrainData, PopulationData } from "@/types/research";
import type { Evidence, PropertyScore, ScoreGrade, SubScore, TotalGrade } from "./types";

export type { Evidence, PropertyScore, ScoreGrade, SubScore, TotalGrade };

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 85) return "A+";
  if (score >= 75) return "A";
  if (score >= 65) return "B+";
  if (score >= 55) return "B";
  if (score >= 45) return "C";
  return "D";
}

// ── S_market ─────────────────────────────────────────────────────────────────

export function buildMarketSubScore(
  inputPrice: number,
  similarPrices: number[],
  weight: number
): SubScore {
  if (similarPrices.length < 5) {
    return {
      status: "insufficient",
      reason: "類似取引が5件未満のため算出不可",
      weight,
    };
  }

  const med = median(similarPrices);
  const diff = med > 0 ? (inputPrice - med) / med : 0;
  const pct = Math.round(Math.abs(diff) * 100);
  const sign = diff >= 0 ? "+" : "−";

  let value: number;
  if (diff <= -0.20)     value = 95;
  else if (diff <= -0.10) value = 85;
  else if (diff <= 0)    value = 73;
  else if (diff <= 0.10)  value = 58;
  else if (diff <= 0.20)  value = 43;
  else                    value = 25;

  const evidence: Evidence[] = [
    { label: "類似取引件数", value: `${similarPrices.length}件` },
    {
      label: "中央値",
      value: `${med.toLocaleString()}万円`,
      sourceUrl: "https://www.land.mlit.go.jp/webland/",
    },
    { label: "入力価格", value: `${inputPrice.toLocaleString()}万円` },
    { label: "乖離率", value: `${sign}${pct}%` },
  ];

  return { status: "ok", value, weight, evidence };
}

// ── S_disaster ────────────────────────────────────────────────────────────────

export function buildDisasterSubScore(
  hazard: HazardInfo | null,
  seismic: SeismicData | null,
  terrain: TerrainData | null,
  weight: number
): SubScore {
  if (!hazard && !seismic && !terrain) {
    return {
      status: "insufficient",
      reason: "ハザード・地震・地形データをいずれも取得できませんでした",
      weight,
    };
  }

  // Weighted combination; normalize by available sources
  const components: Array<{ score: number; w: number }> = [];
  const evidence: Evidence[] = [];

  // Flood / hazard component (base weight 40)
  if (hazard) {
    const rank = hazard.flood.maxDepthRank ?? 0;
    const land = hazard.landslide.hasRisk;
    let floodScore: number;
    if (rank >= 4 || land) floodScore = 20;
    else if (rank >= 3)    floodScore = 40;
    else if (rank >= 1)    floodScore = 60;
    else                   floodScore = 90;
    components.push({ score: floodScore, w: 40 });

    evidence.push({
      label: "洪水最大浸水深ランク",
      value: rank === 0 ? "区域外" : `ランク ${rank}`,
      sourceUrl: "https://www.land.mlit.go.jp/webland/",
    });
    if (land) {
      evidence.push({ label: "土砂災害リスク", value: "区域あり" });
    }
  }

  // Seismic component (base weight 40)
  if (seismic) {
    const p = seismic.prob30;
    let seismicScore: number;
    if (p >= 0.70)      seismicScore = 15;
    else if (p >= 0.40) seismicScore = 35;
    else if (p >= 0.20) seismicScore = 55;
    else if (p >= 0.06) seismicScore = 75;
    else                seismicScore = 90;
    components.push({ score: seismicScore, w: 40 });

    evidence.push({
      label: "30年地震確率（震度6弱以上）",
      value: `${seismic.probPct}%（${seismic.riskLabel}）`,
      sourceUrl: "https://www.j-shis.bosai.go.jp/",
    });
  }

  // Terrain component (base weight 20)
  if (terrain) {
    let terrainScore: number;
    if (terrain.terrainRisk === "high")     terrainScore = 25;
    else if (terrain.terrainRisk === "moderate") terrainScore = 60;
    else                                    terrainScore = 90;
    components.push({ score: terrainScore, w: 20 });

    if (terrain.terrainClass) {
      evidence.push({
        label: "地形分類",
        value: terrain.terrainClass,
        sourceUrl: "https://maps.gsi.go.jp/",
      });
    }
    if (terrain.elevation !== null) {
      evidence.push({ label: "標高", value: `${terrain.elevation}m` });
    }
  }

  const totalW = components.reduce((s, c) => s + c.w, 0);
  const value = clamp(
    Math.round(components.reduce((s, c) => s + c.score * c.w, 0) / totalW)
  );

  return { status: "ok", value, weight, evidence };
}

// ── S_future ─────────────────────────────────────────────────────────────────

export function buildFutureSubScore(
  population: PopulationData | null,
  mode: PropertyMode,
  weight: number
): SubScore {
  if (!population || population.history.length < 2) {
    return {
      status: "insufficient",
      reason: "人口統計データを取得できませんでした",
      weight,
    };
  }

  const { trend } = population;

  let base: number;
  if (trend >= 0.02)        base = 90;
  else if (trend >= 0.005)  base = 78;
  else if (trend >= -0.005) base = 65;
  else if (trend >= -0.01)  base = 50;
  else if (trend >= -0.02)  base = 35;
  else                      base = 18;

  const penalty =
    mode === "investment" && trend < -0.005
      ? Math.round(Math.abs(trend) * 800)
      : 0;

  const value = clamp(base - penalty);
  const pctPerYear = (trend * 100).toFixed(2);
  const sign = trend >= 0 ? "+" : "";

  const evidence: Evidence[] = [
    {
      label: "人口年平均変化率（CAGR）",
      value: `${sign}${pctPerYear}%/年`,
      sourceUrl: "https://www.e-stat.go.jp/",
    },
  ];
  if (population.proj5 !== null) {
    evidence.push({
      label: "5年後推計人口",
      value: `${population.proj5.toLocaleString()}人`,
    });
  }
  if (population.proj10 !== null) {
    evidence.push({
      label: "10年後推計人口",
      value: `${population.proj10.toLocaleString()}人`,
    });
  }
  evidence.push({ label: "出典", value: population.source });

  if (mode === "investment" && trend < -0.005) {
    evidence.push({
      label: "投資モード追加調整",
      value: `−${penalty}pt（人口減少による空室リスク反映）`,
    });
  }

  return { status: "ok", value, weight, evidence };
}

// ── Total grade ───────────────────────────────────────────────────────────────

function calcTotalGrade(
  market: SubScore,
  disaster: SubScore,
  future: SubScore
): TotalGrade {
  const all = [market, disaster, future];
  const okSubs = all.filter((s): s is Extract<SubScore, { status: "ok" }> => s.status === "ok");

  if (okSubs.length < 2) {
    return {
      status: "insufficient",
      reason: "算出に必要なデータが不足しています",
    };
  }

  const totalW = okSubs.reduce((s, c) => s + c.weight, 0);
  const score = clamp(
    Math.round(okSubs.reduce((s, c) => s + c.value * c.weight, 0) / totalW)
  );
  const grade = scoreToGrade(score);
  const note =
    okSubs.length < 3
      ? `${okSubs.length}/3 項目で算出`
      : undefined;

  return { status: "ok", grade, score, note };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function calcPropertyScore(
  inputPrice: number,
  similarPrices: number[],
  hazard: HazardInfo | null,
  mode: PropertyMode,
  seismic: SeismicData | null = null,
  terrain: TerrainData | null = null,
  population: PopulationData | null = null
): PropertyScore {
  const mktW = mode === "investment" ? 50 : 35;
  const disW = mode === "investment" ? 20 : 45;
  const futW = mode === "investment" ? 30 : 20;

  const market   = buildMarketSubScore(inputPrice, similarPrices, mktW);
  const disaster = buildDisasterSubScore(hazard, seismic, terrain, disW);
  const future   = buildFutureSubScore(population, mode, futW);
  const total    = calcTotalGrade(market, disaster, future);

  return { total, market, disaster, future, dataCount: similarPrices.length };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function gradeColor(grade: ScoreGrade): string {
  switch (grade) {
    case "A+": return "text-emerald-600";
    case "A":  return "text-green-600";
    case "B+": return "text-teal-600";
    case "B":  return "text-blue-600";
    case "C":  return "text-amber-600";
    case "D":  return "text-red-600";
  }
}

export function gradeBg(grade: ScoreGrade): string {
  switch (grade) {
    case "A+": return "bg-emerald-50 border-emerald-300";
    case "A":  return "bg-green-50 border-green-300";
    case "B+": return "bg-teal-50 border-teal-300";
    case "B":  return "bg-blue-50 border-blue-300";
    case "C":  return "bg-amber-50 border-amber-300";
    case "D":  return "bg-red-50 border-red-300";
  }
}
