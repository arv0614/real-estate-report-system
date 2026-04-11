import type { TransactionApiResponse, TransactionSummary, TransactionRecord } from "@/types/api";

/**
 * API ベース URL を解決する（クライアント・サーバー両対応）
 *
 * 優先順位:
 *  1. NEXT_PUBLIC_API_URL（バックエンド Cloud Run の URL。本番・開発ともに推奨）
 *  2. クライアントサイド: window.location.origin（ブラウザのオリジン）
 *  3. サーバーサイド: NEXT_PUBLIC_SITE_URL（フロントエンドのベース URL）
 *  4. フォールバック: http://localhost:3000
 *
 * 空文字列や相対パスを返さない。
 * サーバーサイドの fetch が現在のリクエスト URL を基準に相対解決し
 * /en/ が混入するのを防ぐ（例: /en/api/... → 404）。
 */
export function getApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;

  // Client-side: always resolve against the browser origin, never the page path
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: need an absolute URL; relative paths in server components are
  // resolved against the current request URL and would produce /en/api/... on /en/* pages
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return siteUrl || "http://localhost:3000";
}

export async function fetchTransactions(
  lat: number,
  lng: number,
  zoom = 15,
  locale = "ja"
): Promise<TransactionApiResponse> {
  const url = `${getApiBase()}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=${zoom}&locale=${locale}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 429) {
      throw Object.assign(new Error("RATE_LIMITED"), { code: "RATE_LIMITED" });
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

/** 指定エリアの「暮らしイメージ」画像をバックエンド経由で Imagen 4 生成する */
export async function generateLifestyleImage(
  prefecture: string,
  municipality: string,
  areaFeatures?: string
): Promise<GeneratedImageResponse> {
  const url = `${getApiBase()}/api/property/generate-image`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefecture, municipality, areaFeatures }),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw Object.assign(new Error("RATE_LIMITED"), { code: "RATE_LIMITED" });
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
