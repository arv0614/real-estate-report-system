import type { HazardInfo } from "@/types/api";
import type { SeismicData, TerrainData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";
import type { SearchRange } from "@/lib/research/similarSearch";

export type PropertyMode = "home" | "investment";

export interface PropertyInput {
  address: string;
  price?: number;     // 万円 — optional; auto-filled if omitted
  area?: number;      // ㎡  — optional; auto-filled if omitted
  builtYear?: number; // 建築年 — optional; auto-filled if omitted
  mode: PropertyMode;
  coordOverride?: { lat: number; lng: number };
  autoFilled?: {
    price?: boolean;
    area?: boolean;
    builtYear?: boolean;
  };
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
      searchRange: SearchRange | null;
      searchRangeLabel: string | null;
      hazard: HazardInfo | null;
      cityCode: string | null;
      seismic: SeismicData | null;
      terrain: TerrainData | null;
      population: PopulationData | null;
      totalFetched: number;
      autoFilledFields: string[]; // fields whose values were derived from area medians
    }
  | { ok: false; error: string };

export type { SeismicData, TerrainData, PopulationData, SearchRange };
