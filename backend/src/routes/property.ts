import { Hono } from "hono";
import { z } from "zod";
import { readCache, writeCache } from "../services/gcsCache";
import {
  fetchTransactionPrices,
  fetchHazardInfo,
  fetchEnvironmentInfo,
  findNearestStationWalkTime,
  type HazardInfo,
  type EnvironmentInfo,
} from "../services/mlitApi";
import { fetchWeatherSummary, type WeatherSummary } from "../services/openMeteo";
import { generateAreaReport, type AreaReportInput } from "../services/geminiApi";
import { generateLifestyleImage } from "../services/imagenApi";
import {
  checkSeoImageCache,
  saveSeoImageCache,
  readSeoImageFromGcs,
} from "../services/seoImageCache";
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

/** Open-Meteo 取得を堅牢化（失敗・タイムアウトは null にフォールバック） */
async function safeFetchWeather(lat: number, lng: number): Promise<WeatherSummary | null> {
  try {
    return await fetchWeatherSummary(lat, lng);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Open-Meteo] fetch failed for (${lat}, ${lng}):`, msg);
    return null;
  }
}

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  zoom: z.coerce.number().min(10).max(18).default(15),
  // フロントエンドが対応する全ロケール（i18n routing.locales と同期）。
  // 未対応ロケール（zh-TW / zh-CN）は geminiApi.buildPrompt() 内で
  // 日本語プロンプトにフォールバックされる。
  locale: z.enum(["ja", "en", "zh-TW", "zh-CN"]).default("ja"),
  // ?omitAiReport=true でAIレポート生成をスキップする (プログレッシブロード対応)。
  // フロント側は /transactions で先に軽量データを取得 → 別途 /ai-report で AI を取得。
  omitAiReport: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

/**
 * 言語ミスマッチ検出: locale=en なのに日本語レポートがキャッシュされている等。
 * ヒューリスティック: 先頭80文字内の日本語文字数が10以上なら日本語レポートと判断。
 */
function isAiReportLangMismatch(report: string, locale: string): boolean {
  const countJa = (text: string) =>
    (text.slice(0, 80).match(/[぀-龯]/g) ?? []).length;
  if (locale === "en") return countJa(report) >= 10;
  if (locale === "ja") return countJa(report) === 0;
  return false;
}

/**
 * 検索中心 (lat, lng) から最寄り駅までの徒歩分を計算し、各取引レコードに timeToNearestStation を付与する。
 * 失敗時はレコードを変更しない。MLIT XIT001 は駅情報を返さないため、XKT015 ベースの自前計算で補う。
 * 取引データに緯度経度は無いので「検索中心の最寄り駅」を全レコードに一様に付与する MVP 実装。
 */
async function attachWalkTimeToRecords(
  records: TransactionRecord[],
  lat: number,
  lng: number,
): Promise<{ stationName: string | null; minutes: number | null }> {
  if (records.length === 0) return { stationName: null, minutes: null };
  try {
    const nearest = await findNearestStationWalkTime(lat, lng);
    if (!nearest) {
      console.log(`[WalkTime] no station found near (${lat}, ${lng})`);
      return { stationName: null, minutes: null };
    }
    const minutesStr = String(nearest.minutes);
    for (const r of records) {
      r.timeToNearestStation = minutesStr;
    }
    console.log(
      `[WalkTime] nearest=${nearest.station.name} dist=${nearest.distanceMeters}m → ${nearest.minutes}min (stamped on ${records.length} records)`
    );
    return { stationName: nearest.station.name, minutes: nearest.minutes };
  } catch (err) {
    console.error("[WalkTime] failed:", err instanceof Error ? err.message : err);
    return { stationName: null, minutes: null };
  }
}

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
    omitAiReport: c.req.query("omitAiReport"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      400
    );
  }

  const { lat, lng, zoom, locale, omitAiReport } = parsed.data;
  const hasApiKey = !!config.mlit.apiKey;

  // 1. GCSキャッシュを確認
  const cached = await readCache(lat, lng, zoom, locale);
  if (cached) {
    const cachedApiData = cached.data as Record<string, unknown>;
    // 旧キャッシュ（year: number, 1年分のみ）はスキップして再取得
    const isOldFormat = typeof cachedApiData.year === "number" && !Array.isArray(cachedApiData.years);
    if (!isOldFormat) {
      // hazard・environment・weather は毎回フレッシュ取得（APIキーなし・失敗時は空 / null）。
      // 同時に検索中心の最寄り駅・徒歩分も再計算してキャッシュレコードに上書き付与する
      // (キャッシュ時点では timeToNearestStation が null のため毎回付け直す)。
      const cachedRecords = (cachedApiData.data ?? []) as TransactionRecord[];
      const [hazard, environment, weather] = await Promise.all([
        hasApiKey ? fetchHazardInfo(lat, lng).catch(() => EMPTY_HAZARD) : Promise.resolve(EMPTY_HAZARD),
        hasApiKey ? fetchEnvironmentInfo(lat, lng).catch(() => EMPTY_ENVIRONMENT) : Promise.resolve(EMPTY_ENVIRONMENT),
        safeFetchWeather(lat, lng),
        // attachWalkTimeToRecords は cachedRecords を mutating する副作用関数（戻り値は捨てる）
        hasApiKey ? attachWalkTimeToRecords(cachedRecords, lat, lng) : Promise.resolve(null),
      ]);

      // AIレポート: キャッシュにあればそのまま使用、なければ生成してキャッシュを更新。
      // 言語ミスマッチがあれば再生成扱い (isAiReportLangMismatch)。
      // ?omitAiReport=true の場合は生成をスキップ（呼び出し側が別途 /ai-report を叩く）。
      const isLangMismatch = cached.aiReport ? isAiReportLangMismatch(cached.aiReport, locale) : false;

      let aiReport = isLangMismatch ? undefined : cached.aiReport;
      if (!aiReport && !omitAiReport) {
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
          weather,
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
        weather,
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

  // 3. ハザード・生活環境・気象情報・徒歩時間を並列取得（失敗時は空 / null）。
  // attachWalkTimeToRecords は apiData.data を mutating で書き換える副作用関数。
  const [hazard, environment, weather] = await Promise.all([
    fetchHazardInfo(lat, lng).catch((err) => { console.error("[Hazard API] fetch failed:", err); return EMPTY_HAZARD; }),
    fetchEnvironmentInfo(lat, lng).catch((err) => { console.error("[Environment API] fetch failed:", err); return EMPTY_ENVIRONMENT; }),
    safeFetchWeather(lat, lng),
    attachWalkTimeToRecords(apiData.data, lat, lng),
  ]);

  // 4. Gemini AIレポートを生成（?omitAiReport=true のときはスキップ）
  let aiReport: string | undefined;
  if (!omitAiReport) {
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
      weather,
      locale,
    };
    aiReport = await generateAreaReport(reportInput).catch((err) => {
      console.error("[Gemini] 生成失敗:", err);
      return undefined;
    });
  }

  // 5. GCS保存。omitAiReport の場合、後続の /ai-report がキャッシュを読めるよう
  //    レース回避のため await する。通常パスは従来通りバックグラウンド書き込み。
  const cacheKey = buildCacheKey(lat, lng, zoom, locale);
  const writePromise = writeCache(lat, lng, zoom, apiData, aiReport, locale).catch((err) =>
    console.error("[GCS Cache] Background write failed:", err)
  );
  if (omitAiReport) await writePromise;

  return c.json({
    source: "api",
    cacheKey,
    fetchedAt: new Date().toISOString(),
    expiresAt: null,
    hazard,
    environment,
    weather,
    aiReport,
    data: apiData,
  });
});

/**
 * GET /api/property/seo-image
 * SEOレポートページ用ライフスタイル画像を返す。
 *
 * キャッシュ戦略:
 *   1. Firestore に有効キャッシュ（30日以内）があれば GCS から読んで返す
 *   2. なければ Gemini で生成 → GCS / Firestore に保存 → 返す
 *
 * 認証不要・公開エンドポイント（レート制限はミドルウェアで適用済み）
 */
const seoImageSchema = z.object({
  prefSlug:     z.string().min(1).max(50),
  citySlug:     z.string().min(1).max(50),
  prefecture:   z.string().min(1).max(50),
  municipality: z.string().min(1).max(50),
});

app.get("/seo-image", async (c) => {
  const parsed = seoImageSchema.safeParse({
    prefSlug:     c.req.query("prefSlug"),
    citySlug:     c.req.query("citySlug"),
    prefecture:   c.req.query("prefecture"),
    municipality: c.req.query("municipality"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid parameters", details: parsed.error.flatten() }, 400);
  }

  const { prefSlug, citySlug, prefecture, municipality } = parsed.data;

  // 1. キャッシュチェック
  const cached = await checkSeoImageCache(prefSlug, citySlug);
  if (cached) {
    const buf = await readSeoImageFromGcs(cached.gcsPath);
    if (buf) {
      return new Response(buf, {
        headers: {
          "Content-Type": cached.mimeType,
          "Cache-Control": "public, max-age=2592000",
        },
      });
    }
    console.warn(`[SeoImage] Cache HIT but GCS read failed, regenerating: ${prefSlug}_${citySlug}`);
  }

  // 2. 生成
  if (!config.gemini.apiKey) {
    return c.json({ error: "Image generation unavailable: Gemini API key not configured" }, 503);
  }

  console.log(`[SeoImage] Generating: ${prefecture}${municipality}`);

  let generated;
  try {
    generated = await generateLifestyleImage(prefecture, municipality);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SeoImage] Generation failed:", msg);
    return c.json({ error: "Image generation failed", details: msg }, 500);
  }

  // 3. バックグラウンド保存（保存失敗はサービス継続に影響させない）
  saveSeoImageCache(prefSlug, citySlug, generated.imageBase64, generated.mimeType).catch((err) =>
    console.error("[SeoImage] Background save failed:", err),
  );

  // 4. 生成画像をそのまま返す
  const buf = Buffer.from(generated.imageBase64, "base64");
  return new Response(buf, {
    headers: {
      "Content-Type": generated.mimeType,
      "Cache-Control": "public, max-age=2592000",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
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

/**
 * GET /api/property/ai-report
 * AIレポートのみを取得する軽量エンドポイント（プログレッシブロード用）。
 *
 * 想定フロー:
 *   1. フロントが /transactions?omitAiReport=true で素早く取引・ハザード等を取得
 *   2. その完了後に /ai-report を叩いて AI レポートだけを後追いで取得
 *
 * 動作:
 *   - GCSキャッシュに aiReport が既にあれば即返却（言語ミスマッチでなければ）
 *   - aiReport が無ければ、キャッシュ済みの取引データから Gemini で生成し、
 *     キャッシュを更新してから返却
 *   - キャッシュ自体が無い場合は MLIT API から取引データを取り直して生成
 */
app.get("/ai-report", async (c) => {
  const parsed = querySchema.safeParse({
    lat: c.req.query("lat"),
    lng: c.req.query("lng"),
    zoom: c.req.query("zoom"),
    locale: c.req.query("locale"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid parameters", details: parsed.error.flatten() }, 400);
  }
  const { lat, lng, zoom, locale } = parsed.data;
  const hasApiKey = !!config.mlit.apiKey;

  // 1. キャッシュチェック
  const cached = await readCache(lat, lng, zoom, locale);

  // 1-a. 既存の有効な aiReport があれば即返却
  if (cached?.aiReport && !isAiReportLangMismatch(cached.aiReport, locale)) {
    return c.json({ source: "cache", aiReport: cached.aiReport });
  }

  // 2. ベースとなる取引データを揃える（キャッシュ済みのものを優先）
  type CachedApi = { data?: TransactionRecord[]; cityCode?: string; years?: number[]; geocodedDistrict?: string };
  let apiData: CachedApi | null = null;
  if (cached) {
    const c0 = cached.data as Record<string, unknown>;
    const isOldFormat = typeof c0.year === "number" && !Array.isArray(c0.years);
    if (!isOldFormat) apiData = c0 as CachedApi;
  }
  if (!apiData) {
    if (!hasApiKey) {
      return c.json({ error: "Service unavailable: API key not configured" }, 503);
    }
    try {
      apiData = (await fetchTransactionPrices(lat, lng)) as CachedApi;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[MLIT API] fetch failed:", msg);
      return c.json({ error: "Failed to fetch transaction data", details: msg }, 502);
    }
  }

  // 3. hazard / environment / weather を並列取得（Gemini プロンプトの入力に使う）
  const [hazard, environment, weather] = await Promise.all([
    hasApiKey ? fetchHazardInfo(lat, lng).catch(() => EMPTY_HAZARD) : Promise.resolve(EMPTY_HAZARD),
    hasApiKey ? fetchEnvironmentInfo(lat, lng).catch(() => EMPTY_ENVIRONMENT) : Promise.resolve(EMPTY_ENVIRONMENT),
    safeFetchWeather(lat, lng),
  ]);

  // 4. Gemini 生成
  const records = apiData.data ?? [];
  const summary = calcSummary(records);
  const reportInput: AreaReportInput = {
    lat, lng,
    prefecture: records[0]?.prefecture ?? "",
    municipality: records[0]?.municipality ?? apiData.geocodedDistrict ?? "",
    cityCode: apiData.cityCode ?? "",
    years: apiData.years ?? [],
    ...summary,
    hazard,
    environment,
    weather,
    locale,
  };
  const aiReport = await generateAreaReport(reportInput).catch((err) => {
    console.error("[Gemini] 生成失敗:", err);
    return undefined;
  });

  if (!aiReport) {
    return c.json({ error: "Failed to generate AI report" }, 502);
  }

  // 5. キャッシュ更新（既存の取引データに aiReport をマージ）
  writeCache(lat, lng, zoom, apiData, aiReport, locale).catch((err) =>
    console.error("[GCS Cache] aiReport update failed:", err)
  );

  return c.json({ source: "api", aiReport });
});

export default app;
