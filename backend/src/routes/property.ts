import { Hono } from "hono";
import { z } from "zod";
import { readCache, writeCache } from "../services/gcsCache";
import { fetchTransactionPrices, fetchHazardInfo, fetchEnvironmentInfo, type HazardInfo, type EnvironmentInfo } from "../services/mlitApi";
import { generateAreaReport, type AreaReportInput } from "../services/geminiApi";
import { generateLifestyleImage } from "../services/imagenApi";
import { config } from "../config";
import { buildCacheKey } from "../utils/tile";
import type { TransactionRecord } from "../services/mlitApi";

const app = new Hono();

/** APIキー未設定・取得失敗時に返す空ハザード情報（モックではなく「データなし」） */
const EMPTY_HAZARD: HazardInfo = {
  flood: { hasRisk: false, maxDepthRank: null, maxDepthLabel: null },
  landslide: { hasRisk: false, phenomena: [] },
};

/** APIキー未設定・取得失敗時に返す空生活環境情報（モックではなく「データなし」） */
const EMPTY_ENVIRONMENT: EnvironmentInfo = {
  zoning: { useArea: null, coverageRatio: null, floorAreaRatio: null },
  schools: { elementary: null, juniorHigh: null },
  medical: { count: 0, facilities: [] },
  station: { name: null, operator: null, dailyPassengers: null },
};

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  zoom: z.coerce.number().min(10).max(18).default(15),
  locale: z.enum(["ja", "en"]).default("ja"),
});

/** TransactionRecord の配列から統計サマリーを計算 */
function calcSummary(records: TransactionRecord[]) {
  const prices = records.map((r) => r.tradePrice).filter((p) => p > 0);
  const unitPrices = records.map((r) => r.unitPrice).filter((v): v is number => v !== null && v > 0);
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    totalCount: records.length,
    avgTradePrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    avgUnitPrice: unitPrices.length ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length : null,
    minTradePrice: sorted[0] ?? 0,
    maxTradePrice: sorted[sorted.length - 1] ?? 0,
  };
}

/**
 * GET /api/property/transactions
 * 不動産取引価格情報を取得（GCSキャッシュ機構付き）
 *
 * キャッシュ戦略:
 * 1. GCSキャッシュHIT + aiReport あり → hazard/environment だけ再取得して即返却
 * 2. GCSキャッシュHIT + aiReport なし → Gemini生成 → バックグラウンドでキャッシュ更新
 * 3. MISS + APIキーあり → MLIT API + Gemini を呼び、GCSに保存
 * 4. MISS + APIキーなし → 503 を返す
 */
