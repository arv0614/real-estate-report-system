import type { HazardInfo } from "@/types/api";
import type { PropertyMode } from "@/types/research";

export type ScoreGrade = "A+" | "A" | "B" | "C" | "D";

export interface PropertyScore {
  overall: number;      // 0–100
  grade: ScoreGrade;
  market: number;       // 0–100 相場スコア
  disaster: number;     // 0–100 災害スコア
  future: number;       // 0–100 将来性スコア（暫定値）
  marketNote: string;   // e.g. "相場より15%安い"
  dataCount: number;    // 類似取引数
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function calcPropertyScore(
  inputPrice: number,         // 万円
  similarPrices: number[],    // 万円
  hazard: HazardInfo | null,
  mode: PropertyMode
): PropertyScore {
  // ── 相場スコア ────────────────────────────────────────
  let market = 60;
  let marketNote = "比較データなし";

  if (similarPrices.length >= 3) {
    const med = median(similarPrices);
    const diff = med > 0 ? (inputPrice - med) / med : 0;
    const pct = Math.round(Math.abs(diff) * 100);

    if (diff <= -0.20)      { market = 95; marketNote = `相場より${pct}%安い`; }
    else if (diff <= -0.10) { market = 85; marketNote = `相場より${pct}%安い`; }
    else if (diff <= 0)     { market = 73; marketNote = pct === 0 ? "相場と同程度" : `相場より${pct}%安い`; }
    else if (diff <= 0.10)  { market = 58; marketNote = `相場より${pct}%高い`; }
    else if (diff <= 0.20)  { market = 43; marketNote = `相場より${pct}%高い`; }
    else                    { market = 25; marketNote = `相場より${pct}%高い`; }
  }

  // ── 災害スコア ────────────────────────────────────────
  let disaster = 75;
  if (hazard) {
    const floodRank = hazard.flood.maxDepthRank ?? 0;
    const hasLandslide = hazard.landslide.hasRisk;
    if (floodRank >= 4 || hasLandslide)  disaster = 28;
    else if (floodRank >= 3)              disaster = 48;
    else if (floodRank >= 1)              disaster = 63;
    else                                  disaster = 90;
  }

  // ── 将来性スコア（暫定 — 駅・用途地域データ連携後に精緻化） ───
  const future = 65;

  // ── 総合スコア（モード別重み付け） ────────────────────
  const overall =
    mode === "investment"
      ? Math.round(market * 0.50 + disaster * 0.20 + future * 0.30)
      : Math.round(market * 0.35 + disaster * 0.45 + future * 0.20);

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
