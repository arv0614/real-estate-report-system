"use server";

import { geocodeAddress } from "@/lib/geocode";
import { fetchSeismicData, fetchTerrainData } from "@/lib/research/seismicApi";
import { fetchPopulationTrend } from "@/lib/research/populationApi";
import { PropertyInputSchema } from "@/lib/schemas/propertyInput";
import type { TransactionRecord } from "@/types/api";
import type { PropertyInput, AnalyzeResult, SimilarTx } from "@/types/research";

export async function analyzeProperty(input: PropertyInput): Promise<AnalyzeResult> {
  const currentYear = new Date().getFullYear();

  // ── Validate with zod ──────────────────────────────────────────────────────
  const parsed = PropertyInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return { ok: false, error: msg };
  }
  const valid = parsed.data;

  // ── Step 1: Resolve coordinates ────────────────────────────────────────────
  let coords: { lat: number; lng: number };

  if (valid.coordOverride) {
    // User dragged map marker — skip geocoding
    coords = valid.coordOverride;
  } else {
    const geocoded = await geocodeAddress(valid.address);
    if (!geocoded) {
      return {
        ok: false,
        error: "住所が見つかりませんでした。都道府県から始まる詳しい住所を入力してください。",
      };
    }
    coords = geocoded;
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  // ── Step 2: Parallel fetch (MLIT + J-SHIS + GSI) ──────────────────────────
  const [mlitResult, seismicResult, terrainResult] = await Promise.allSettled([
    apiBase
      ? fetch(
          `${apiBase}/api/property/transactions?lat=${coords.lat}&lng=${coords.lng}&zoom=14&locale=ja`,
          { cache: "no-store", signal: AbortSignal.timeout(20000) }
        ).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null),
    fetchSeismicData(coords.lat, coords.lng),
    fetchTerrainData(coords.lat, coords.lng),
  ]);

  // ── Process MLIT ───────────────────────────────────────────────────────────
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

    const inputAge = currentYear - valid.builtYear;
    similar = records
      .filter((r) => {
        if (!r.area || r.tradePrice <= 0) return false;
        const areaOk = Math.abs(r.area - valid.area) / valid.area <= 0.2;
        const rAge = r.buildingYear ? currentYear - r.buildingYear : null;
        const yearOk = rAge !== null && Math.abs(rAge - inputAge) <= 5;
        return areaOk && yearOk;
      })
      .map(
        (r): SimilarTx => ({
          price: Math.round(r.tradePrice / 10000),
          area: r.area!,
          year: r.buildingYear ?? valid.builtYear,
          period: r.period ?? "",
        })
      );
  }

  const seismic = seismicResult.status === "fulfilled" ? seismicResult.value : null;
  const terrain = terrainResult.status === "fulfilled" ? terrainResult.value : null;

  // ── Step 3: e-Stat (sequential — needs cityCode) ───────────────────────────
  const estatKey = process.env.ESTAT_API_KEY ?? "";
  const population =
    cityCode && estatKey ? await fetchPopulationTrend(cityCode, estatKey) : null;

  return {
    ok: true,
    coords,
    coordOverrideUsed: !!valid.coordOverride,
    originalCoords: valid.coordOverride ? null : coords,
    input: valid,
    similar,
    hazard,
    cityCode,
    seismic,
    terrain,
    population,
    totalFetched,
  };
}
