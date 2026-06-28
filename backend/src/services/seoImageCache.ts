import * as admin from "firebase-admin";
import { config } from "../config";

const CACHE_TTL_DAYS = 3650; // 10年
const FIRESTORE_COLLECTION = "seo_lifestyle_cache";

interface SeoImageDoc {
  gcsPath: string;
  mimeType: string;
  generatedAt: admin.firestore.Timestamp;
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: config.firebase.projectId || undefined });
  }
  return admin;
}

function docId(prefSlug: string, citySlug: string) {
  return `${prefSlug}_${citySlug}`;
}

export function gcsImagePath(prefSlug: string, citySlug: string) {
  return `seo-images/lifestyles/${prefSlug}_${citySlug}.jpg`;
}

/**
 * Firestoreキャッシュをチェック。
 * 存在かつ10年以内 → { gcsPath, mimeType } を返す
 * 存在しないか期限切れ → null
 */
export async function checkSeoImageCache(
  prefSlug: string,
  citySlug: string,
): Promise<{ gcsPath: string; mimeType: string } | null> {
  try {
    const a = initAdmin();
    const snap = await a.firestore()
      .collection(FIRESTORE_COLLECTION)
      .doc(docId(prefSlug, citySlug))
      .get();

    if (!snap.exists) return null;

    const data = snap.data() as SeoImageDoc;
    const generatedAt = data.generatedAt?.toDate() ?? new Date(0);
    const ageDays = (Date.now() - generatedAt.getTime()) / 86400000;

    if (ageDays > CACHE_TTL_DAYS) {
      console.log(`[SeoCache] EXPIRED: ${docId(prefSlug, citySlug)} (${ageDays.toFixed(1)} days old)`);
      return null;
    }

    console.log(`[SeoCache] HIT: ${docId(prefSlug, citySlug)} (${ageDays.toFixed(1)} days old)`);
    return { gcsPath: data.gcsPath, mimeType: data.mimeType || "image/jpeg" };
  } catch (err) {
    console.error("[SeoCache] checkSeoImageCache failed:", err);
    return null;
  }
}

/**
 * 画像をGCSに保存し、Firestoreにメタデータを記録する
 */
export async function saveSeoImageCache(
  prefSlug: string,
  citySlug: string,
  imageBase64: string,
  mimeType: string,
): Promise<string | null> {
  if (!config.gcs.bucketName) {
    console.warn("[SeoCache] GCS_CACHE_BUCKET not configured — skipping cache save");
    return null;
  }

  try {
    const a = initAdmin();
    const path = gcsImagePath(prefSlug, citySlug);

    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage({ projectId: config.gcp.projectId });
    await storage.bucket(config.gcs.bucketName).file(path).save(
      Buffer.from(imageBase64, "base64"),
      { contentType: mimeType, metadata: { cacheControl: "public, max-age=2592000" } },
    );

    await a.firestore()
      .collection(FIRESTORE_COLLECTION)
      .doc(docId(prefSlug, citySlug))
      .set({
        gcsPath: path,
        mimeType,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log(`[SeoCache] SAVED: ${docId(prefSlug, citySlug)} → gs://${config.gcs.bucketName}/${path}`);
    return path;
  } catch (err) {
    console.error("[SeoCache] saveSeoImageCache failed:", err);
    return null;
  }
}

/**
 * GCSから画像バイトを読み込む
 */
export async function readSeoImageFromGcs(gcsPath: string): Promise<Buffer | null> {
  if (!config.gcs.bucketName) return null;

  try {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage({ projectId: config.gcp.projectId });
    const [buffer] = await storage.bucket(config.gcs.bucketName).file(gcsPath).download();
    return buffer;
  } catch (err) {
    console.error(`[SeoCache] readSeoImageFromGcs failed for ${gcsPath}:`, err);
    return null;
  }
}
