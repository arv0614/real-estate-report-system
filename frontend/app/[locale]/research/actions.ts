"use server";

import { geocodeAddress } from "@/lib/geocode";
import { fetchSeismicData, fetchTerrainData } from "@/lib/research/seismicApi";
import { fetchPopulationTrend } from "@/lib/research/populationApi";
import { PropertyInputSchema } from "@/lib/schemas/propertyInput";
import { stagedSimilarSearch } from "@/lib/research/similarSearch";
import { fetchAreaDefaults } from "./areaDefaultsActions";
import type { TransactionRecord } from "@/types/api";
import type { PropertyInput, AnalyzeResult, SimilarTx, SearchRange } from "@/types/research";
import { perfLog } from "@/lib/debug/perfLog";

export async function analyzeProperty(input: PropertyInput): Promise<AnalyzeResult> {
  const _t0 = Date.now();
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
    coords = valid.coordOverride;
  } else if (valid.address) {
    const geocoded = await geocodeAddress(valid.address);
    if (!geocoded) {
      return {
        ok: false,
        error: "住所が見つかりませんでした。都道府県から始まる詳しい住所を入力してください。",
      };
    }
    coords = geocoded;
  } else {
    return { ok: false, error: "住所または座標を指定してください。" };
  }

  // ── Step 2: Resolve price / area / builtYear (server-side fallback) ────────
  const autoFilledFields: string[] = [];

  // Collect what the client already auto-filled (trust the flags)
  if (valid.autoFilled?.price)     autoFilledFields.push("price");
  if (valid.autoFilled?.area)      autoFilledFields.push("area");
  if (valid.autoFilled?.builtYear) autoFilledFields.push("builtYear");

  let price     = valid.price;
  let area      = valid.area;
  let builtYear = valid.builtYear;

  const propertyType = valid.propertyType ?? "mansion";

  // Server-side fallback for still-missing fields
  if (price === undefined || area === undefined || builtYear === undefined) {
    const defaults = await fetchAreaDefaults(coords.lat, coords.lng, propertyType);
    if (defaults.sampleSize >= 5) {
      if (price === undefined && defaults.priceMedian !== null) {
        price = defaults.priceMedian;
        if (!autoFilledFields.includes("price")) autoFilledFields.push("price");
      }
      if (area === undefined && defaults.areaMedian !== null) {
        area = defaults.areaMedian;
        if (!autoFilledFields.includes("area")) autoFilledFields.push("area");
      }
      if (builtYear === undefined && defaults.builtYearMedian !== null) {
        builtYear = defaults.builtYearMedian;
        if (!autoFilledFields.includes("builtYear")) autoFilledFields.push("builtYear");
      }
    }
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  // ── Step 3: Parallel fetch (MLIT + J-SHIS + GSI) ──────────────────────────
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
  let searchRange: SearchRange | null = null;
  let searchRangeLabel: string | null = null;

  if (mlitResult.status === "fulfilled" && mlitResult.value) {
    const data = mlitResult.value;
    hazard = data.hazard ?? null;
    cityCode = data.data?.cityCode ?? null;
    const records: TransactionRecord[] = data.data?.data ?? [];
    totalFetched = records.length;

    if (area !== undefined && builtYear !== undefined) {
      const inputAge = currentYear - builtYear;
      const firstRecord = records[0];
      const districtName: string | null = firstRecord?.districtName ?? null;
      const municipalityCode: string | null = data.data?.cityCode ?? firstRecord?.municipalityCode ?? null;

      const staged = stagedSimilarSearch(
        records,
        inputAge,
        area,
        currentYear,
        districtName,
        municipalityCode,
        propertyType
      );
      similar = staged.similar;
      searchRange = staged.searchRange;
      searchRangeLabel = staged.searchRangeLabel;
    }
  }

  const seismic = seismicResult.status === "fulfilled" ? seismicResult.value : null;
  const terrain = terrainResult.status === "fulfilled" ? terrainResult.value : null;

  // ── Step 4: e-Stat (sequential — needs cityCode) ───────────────────────────
  const estatKey = process.env.ESTAT_API_KEY ?? "";
  const population =
    cityCode && estatKey ? await fetchPopulationTrend(cityCode, estatKey) : null;

  perfLog("analyzeProperty total", Date.now() - _t0, { address: valid.address });
  return {
    ok: true,
    coords,
    coordOverrideUsed: !!valid.coordOverride,
    originalCoords: valid.coordOverride ? null : coords,
    input: {
      ...valid,
      price:     price     ?? 0,
      area:      area      ?? 0,
      builtYear: builtYear ?? currentYear,
    },
    similar,
    searchRange,
    searchRangeLabel,
    hazard,
    cityCode,
    seismic,
    terrain,
    population,
    totalFetched,
    autoFilledFields,
  };
}
