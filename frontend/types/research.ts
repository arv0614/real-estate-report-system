import type { HazardInfo } from "@/types/api";

export type PropertyMode = "home" | "investment";

export interface PropertyInput {
  address: string;
  price: number;     // 万円
  area: number;      // ㎡
  builtYear: number; // 建築年 e.g. 2000
  mode: PropertyMode;
}

export interface SimilarTx {
  price: number;  // 万円
  area: number;   // ㎡
  year: number;   // 建築年
  period: string;
}

export type AnalyzeResult =
  | {
      ok: true;
      coords: { lat: number; lng: number };
      input: PropertyInput;
      similar: SimilarTx[];
      hazard: HazardInfo | null;
      totalFetched: number;
    }
  | { ok: false; error: string };
