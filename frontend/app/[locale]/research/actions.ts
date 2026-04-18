"use server";

import { geocodeAddress } from "@/lib/geocode";
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

  const coords = await geocodeAddress(input.address);
  if (!coords) {
    return {
      ok: false,
      error: "住所が見つかりませんでした。都道府県から始まる詳しい住所を入力してください。",
    };
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  let hazard = null;
  let similar: SimilarTx[] = [];
  let totalFetched = 0;

  if (apiBase) {
    try {
      const res = await fetch(
        `${apiBase}/api/property/transactions?lat=${coords.lat}&lng=${coords.lng}&zoom=14&locale=ja`,
        { cache: "no-store", signal: AbortSignal.timeout(20000) }
      );
      if (res.ok) {
        const data = await res.json();
        hazard = data.hazard ?? null;
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
    } catch {
      // Backend unavailable — proceed with geocode result only
    }
  }

  return { ok: true, coords, input, similar, hazard, totalFetched };
}
