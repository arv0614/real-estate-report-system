import type { TransactionApiResponse, TransactionSummary, TransactionRecord } from "@/types/api";

/**
 * 本番バックエンドの Cloud Run URL（asia-northeast1）。
 * NEXT_PUBLIC_API_URL が SSR / ISR ビルド時に未注入だった場合の最終フォールバック。
 * SSR で SITE_URL（mekiki-research.com）にフォールバックすると、フロントドメインに
 * /api/property/* は存在しないため 404 を返してしまう。それを避けるための定数。
 */
const PROD_API_FALLBACK = "https://realestate-api-2hctlfcy6a-an.a.run.app";

/** バックエンド呼び出し時のデフォルトタイムアウト (ms)。Cloud Run のコールドスタート + MLIT/Gemini 生成を許容。 */
export const DEFAULT_FETCH_TIMEOUT_MS = 90_000;

/**
 * API ベース URL を解決する（クライアント・サーバー両対応）
 *
 * 優先順位:
 *  1. NEXT_PUBLIC_API_URL（バックエンド Cloud Run の URL。本番・開発ともに推奨）
 *  2. クライアントサイド: window.location.origin（ブラウザのオリジン）
 *  3. サーバーサイド: PROD_API_FALLBACK（ハードコードされた本番 Cloud Run URL）
 *
 * 注意: サーバーサイドで NEXT_PUBLIC_SITE_URL（mekiki-research.com）には絶対に
 * フォールバックしない。フロントドメインに /api/property/* は存在しないため。
 * ローカル開発時は `frontend/.env.local` で NEXT_PUBLIC_API_URL=http://localhost:8080 を明示する。
 */
export function getApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;

  // Client-side: always resolve against the browser origin, never the page path
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: ハードコードした本番バックエンドにフォールバック
  // (SITE_URL = mekiki-research.com には /api/property/* が存在しないので使わない)
  return PROD_API_FALLBACK;
}

/**
 * AbortController でタイムアウト付きの fetch を行う薄いラッパ。
 * 既存の RequestInit と組み合わせ可能（Next.js 16 の `next.revalidate` など）。
 *
 * Cloud Run のコールドスタート (≈ 数十秒) と MLIT API + Gemini 生成 (合計 60〜90秒)
 * を考慮し、デフォルトタイムアウトは 90 秒に設定。これより短い既定では SSR/ISR で
 * 自動的にアボートされ「データ取得失敗」状態に落ちるリスクがある。
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTransactions(
  lat: number,
  lng: number,
  zoom = 15,
  locale = "ja",
  options: { omitAiReport?: boolean } = {},
): Promise<TransactionApiResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    zoom: String(zoom),
    locale,
  });
  if (options.omitAiReport) params.set("omitAiReport", "true");
  const url = `${getApiBase()}/api/property/transactions?${params.toString()}`;

  const res = await fetchWithTimeout(url, { cache: "no-store" });
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
 * AIエリアレポートだけを取得する軽量エンドポイント (プログレッシブロード用)。
 * バックエンド側で取引データのキャッシュを再利用するため、/transactions より先に
 * 呼ぶと MLIT を二度叩く点に注意。通常は /transactions の応答後に呼ぶ。
 */
export async function fetchAiReport(
  lat: number,
  lng: number,
  zoom = 15,
  locale = "ja",
): Promise<{ source: string; aiReport: string }> {
  const url = `${getApiBase()}/api/property/ai-report?lat=${lat}&lng=${lng}&zoom=${zoom}&locale=${locale}`;
  const res = await fetchWithTimeout(url, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 429) {
      throw Object.assign(new Error("RATE_LIMITED"), { code: "RATE_LIMITED" });
    }
    const body = await res.text();
    throw new Error(`AI report error ${res.status}: ${body}`);
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
