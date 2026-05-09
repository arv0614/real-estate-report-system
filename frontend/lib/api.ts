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

/**
 * area フィールドを ㎡ の数値に正規化する。
 * - number → そのまま（>0 のときのみ採用）
 * - 文字列 (例: "50", "2000以上", "65.5", "  ") → parseFloat で先頭の数値部分を抽出
 *   ※ MLIT 国交省API は超大規模区画を「2000以上」とバケットして返すケースがある。
 *     `parseFloat("2000以上")` は 2000 を返すため、保守的に下限値として採用する。
 * - null / undefined / 空文字 / 数値化できない → null
 */
export function parseArea(area: number | string | null | undefined): number | null {
  if (area == null) return null;
  if (typeof area === "number") {
    return Number.isFinite(area) && area > 0 ? area : null;
  }
  const trimmed = String(area).trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 1レコードの平米単価 (円/㎡) を解決する。
 *
 *  - 「宅地(土地)」: API の `unitPrice` を最優先 (MLIT が公示する公式値)。
 *    fallback として tradePrice / area を使う (土地のみで unitPrice が欠損していた場合)。
 *  - それ以外 (中古マンション・宅地土地建物・農地・林地): API は `unitPrice` を
 *    返さない (MLIT が建物込みの単価を公示しないため)。tradePrice / area で算出する。
 *
 * 計算不能な場合は null を返す。
 */
export function resolveUnitPrice(record: TransactionRecord): number | null {
  // 「宅地(土地)」は API の値を優先 (公式単価・端数なし)
  if (record.type === "宅地(土地)" && record.unitPrice && record.unitPrice > 0) {
    return record.unitPrice;
  }
  // それ以外、または土地で API 値が欠損していた場合: tradePrice / area で算出
  if (!record.tradePrice || record.tradePrice <= 0) return null;
  const area = parseArea(record.area);
  if (!area) return null;
  return Math.round(record.tradePrice / area);
}

export function calcSummary(records: TransactionRecord[]): TransactionSummary {
  const prices = records.map((r) => r.tradePrice).filter((p) => p > 0);
  // 平米単価は 種別ごとに「APIのunitPrice or tradePrice/area」で解決して集計
  const unitPrices = records
    .map(resolveUnitPrice)
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

/** 円を「1,234万円」(ja) または「¥1.2M」(en) 表記に変換。ゼロは「—」 */
export function formatPrice(yen: number, locale = "ja"): string {
  if (yen === 0) return "—";
  if (locale === "en") {
    const millions = yen / 1_000_000;
    return `¥${millions >= 100 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  const man = Math.round(yen / 10000);
  return `${man.toLocaleString()}万円`;
}

/** 円/㎡を「NN万円/㎡」(ja) または「¥X.XXM/㎡」(en) 表記に変換 */
export function formatUnitPrice(yenPerSqm: number, locale = "ja"): string {
  if (locale === "en") {
    return `¥${(yenPerSqm / 1_000_000).toFixed(2)}M/㎡`;
  }
  return `${Math.round(yenPerSqm / 10000).toLocaleString()}万円/㎡`;
}
