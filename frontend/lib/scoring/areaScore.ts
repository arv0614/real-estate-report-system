import type { HazardInfo } from "@/types/api";
import type { PopulationData, SeismicData, TerrainData } from "@/types/research";
import type { SubScore, TotalGrade, ScoreGrade } from "./types";
import { buildDisasterSubScore, buildFutureSubScore, gradeBg, gradeColor } from "./index";

export type { SubScore, TotalGrade, ScoreGrade };
export { gradeBg, gradeColor };

export interface AreaScore {
  total: TotalGrade;
  disaster: SubScore;
  future: SubScore;
  marketActivity: SubScore;
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

function buildMarketActivitySubScore(txCount: number, weight: number): SubScore {
  if (txCount === 0) {
    return { status: "insufficient", reason: "取引データなし", weight };
  }
  let value: number;
  if (txCount >= 50)      value = 90;
  else if (txCount >= 20) value = 80;
  else if (txCount >= 10) value = 70;
  else if (txCount >= 5)  value = 60;
  else                    value = 40;

  return {
    status: "ok",
    value,
    weight,
    evidence: [
      {
        label: "取引件数（直近）",
        value: `${txCount}件`,
        sourceUrl: "https://www.land.mlit.go.jp/webland/",
      },
    ],
  };
}

export function calcAreaScore(
  hazard: HazardInfo | null,
  seismic: SeismicData | null,
  terrain: TerrainData | null,
  population: PopulationData | null,
  txCount: number
): AreaScore {
  const disaster       = buildDisasterSubScore(hazard, seismic, terrain, 50);
  const future         = buildFutureSubScore(population, "home", 30);
  const marketActivity = buildMarketActivitySubScore(txCount, 20);

  const all    = [disaster, future, marketActivity];
  const okSubs = all.filter((s): s is Extract<SubScore, { status: "ok" }> => s.status === "ok");

  let total: TotalGrade;
  if (okSubs.length < 2) {
    total = { status: "insufficient", reason: "算出に必要なデータが不足しています" };
  } else {
    const totalW = okSubs.reduce((s, c) => s + c.weight, 0);
    const score  = clamp(Math.round(okSubs.reduce((s, c) => s + c.value * c.weight, 0) / totalW));
    const grade  = scoreToGrade(score);
    const note   = okSubs.length < 3 ? `${okSubs.length}/3 項目で算出` : undefined;
    total = { status: "ok", grade, score, note };
  }

  return { total, disaster, future, marketActivity };
}
