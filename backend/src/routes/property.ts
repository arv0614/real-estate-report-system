import { Hono } from "hono";
import { z } from "zod";
import { readCache, writeCache } from "../services/gcsCache";
import { fetchTransactionPrices, getMockTransactionData, fetchHazardInfo, getMockHazardData, fetchEnvironmentInfo, getMockEnvironmentData } from "../services/mlitApi";
import { generateAreaReport, getMockAiReport, type AreaReportInput } from "../services/geminiApi";
import { config } from "../config";
import { buildCacheKey } from "../utils/tile";
import type { TransactionRecord } from "../services/mlitApi";

const app = new Hono();

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  zoom: z.coerce.number().min(10).max(18).default(15),
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
 * 4. MISS + APIキーなし → モックデータ + モックAIレポートを返す
 */
app.get("/transactions", async (c) => {
  const parsed = querySchema.safeParse({
    lat: c.req.query("lat"),
    lng: c.req.query("lng"),
    zoom: c.req.query("zoom"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      400
    );
  }

  const { lat, lng, zoom } = parsed.data;
  const hasApiKey = !!config.mlit.apiKey;

  // 1. GCSキャッシュを確認
  const cached = await readCache(lat, lng, zoom);
  if (cached) {
    const cachedApiData = cached.data as Record<string, unknown>;
    // 旧キャッシュ（year: number, 1年分のみ）はスキップして再取得
    const isOldFormat = typeof cachedApiData.year === "number" && !Array.isArray(cachedApiData.years);
    if (!isOldFormat) {
      // hazard・environment は毎回フレッシュ取得
      const [hazard, environment] = await Promise.all([
        hasApiKey ? fetchHazardInfo(lat, lng).catch(() => getMockHazardData()) : Promise.resolve(getMockHazardData()),
        hasApiKey ? fetchEnvironmentInfo(lat, lng).catch(() => getMockEnvironmentData()) : Promise.resolve(getMockEnvironmentData()),
      ]);

      // AIレポート: キャッシュにあればそのまま使用、なければ生成してキャッシュを更新
      let aiReport = cached.aiReport;
      if (!aiReport) {
        console.log(`[Gemini] キャッシュにaiReportなし。新規生成します (${lat}, ${lng})`);
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
        };
        aiReport = await generateAreaReport(reportInput).catch((err) => {
          console.error("[Gemini] 生成失敗:", err);
          return getMockAiReport(reportInput.prefecture, reportInput.municipality);
        });
        // バックグラウンドでキャッシュを更新
        writeCache(lat, lng, zoom, cachedApiData, aiReport).catch((err) =>
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

  // 2. キャッシュなし: APIキーの有無で分岐
  let apiData;
  let source: "api" | "mock";

  if (hasApiKey) {
    try {
      apiData = await fetchTransactionPrices(lat, lng);
      source = "api";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[MLIT API] fetch failed, falling back to mock:", msg);
      apiData = getMockTransactionData(lat, lng);
      source = "mock";
    }
  } else {
    console.log(`[Route] No API key. Returning mock data for (${lat}, ${lng})`);
    apiData = getMockTransactionData(lat, lng);
    source = "mock";
  }

  // 3. ハザード・生活環境情報を並列取得
  const [hazard, environment] = await Promise.all([
    hasApiKey
      ? fetchHazardInfo(lat, lng).catch((err) => { console.error("[Hazard API] fetch failed:", err); return getMockHazardData(); })
      : Promise.resolve(getMockHazardData()),
    hasApiKey
      ? fetchEnvironmentInfo(lat, lng).catch((err) => { console.error("[Environment API] fetch failed:", err); return getMockEnvironmentData(); })
      : Promise.resolve(getMockEnvironmentData()),
  ]);

  // 4. Gemini AIレポートを生成
  const summary = calcSummary(apiData.data);
  const reportInput: AreaReportInput = {
    lat, lng,
    prefecture: apiData.data[0]?.prefecture ?? "",
    municipality: apiData.data[0]?.municipality ?? "",
    cityCode: apiData.cityCode,
    years: apiData.years,
    ...summary,
    hazard,
    environment,
  };
  const aiReport = await generateAreaReport(reportInput).catch((err) => {
    console.error("[Gemini] 生成失敗:", err);
    return getMockAiReport(reportInput.prefecture, reportInput.municipality);
  });

  // 5. 非同期でGCS保存（aiReport も一緒に保存）
  const cacheKey = buildCacheKey(lat, lng, zoom);
  writeCache(lat, lng, zoom, apiData, aiReport).catch((err) =>
    console.error("[GCS Cache] Background write failed:", err)
  );

  return c.json({
    source,
    cacheKey,
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    hazard,
    environment,
    aiReport,
    data: apiData,
  });
});

export default app;
