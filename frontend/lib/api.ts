import type { TransactionApiResponse, TransactionSummary, TransactionRecord } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function fetchTransactions(
  lat: number,
  lng: number,
  zoom = 15
): Promise<TransactionApiResponse> {
  const url = new URL(`${API_URL}/api/property/transactions`);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lng", lng.toString());
  url.searchParams.set("zoom", zoom.toString());

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export function calcSummary(records: TransactionRecord[]): TransactionSummary {
  const prices = records.map((r) => r.tradePrice).filter((p) => p > 0);
  const unitPrices = records
    .map((r) => r.unitPrice)
    .filter((v): v is number => v !== null && v > 0);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };

  // Math.min/max(...arr) can overflow the call stack for large arrays; use reduce instead
  const minOf = (arr: number[]) => arr.reduce((a, b) => (b < a ? b : a), arr[0]);
  const maxOf = (arr: number[]) => arr.reduce((a, b) => (b > a ? b : a), arr[0]);

  const typeBreakdown = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalCount: records.length,
    avgUnitPrice: unitPrices.length ? avg(unitPrices) : null,
    avgTradePrice: avg(prices),
    medianTradePrice: median(prices),
    minTradePrice: prices.length ? minOf(prices) : 0,
    maxTradePrice: prices.length ? maxOf(prices) : 0,
    typeBreakdown,
  };
}

/** 円を「1,234万円」表記に変換。ゼロは「—」 */
export function formatPrice(yen: number): string {
  if (yen === 0) return "—";
  const man = Math.round(yen / 10000);
  return `${man.toLocaleString()}万円`;
}

/** 円/㎡を「NN万円/㎡」表記に変換 */
export function formatUnitPrice(yenPerSqm: number): string {
  return `${Math.round(yenPerSqm / 10000).toLocaleString()}万円/㎡`;
}
