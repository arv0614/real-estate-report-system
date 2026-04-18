"use server";

import { geocodeAddress } from "@/lib/geocode";
import { fetchSeismicData, fetchTerrainData } from "@/lib/research/seismicApi";
import { fetchPopulationTrend } from "@/lib/research/populationApi";
import type { TransactionRecord } from "@/types/api";
import type { PropertyInput, AnalyzeResult, SimilarTx } from "@/types/research";

export async function analyzeProperty(input: PropertyInput): Promise<AnalyzeResult> {
  const currentYear = new Date().getFullYear();

  if (!input.address.trim())
    return { ok: false, error: "住所を入力してください" };
  if (!(input.price > 0))
    return { ok: false, error: "価格を入力してください" };
  if (!(input.area > 0))
    return { ok: false, error: "専有面積を入力してください" };
  if (!(input.builtYear >= 1950 && input.builtYear <= currentYear))
    return { ok: false, error: `築年を正しく入力してください（1950〜${currentYear}）` };

  // ── Step 1: Geocode (sequential — coords needed for everything) ──────────
  const coords = await geocodeAddress(input.address);
  if (!coords) {
    return {
      ok: false,
      error: "住所が見つかりませんでした。都道府県から始まる詳しい住所を入力してください。",
    };
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  // ── Step 2: Parallel fetch (MLIT transactions + J-SHIS + GSI) ───────────
  const [mlitResult, seismicResult, terrainResult] = await Promise.allSettled([
    // MLIT backend
    apiBase
      ? fetch(
          `${apiBase}/api/property/transactions?lat=${coords.lat}&lng=${coords.lng}&zoom=14&locale=ja`,
          { cache: "no-store", signal: AbortSignal.timeout(20000) }
        ).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null),
    // J-SHIS seismic
    fetchSeismicData(coords.lat, coords.lng),
    // GSI terrain + elevation
    fetchTerrainData(coords.lat, coords.lng),
  ]);

  // ── Process MLIT response ─────────────────────────────────────────────────
  let hazard = null;
  let similar: SimilarTx[] = [];
  let totalFetched = 0;
  let cityCode: string | null = null;

  if (mlitResult.status === "fulfilled" && mlitResult.value) {
    const data = mlitResult.value;
    hazard = data.hazard ?? null;
    cityCode = data.data?.cityCode ?? null;
    const records: TransactionRecord[] = data.data?.data ?? [];
    totalFetched = records.length;

    const inputAge = currentYear - input.builtYear;
    similar = records
      .filter((r) => {
        if (!r.area || r.tradePrice <= 0) return false;
        const areaOk = Math.abs(r.area - input.area) / input.area <= 0.2;
        const rAge = r.buildingYear ? currentYear - r.buildingYear : null;
        const yearOk = rAge !== null && Math.abs(rAge - inputAge) <= 5;
        return areaOk && yearOk;
      })
      .map(
        (r): SimilarTx => ({
          price: Math.round(r.tradePrice / 10000),
          area: r.area!,
          year: r.buildingYear ?? input.builtYear,
          period: r.period ?? "",
        })
      );
  }

  const seismic = seismicResult.status === "fulfilled" ? seismicResult.value : null;
  const terrain = terrainResult.status === "fulfilled" ? terrainResult.value : null;

  // ── Step 3: e-Stat population (needs cityCode from step 2) ───────────────
  const estatKey = process.env.ESTAT_API_KEY ?? "";
  const population =
    cityCode && estatKey ? await fetchPopulationTrend(cityCode, estatKey) : null;

  return {
    ok: true,
    coords,
    input,
    similar,
    hazard,
    cityCode,
    seismic,
    terrain,
    population,
    totalFetched,
  };
}
