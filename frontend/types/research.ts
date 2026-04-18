import type { HazardInfo } from "@/types/api";
import type { SeismicData, TerrainData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";

export type PropertyMode = "home" | "investment";

export interface PropertyInput {
  address: string;
  price: number;     // 万円
  area: number;      // ㎡
  builtYear: number; // 建築年 e.g. 2000
  mode: PropertyMode;
  coordOverride?: { lat: number; lng: number };
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
      coordOverrideUsed: boolean;
      originalCoords: { lat: number; lng: number } | null;
      input: PropertyInput;
      similar: SimilarTx[];
      hazard: HazardInfo | null;
      cityCode: string | null;
      seismic: SeismicData | null;
      terrain: TerrainData | null;
      population: PopulationData | null;
      totalFetched: number;
    }
  | { ok: false; error: string };

export type { SeismicData, TerrainData, PopulationData };
