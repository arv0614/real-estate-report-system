import type { HazardInfo } from "@/types/api";
import type { PropertyMode, SeismicData, TerrainData, PopulationData } from "@/types/research";

export type ScoreGrade = "A+" | "A" | "B" | "C" | "D";

export interface PropertyScore {
  overall: number;
  grade: ScoreGrade;
  market: number;
  disaster: number;
  future: number;
  marketNote: string;
  disasterNote: string;
  futureNote: string;
  dataCount: number;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── S_market ────────────────────────────────────────────────────────────────
function calcMarketScore(inputPrice: number, similarPrices: number[]): {
  score: number;
  note: string;
} {
  if (similarPrices.length < 3) return { score: 60, note: "比較データなし" };

  const med = median(similarPrices);
  const diff = med > 0 ? (inputPrice - med) / med : 0;
  const pct = Math.round(Math.abs(diff) * 100);

  if (diff <= -0.20) return { score: 95, note: `相場より${pct}%安い` };
  if (diff <= -0.10) return { score: 85, note: `相場より${pct}%安い` };
  if (diff <= 0)     return { score: 73, note: pct === 0 ? "相場と同程度" : `相場より${pct}%安い` };
  if (diff <= 0.10)  return { score: 58, note: `相場より${pct}%高い` };
  if (diff <= 0.20)  return { score: 43, note: `相場より${pct}%高い` };
  return { score: 25, note: `相場より${pct}%高い` };
}

// ── S_hazard ─────────────────────────────────────────────────────────────────
/**
 * Composite disaster score integrating:
 *   1. MLIT flood / landslide hazard (existing)
 *   2. J-SHIS 30-year seismic probability (新規)
 *   3. GSI terrain classification / elevation (新規)
 */
export function calcDisasterScore(
  hazard: HazardInfo | null,
  seismic: SeismicData | null,
  terrain: TerrainData | null
): { score: number; note: string } {
  // ── Flood component (0-100, higher = safer) ──
  let floodScore = 80; // default: no data
  if (hazard) {
    const rank = hazard.flood.maxDepthRank ?? 0;
    const land = hazard.landslide.hasRisk;
    if (rank >= 4 || land) floodScore = 20;
    else if (rank >= 3)    floodScore = 40;
    else if (rank >= 1)    floodScore = 60;
    else                   floodScore = 90;
  }

  // ── Seismic component (0-100, higher = safer) ──
  let seismicScore = 70; // default: no data
  let seismicNote = "";
  if (seismic) {
    const p = seismic.prob30;
    if (p >= 0.70)      { seismicScore = 15; seismicNote = `地震確率${seismic.probPct}%（非常に高い）`; }
    else if (p >= 0.40) { seismicScore = 35; seismicNote = `地震確率${seismic.probPct}%（高い）`; }
    else if (p >= 0.20) { seismicScore = 55; seismicNote = `地震確率${seismic.probPct}%（中程度）`; }
    else if (p >= 0.06) { seismicScore = 75; seismicNote = `地震確率${seismic.probPct}%（低い）`; }
    else                { seismicScore = 90; seismicNote = `地震確率${seismic.probPct}%（非常に低い）`; }
  }

  // ── Terrain component (0-100, higher = safer) ──
  let terrainScore = 70;
  if (terrain) {
    if (terrain.terrainRisk === "high")     terrainScore = 25;
    else if (terrain.terrainRisk === "moderate") terrainScore = 60;
    else                                    terrainScore = 90;
  }

  // Weighted combination: flood 40% + seismic 40% + terrain 20%
  const score = clamp(Math.round(floodScore * 0.40 + seismicScore * 0.40 + terrainScore * 0.20));

  const parts: string[] = [];
  if (seismicNote) parts.push(seismicNote);
  if (terrain?.riskNote) parts.push(terrain.riskNote);
  const note = parts.length ? parts.join(" / ") : "ハザードデータに基づく総合評価";

  return { score, note };
}

// ── S_future ─────────────────────────────────────────────────────────────────
/**
 * Future score using population trend.
 * In investment mode, population decline strongly penalizes the score.
 */
export function calcFutureScore(
  population: PopulationData | null,
  mode: PropertyMode
): { score: number; note: string } {
  if (!population || population.history.length < 2) {
    return { score: 65, note: "将来性スコア（暫定）" };
  }

  const { trend } = population; // annual growth rate

  // Base score from trend
  let base: number;
  if (trend >= 0.02)       base = 90;  // +2%/yr: growing strongly
  else if (trend >= 0.005) base = 78;  // +0.5–2%: slight growth
  else if (trend >= -0.005) base = 65; // around flat
  else if (trend >= -0.01)  base = 50; // -0.5–1%: decline
  else if (trend >= -0.02)  base = 35; // -1–2%: significant decline
  else                      base = 18; // -2%+: rapid decline

  // Investment mode: stronger penalty for declining population (vacancy risk)
  const penalty = mode === "investment" && trend < -0.005
    ? Math.round(Math.abs(trend) * 800) // scale up penalty
    : 0;

  const score = clamp(base - penalty);

  const pctPerYear = (trend * 100).toFixed(2);
  const trendSign = trend >= 0 ? "+" : "";
  const note =
    `${trendSign}${pctPerYear}%/年` +
    (mode === "investment" && trend < -0.005 ? "（空室リスクあり）" : "");

  return { score, note };
}

// ── Main scorer ──────────────────────────────────────────────────────────────
export function calcPropertyScore(
  inputPrice: number,
  similarPrices: number[],
  hazard: HazardInfo | null,
  mode: PropertyMode,
  seismic: SeismicData | null = null,
  terrain: TerrainData | null = null,
  population: PopulationData | null = null
): PropertyScore {
  const { score: market, note: marketNote } = calcMarketScore(inputPrice, similarPrices);
  const { score: disaster, note: disasterNote } = calcDisasterScore(hazard, seismic, terrain);
  const { score: future, note: futureNote } = calcFutureScore(population, mode);

  const overall =
    mode === "investment"
      ? clamp(Math.round(market * 0.50 + disaster * 0.20 + future * 0.30))
      : clamp(Math.round(market * 0.35 + disaster * 0.45 + future * 0.20));

  const grade: ScoreGrade =
    overall >= 85 ? "A+" :
    overall >= 70 ? "A"  :
    overall >= 55 ? "B"  :
    overall >= 40 ? "C"  : "D";

  return {
    overall,
    grade,
    market,
    disaster,
    future,
    marketNote,
    disasterNote,
    futureNote,
    dataCount: similarPrices.length,
  };
}

export function gradeColor(grade: ScoreGrade): string {
  switch (grade) {
    case "A+": return "text-emerald-600";
    case "A":  return "text-green-600";
    case "B":  return "text-blue-600";
    case "C":  return "text-amber-600";
    case "D":  return "text-red-600";
  }
}

export function gradeBg(grade: ScoreGrade): string {
  switch (grade) {
    case "A+": return "bg-emerald-50 border-emerald-300";
    case "A":  return "bg-green-50 border-green-300";
    case "B":  return "bg-blue-50 border-blue-300";
    case "C":  return "bg-amber-50 border-amber-300";
    case "D":  return "bg-red-50 border-red-300";
  }
}
