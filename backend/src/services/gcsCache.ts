import { Storage } from "@google-cloud/storage";
import { config } from "../config";
import { buildCacheKey } from "../utils/tile";

const storage = new Storage({ projectId: config.gcp.projectId });

export interface CachedData {
  cacheKey: string;
  lat: number;
  lng: number;
  zoom: number;
  data: unknown;
  fetchedAt: string;
  expiresAt: string;
}

/**
 * GCSキャッシュのオブジェクトパスを生成
 * 例: cache/z15/x29094/y12898.json
 */
function objectPath(cacheKey: string): string {
  return `cache/${cacheKey}.json`;
}

/**
 * キャッシュが有効期限内かチェック
 */
function isValid(cached: CachedData): boolean {
  return new Date(cached.expiresAt) > new Date();
}

/**
 * GCSからキャッシュを読み込む
 * キャッシュが存在しないか期限切れの場合は null を返す
 */
export async function readCache(
  lat: number,
  lng: number,
  zoom: number = 15
): Promise<CachedData | null> {
  if (!config.gcs.bucketName) {
    console.log("[GCS Cache] SKIP: GCS_CACHE_BUCKET not configured");
    return null;
  }
  const cacheKey = buildCacheKey(lat, lng, zoom);
  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(objectPath(cacheKey));

  try {
    const [exists] = await file.exists();
    if (!exists) return null;

    const [contents] = await file.download();
    const cached: CachedData = JSON.parse(contents.toString("utf-8"));

    if (!isValid(cached)) {
      console.log(`[GCS Cache] EXPIRED: ${cacheKey}`);
      return null;
    }

    console.log(`[GCS Cache] HIT: ${cacheKey}`);
    return cached;
  } catch (err) {
    console.error(`[GCS Cache] Read error for ${cacheKey}:`, err);
    return null;
  }
}

/**
 * GCSにデータをキャッシュとして保存（非同期・fire-and-forget）
 */
export async function writeCache(
  lat: number,
  lng: number,
  zoom: number = 15,
  data: unknown
): Promise<void> {
  if (!config.gcs.bucketName) {
    console.log("[GCS Cache] SKIP write: GCS_CACHE_BUCKET not configured");
    return;
  }
  const cacheKey = buildCacheKey(lat, lng, zoom);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + config.cache.ttlDays);

  const payload: CachedData = {
    cacheKey,
    lat,
    lng,
    zoom,
    data,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(objectPath(cacheKey));

  try {
    await file.save(JSON.stringify(payload, null, 2), {
      contentType: "application/json",
      metadata: {
        cacheControl: `public, max-age=${config.cache.ttlDays * 86400}`,
      },
    });
    console.log(`[GCS Cache] WRITE: ${cacheKey} (expires: ${expiresAt.toISOString()})`);
  } catch (err) {
    // キャッシュ書き込み失敗はサービス継続に影響させない
    console.error(`[GCS Cache] Write error for ${cacheKey}:`, err);
  }
}
