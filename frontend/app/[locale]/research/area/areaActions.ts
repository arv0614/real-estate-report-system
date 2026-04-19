"use server";

import { fetchSeismicData, fetchTerrainData } from "@/lib/research/seismicApi";
import { fetchPopulationTrend } from "@/lib/research/populationApi";
import type { SeismicData, TerrainData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";
import type { HazardInfo, TransactionRecord } from "@/types/api";

export interface AreaSummaryResult {
  ok: true;
  coords: { lat: number; lng: number };
  hazard: HazardInfo | null;
  seismic: SeismicData | null;
  terrain: TerrainData | null;
  population: PopulationData | null;
  cityCode: string | null;
  cityName: string | null;
  allPrices: number[];          // 万円, all transactions in tile
  totalFetched: number;
}

export type AreaResult = AreaSummaryResult | { ok: false; error: string };

export async function analyzeArea(lat: number, lng: number): Promise<AreaResult> {
  if (!isFinite(lat) || !isFinite(lng)) {
    return { ok: false, error: "座標が無効です" };
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  const [mlitResult, seismicResult, terrainResult] = await Promise.allSettled([
    apiBase
      ? fetch(
          `${apiBase}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=14&locale=ja`,
          { cache: "no-store", signal: AbortSignal.timeout(20000) }
        ).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null),
    fetchSeismicData(lat, lng),
    fetchTerrainData(lat, lng),
  ]);

  let hazard: HazardInfo | null = null;
  let cityCode: string | null = null;
  let allPrices: number[] = [];
  let totalFetched = 0;

  if (mlitResult.status === "fulfilled" && mlitResult.value) {
    const data = mlitResult.value;
    hazard = data.hazard ?? null;
    cityCode = data.data?.cityCode ?? null;
    const records: TransactionRecord[] = data.data?.data ?? [];
    totalFetched = records.length;
    allPrices = records
      .filter((r) => r.tradePrice > 0)
      .map((r) => Math.round(r.tradePrice / 10000));
  }

  const seismic = seismicResult.status === "fulfilled" ? seismicResult.value : null;
  const terrain = terrainResult.status === "fulfilled" ? terrainResult.value : null;

  const estatKey = process.env.ESTAT_API_KEY ?? "";
  const population =
    cityCode && estatKey ? await fetchPopulationTrend(cityCode, estatKey) : null;

  return {
    ok: true,
    coords: { lat, lng },
    hazard,
    seismic,
    terrain,
    population,
    cityCode,
    cityName: population?.cityName ?? null,
    allPrices,
    totalFetched,
  };
}
