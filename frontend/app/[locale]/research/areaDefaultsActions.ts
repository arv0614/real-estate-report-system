"use server";

import type { TransactionRecord } from "@/types/api";
import type { PropertyType } from "@/types/research";
import { perfLog } from "@/lib/debug/perfLog";

export interface AreaDefaults {
  priceMedian: number | null;    // 万円
  areaMedian: number | null;     // ㎡
  builtYearMedian: number | null;
  sampleSize: number;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const TYPE_FILTER: Record<PropertyType, string> = {
  mansion: "中古マンション等",
  house:   "宅地(土地と建物)",
};

export async function fetchAreaDefaults(
  lat: number,
  lng: number,
  propertyType: PropertyType = "mansion"
): Promise<AreaDefaults> {
  const empty: AreaDefaults = { priceMedian: null, areaMedian: null, builtYearMedian: null, sampleSize: 0 };

  if (!isFinite(lat) || !isFinite(lng)) return empty;

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!apiBase) return empty;

  try {
    const _t0 = Date.now();
    const res = await fetch(
      `${apiBase}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=14&locale=ja`,
      { cache: "no-store", signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return empty;
    const data = await res.json();
    perfLog("fetchAreaDefaults API", Date.now() - _t0, { lat, lng, propertyType });
    const allRecords: TransactionRecord[] = data?.data?.data ?? [];

    const requiredType = TYPE_FILTER[propertyType];
    const records = allRecords.filter((r) => r.type === requiredType);

    const prices     = records.filter((r) => r.tradePrice > 0).map((r) => Math.round(r.tradePrice / 10000));
    const areas      = records.filter((r) => (r.area ?? 0) > 0).map((r) => r.area!);
    const builtYears = records.filter((r) => r.buildingYear).map((r) => r.buildingYear!);

    return {
      priceMedian:     median(prices),
      areaMedian:      median(areas),
      builtYearMedian: builtYears.length ? Math.round(median(builtYears)!) : null,
      sampleSize:      records.length,
    };
  } catch {
    return empty;
  }
}