app.get("/transactions", async (c) => {
  const parsed = querySchema.safeParse({
    lat: c.req.query("lat"),
    lng: c.req.query("lng"),
    zoom: c.req.query("zoom"),
    locale: c.req.query("locale"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      400
    );
  }

  const { lat, lng, zoom, locale } = parsed.data;
  const hasApiKey = !!config.mlit.apiKey;

  // 1. GCSキャッシュを確認
  const cached = await readCache(lat, lng, zoom, locale);
  if (cached) {
    const cachedApiData = cached.data as Record<string, unknown>;
    // 旧キャッシュ（year: number, 1年分のみ）はスキップして再取得
    const isOldFormat = typeof cachedApiData.year === "number" && !Array.isArray(cachedApiData.years);
    if (!isOldFormat) {
      // hazard・environment は毎回フレッシュ取得（APIキーなし・失敗時は空データ）
      const [hazard, environment] = await Promise.all([
        hasApiKey ? fetchHazardInfo(lat, lng).catch(() => EMPTY_HAZARD) : Promise.resolve(EMPTY_HAZARD),
        hasApiKey ? fetchEnvironmentInfo(lat, lng).catch(() => EMPTY_ENVIRONMENT) : Promise.resolve(EMPTY_ENVIRONMENT),
      ]);

      // AIレポート: キャッシュにあればそのまま使用、なければ生成してキャッシュを更新
      // 言語ミスマッチ検出: locale=en なのに日本語レポートがキャッシュされている場合は再生成
      // ヒューリスティック: 先頭80文字内の日本語文字数が10以上なら日本語レポートと判断
      const countJaCharsInPrefix = (text: string) =>
        (text.slice(0, 80).match(/[\u3040-\u9FAF]/g) ?? []).length;
      const isLangMismatch = cached.aiReport
        ? (locale === "en" && countJaCharsInPrefix(cached.aiReport) >= 10)
          || (locale === "ja" && countJaCharsInPrefix(cached.aiReport) === 0)
        : false;

      let aiReport = isLangMismatch ? undefined : cached.aiReport;
      if (!aiReport) {
        const reason = isLangMismatch ? "言語ミスマッチ（再生成）" : "aiReportなし";
        console.log(`[Gemini] ${reason}。新規生成します (${lat}, ${lng}, locale=${locale})`);
        const records = (cachedApiData.data ?? []) as TransactionRecord[];
        const summary = calcSummary(records);
        const reportInput: AreaReportInput = {
          lat, lng,
          prefecture: String((records[0]?.prefecture) ?? ""),
          municipality: String((records[0]?.municipality) ?? ""),
          cityCode: String(cachedApiData.cityCode ?? ""),
          years: (cachedApiData.years as number[]) ?? [],
          ...summary,
          hazard,
          environment,
          locale,
        };
        aiReport = await generateAreaReport(reportInput).catch((err) => {
          console.error("[Gemini] 生成失敗:", err);
          return undefined;
        });
        // バックグラウンドでキャッシュを更新
        writeCache(lat, lng, zoom, cachedApiData, aiReport, locale).catch((err) =>
          console.error("[GCS Cache] aiReport update failed:", err)
        );
      }

      return c.json({
        source: "cache",
        cacheKey: cached.cacheKey,
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
        hazard,
        environment,
        aiReport,
        data: cachedApiData,
      });
    }
    console.log(`[Route] Old cache format detected, re-fetching 5-year data for (${lat}, ${lng})`);
  }

  // 2. キャッシュなし: APIキー必須
  if (!hasApiKey) {
    console.error("[Route] No MLIT API key configured");
    return c.json({ error: "Service unavailable: API key not configured" }, 503);
  }

  let apiData;
  try {
    apiData = await fetchTransactionPrices(lat, lng);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[MLIT API] fetch failed:", msg);
    return c.json({ error: "Failed to fetch transaction data", details: msg }, 502);
  }

  // 3. ハザード・生活環境情報を並列取得（失敗時は空データ）
  const [hazard, environment] = await Promise.all([
    fetchHazardInfo(lat, lng).catch((err) => { console.error("[Hazard API] fetch failed:", err); return EMPTY_HAZARD; }),
    fetchEnvironmentInfo(lat, lng).catch((err) => { console.error("[Environment API] fetch failed:", err); return EMPTY_ENVIRONMENT; }),
  ]);

  // 4. Gemini AIレポートを生成
  const summary = calcSummary(apiData.data);
  const reportInput: AreaReportInput = {
    lat, lng,
    prefecture: apiData.data[0]?.prefecture ?? "",
    municipality: apiData.data[0]?.municipality ?? apiData.geocodedDistrict ?? "",
    cityCode: apiData.cityCode,
    years: apiData.years,
    ...summary,
    hazard,
    environment,
    locale,
  };
  const aiReport = await generateAreaReport(reportInput).catch((err) => {
    console.error("[Gemini] 生成失敗:", err);
    return undefined;
  });

  // 5. 非同期でGCS保存（aiReport も一緒に保存）
  const cacheKey = buildCacheKey(lat, lng, zoom, locale);
  writeCache(lat, lng, zoom, apiData, aiReport, locale).catch((err) =>
    console.error("[GCS Cache] Background write failed:", err)
  );

  return c.json({
    source: "api",
    cacheKey,
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    hazard,
    environment,
    aiReport,
    data: apiData,
  });
});

/**
 * POST /api/property/generate-image
 * 指定エリアの「暮らしイメージ」画像をImagen 3で生成する（ログイン必須はフロントで制御）
 */
const generateImageSchema = z.object({
  prefecture: z.string().min(1),
  municipality: z.string().min(1),
  areaFeatures: z.string().optional(),
});

app.post("/generate-image", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid parameters", details: parsed.error.flatten() }, 400);
  }

  const { prefecture, municipality, areaFeatures } = parsed.data;
  try {
    const result = await generateLifestyleImage(prefecture, municipality, areaFeatures);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/generate-image] 生成失敗:", msg);
    return c.json({ error: "画像生成に失敗しました", details: msg }, 500);
  }
});

export default app;
