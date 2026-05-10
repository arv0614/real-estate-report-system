import type { Storage as StorageType, Bucket } from "@google-cloud/storage";
import { config } from "../config";
import { buildCacheKey } from "../utils/tile";

export interface CachedData {
  cacheKey: string;
  lat: number;
  lng: number;
  zoom: number;
  data: unknown;
  /** Gemini によるAIエリアレポート（マークダウン）。旧キャッシュには存在しない場合あり */
  aiReport?: string;
  fetchedAt: string;
  expiresAt: string;
}

/**
 * Storage クライアントを遅延初期化する。
 * 起動時に new Storage() を呼ぶと、認証ライブラリが credential を解決できない環境
 * (e.g. Cloud Run の SA に Storage 権限が無い、ADC が見つからない等) で
 * 初期化エラーが import タイミングで発生し、コンテナ全体が落ちる可能性がある。
 *
 * 遅延初期化 + try-catch にすることで、GCS が使えなくても API ハンドラは継続動作し
 * 「キャッシュなし → 都度 MLIT API から取得」の通常パスにフォールバックできる。
 */
let _storage: StorageType | null = null;
let _storageInitFailed = false;

async function getStorage(): Promise<StorageType | null> {
  if (_storage) return _storage;
  if (_storageInitFailed) return null;
  try {
    const { Storage } = await import("@google-cloud/storage");
    _storage = new Storage({ projectId: config.gcp.projectId });
    return _storage;
  } catch (err) {
    _storageInitFailed = true;
    console.error("[GCS Cache] Storage client init failed; cache disabled:", err);
    return null;
  }
}

async function getBucket(): Promise<Bucket | null> {
  if (!config.gcs.bucketName) return null;
  const storage = await getStorage();
  if (!storage) return null;
  try {
    return storage.bucket(config.gcs.bucketName);
  } catch (err) {
    console.error("[GCS Cache] bucket() failed; cache disabled:", err);
    return null;
  }
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
 * - キャッシュ無効・期限切れ・GCS エラーいずれの場合も null を返す
 * - 例外は呼び出し側に伝播させない（API ハンドラを止めないため）
 */
export async function readCache(
  lat: number,
  lng: number,
  zoom: number = 15,
  locale: string = "ja"
): Promise<CachedData | null> {
  if (!config.gcs.bucketName) {
    console.log("[GCS Cache] SKIP: GCS_CACHE_BUCKET not configured");
    return null;
  }
  const cacheKey = buildCacheKey(lat, lng, zoom, locale);

  try {
    const bucket = await getBucket();
    if (!bucket) return null;
    const file = bucket.file(objectPath(cacheKey));

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
    // 権限エラー (403) / バケット未作成 (404) / NW エラー / JSON パース失敗 等を
    // すべて呑み込んで null を返す。サービス継続を最優先する。
    console.error(`[GCS Cache] Read error for ${cacheKey}:`, err);
    return null;
  }
}

/**
 * GCSにデータをキャッシュとして保存（fire-and-forget）
 * 失敗しても呼び出し側に例外を投げない。
 */
export async function writeCache(
  lat: number,
  lng: number,
  zoom: number = 15,
  data: unknown,
  aiReport?: string,
  locale: string = "ja"
): Promise<void> {
  if (!config.gcs.bucketName) {
    console.log("[GCS Cache] SKIP write: GCS_CACHE_BUCKET not configured");
    return;
  }
  const cacheKey = buildCacheKey(lat, lng, zoom, locale);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + config.cache.ttlDays);

  const payload: CachedData = {
    cacheKey,
    lat,
    lng,
    zoom,
    data,
    ...(aiReport !== undefined ? { aiReport } : {}),
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    const bucket = await getBucket();
    if (!bucket) return;
    const file = bucket.file(objectPath(cacheKey));
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
