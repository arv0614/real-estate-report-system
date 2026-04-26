"use server";

import { fetchSeismicData, fetchTerrainData } from "@/lib/research/seismicApi";
import { fetchPopulationTrend, type PopulationFailReason } from "@/lib/research/populationApi";
import type { SeismicData, TerrainData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";
import type { HazardInfo, TransactionRecord } from "@/types/api";
import { perfLog } from "@/lib/debug/perfLog";

export interface AreaSummaryResult {
  ok: true;
  coords: { lat: number; lng: number };
  hazard: HazardInfo | null;
  seismic: SeismicData | null;
  terrain: TerrainData | null;
  population: PopulationData | null;
  populationFailReason: PopulationFailReason | "no_city_code" | null;
  cityCode: string | null;
  cityName: string | null;
  allPrices: number[];          // 万円, all transactions in tile (unfiltered)
  allTransactions: TransactionRecord[]; // raw records for client-side type filtering
  totalFetched: number;
}

export type AreaResult = AreaSummaryResult | { ok: false; error: string };

export async function analyzeArea(lat: number, lng: number): Promise<AreaResult> {
  const _t0 = Date.now();
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
  let allTransactions: TransactionRecord[] = [];
  let totalFetched = 0;

  if (mlitResult.status === "fulfilled" && mlitResult.value) {
    const data = mlitResult.value;
    hazard = data.hazard ?? null;
    cityCode = data.data?.cityCode ?? null;
    const records: TransactionRecord[] = data.data?.data ?? [];
    totalFetched = records.length;
    allTransactions = records;
    allPrices = records
      .filter((r) => r.tradePrice > 0)
      .map((r) => Math.round(r.tradePrice / 10000));
  }

  const seismic = seismicResult.status === "fulfilled" ? seismicResult.value : null;
  const terrain = terrainResult.status === "fulfilled" ? terrainResult.value : null;

  const estatKey = process.env.ESTAT_API_KEY ?? "";
  let population = null;
  let populationFailReason: AreaSummaryResult["populationFailReason"] = null;
  if (!cityCode) {
    populationFailReason = "no_city_code";
    console.error("[analyzeArea] cityCode is null — cannot fetch population data");
  } else if (!estatKey) {
    populationFailReason = "no_api_key";
    console.error("[analyzeArea] ESTAT_API_KEY is not configured");
  } else {
    const popResult = await fetchPopulationTrend(cityCode, estatKey);
    population = popResult.data;
    populationFailReason = popResult.failReason;
    if (!population) {
      console.error(`[analyzeArea] population fetch failed: ${popResult.failReason} (cityCode=${cityCode})`);
    }
  }

  perfLog("analyzeArea total", Date.now() - _t0, { lat, lng, totalFetched, cityCode, populationFailReason });
  return {
    ok: true,
    coords: { lat, lng },
    hazard,
    seismic,
    terrain,
    population,
    populationFailReason,
    cityCode,
    cityName: population?.cityName ?? null,
    allPrices,
    allTransactions,
    totalFetched,
  };
}
