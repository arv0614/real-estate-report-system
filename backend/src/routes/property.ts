import { Hono } from "hono";
import { z } from "zod";
import { readCache, writeCache } from "../services/gcsCache";
import { fetchTransactionPrices, getMockTransactionData, fetchHazardInfo, getMockHazardData, fetchEnvironmentInfo, getMockEnvironmentData } from "../services/mlitApi";
import { config } from "../config";
import { buildCacheKey } from "../utils/tile";

const app = new Hono();

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  zoom: z.coerce.number().min(10).max(18).default(15),
});

/**
 * GET /api/property/transactions
 * 不動産取引価格情報を取得（GCSキャッシュ機構付き）
 *
 * キャッシュ戦略:
 * 1. GCSキャッシュHIT → 即返却
 * 2. MISS + APIキーあり → MLIT API を呼び、GCSに非同期保存
 * 3. MISS + APIキーなし → モックデータを返す
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

  // 1. GCSキャッシュを確認（ハザード情報は毎回フレッシュ取得）
  const cached = await readCache(lat, lng, zoom);
  if (cached) {
    const cachedApiData = cached.data as Record<string, unknown>;
    // 旧キャッシュ（year: number, 1年分のみ）はスキップして再取得
    const isOldFormat = typeof cachedApiData.year === "number" && !Array.isArray(cachedApiData.years);
    if (!isOldFormat) {
      const hasApiKey = !!config.mlit.apiKey;
      const [hazard, environment] = await Promise.all([
        hasApiKey ? fetchHazardInfo(lat, lng).catch(() => getMockHazardData()) : Promise.resolve(getMockHazardData()),
        hasApiKey ? fetchEnvironmentInfo(lat, lng).catch(() => getMockEnvironmentData()) : Promise.resolve(getMockEnvironmentData()),
      ]);

      return c.json({
        source: "cache",
        cacheKey: cached.cacheKey,
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
        hazard,
        environment,
        data: cachedApiData,
      });
    }
    console.log(`[Route] Old cache format detected, re-fetching 5-year data for (${lat}, ${lng})`);
  }

  // 2. キャッシュなし: APIキーの有無で分岐（NODE_ENVは参照しない）
  const hasApiKey = !!config.mlit.apiKey;
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

  // 3. ハザード・生活環境情報を並列取得（取引データとは独立してフレッシュ取得）
  const [hazard, environment] = await Promise.all([
    hasApiKey
      ? fetchHazardInfo(lat, lng).catch((err) => { console.error("[Hazard API] fetch failed:", err); return getMockHazardData(); })
      : Promise.resolve(getMockHazardData()),
    hasApiKey
      ? fetchEnvironmentInfo(lat, lng).catch((err) => { console.error("[Environment API] fetch failed:", err); return getMockEnvironmentData(); })
      : Promise.resolve(getMockEnvironmentData()),
  ]);

  // 4. 非同期でGCSに保存（レスポンスをブロックしない）
  const cacheKey = buildCacheKey(lat, lng, zoom);
  writeCache(lat, lng, zoom, apiData).catch((err) =>
    console.error("[GCS Cache] Background write failed:", err)
  );

  return c.json({
    source,
    cacheKey,
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    hazard,
    environment,
    data: apiData,
  });
});

export default app;
