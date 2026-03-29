import type { TransactionApiResponse, TransactionSummary, TransactionRecord } from "@/types/api";

// 末尾スラッシュを除去してベースURLを正規化
// NEXT_PUBLIC_API_URL が空の場合は相対パスでフォールバック（開発時は /api プロキシを使う想定）
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const API_BASE = RAW_API_URL.replace(/\/$/, "") || "";

export async function fetchTransactions(
  lat: number,
  lng: number,
  zoom = 15
): Promise<TransactionApiResponse> {
  // new URL() は NEXT_PUBLIC_API_URL が空だと "Invalid URL" でクラッシュするため文字列結合を使う
  const url = `${API_BASE}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=${zoom}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("アクセスが集中しています。しばらく待ってから再度お試しください。");
    }
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

export interface GeneratedImageResponse {
  imageBase64: string;
  mimeType: string;
  isMock: boolean;
}

/** 指定エリアの「暮らしイメージ」画像をバックエンド経由でImagen 4生成する */
export async function generateLifestyleImage(
  prefecture: string,
  municipality: string,
  areaFeatures?: string
): Promise<GeneratedImageResponse> {
  const url = `${API_BASE}/api/property/generate-image`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefecture, municipality, areaFeatures }),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("アクセスが集中しています。しばらく待ってから再度お試しください。");
    }
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
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
