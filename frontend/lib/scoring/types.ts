export type ScoreGrade = "A+" | "A" | "B+" | "B" | "C" | "D";

export interface Evidence {
  label: string;
  value: string;
  sourceUrl?: string;
}

export type SubScore =
  | { status: "ok"; value: number; weight: number; evidence: Evidence[] }
  | { status: "insufficient"; reason: string; weight: number };

export type TotalGrade =
  | { status: "ok"; grade: ScoreGrade; score: number; note?: string }
  | { status: "insufficient"; reason: string };

export interface PropertyScore {
  total: TotalGrade;
  market: SubScore;
  disaster: SubScore;
  future: SubScore;
  dataCount: number;
}
