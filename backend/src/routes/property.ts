import { Hono } from "hono";
import { z } from "zod";
import { readCache, writeCache } from "../services/gcsCache";
import { fetchTransactionPrices, getMockTransactionData } from "../services/mlitApi";
import { config } from "../config";

const app = new Hono();

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  zoom: z.coerce.number().min(10).max(18).default(15),
});

/**
 * GET /api/property/transactions
 * 不動産取引価格情報を取得（GCSキャッシュ機構付き）
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

  // 1. GCSキャッシュを確認
  const cached = await readCache(lat, lng, zoom);
  if (cached) {
    return c.json({
      source: "cache",
      cacheKey: cached.cacheKey,
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
      data: cached.data,
    });
  }

  // 2. キャッシュなし → APIを呼ぶ（APIキーがなければモックを返す）
  let apiData;
  const isMockMode = !config.mlit.apiKey || config.nodeEnv === "development";

  if (isMockMode) {
    console.log(`[API] Mock mode: returning dummy data for (${lat}, ${lng})`);
    apiData = getMockTransactionData(lat, lng);
  } else {
    try {
      apiData = await fetchTransactionPrices(lat, lng, zoom);
    } catch (err) {
      console.error("[API] MLIT API fetch failed:", err);
      // フォールバック: モックデータを返す
      apiData = getMockTransactionData(lat, lng);
    }
  }

  // 3. 非同期でGCSに保存（レスポンスをブロックしない）
  writeCache(lat, lng, zoom, apiData).catch((err) =>
    console.error("[GCS Cache] Background write failed:", err)
  );

  return c.json({
    source: isMockMode ? "mock" : "api",
    cacheKey: null,
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    data: apiData,
  });
});

export default app;
