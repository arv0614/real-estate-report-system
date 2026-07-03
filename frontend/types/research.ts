import type { HazardInfo } from "@/types/api";
import type { SeismicData, TerrainData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";
import type { SearchRange, ForestStage, ForestStagedResult } from "@/lib/research/similarSearch";
import type { ForestTerrainData } from "@/lib/research/forestTerrainApi";
import type { SedimentData } from "@/lib/research/sedimentApi";
import type { ForestScoreResult } from "@/lib/scoring/forestScore";

export type PropertyMode = "home" | "investment";
export type PropertyType = "house" | "mansion" | "forest" | "farmland";

export interface PropertyInput {
  address: string;
  price?: number;     // 万円 — optional; auto-filled if omitted
  area?: number;      // ㎡  — optional; auto-filled if omitted
  builtYear?: number; // 建築年 — optional; auto-filled if omitted
  mode: PropertyMode;
  propertyType: PropertyType;
  coordOverride?: { lat: number; lng: number };
  autoFilled?: {
    price?: boolean;
    area?: boolean;
    builtYear?: boolean;
  };
  fallbackFilled?: {
    price?: boolean;
    area?: boolean;
    builtYear?: boolean;
  };
}

export interface SimilarTx {
  price: number;  // 万円
  area: number;   // ㎡
  year: number;   // 建築年 (mansion/house) or 取引年 (forest/farmland)
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
      autoFilledFields: string[];     // fields filled from local area medians
      fallbackFilledFields: string[]; // fields filled from national reference (area data unavailable)
      // forest-specific optional fields (undefined for mansion/house)
      forestTerrain?: ForestTerrainData | null;
      sediment?: SedimentData | null;
      hoanrin?: { status: "inside" | "outside" | "unknown"; refYear: string } | null;
      forestScore?: ForestScoreResult | null;
      forestStage?: ForestStage | null;
      forestStageLabel?: string | null;
    }
  | { ok: false; error: string };

export type { SeismicData, TerrainData, PopulationData, SearchRange, ForestStage, ForestStagedResult, ForestTerrainData, SedimentData, ForestScoreResult };
