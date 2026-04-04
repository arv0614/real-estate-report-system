/**
 * 暮らしイメージのロケーションキャッシュ
 * Firestore: lifestyle_cache/{cityCode}
 * Storage:   lifestyle_cache/{cityCode}.png
 *
 * 個人ではなく位置情報（市区町村コード）単位でキャッシュする。
 * free/pro 両プランに表示され、pro は自動生成・再生成が可能。
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface LifestyleCacheDoc {
  imageUrl: string;
  prefecture: string;
  municipality: string;
  createdAt: unknown;
}

/**
 * キャッシュ済み画像の URL を取得する（なければ null）。
 * 未ログインでも Firestore ルール次第で読み取り可能。
 */
export async function getLifestyleCache(cityCode: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "lifestyle_cache", cityCode));
    if (!snap.exists()) return null;
    return (snap.data() as LifestyleCacheDoc).imageUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * 生成した画像をロケーションキャッシュとして保存し、ダウンロード URL を返す。
 * Storage にアップロード後、Firestore にメタデータと URL を保存する。
 */
export async function saveLifestyleCache(
  cityCode: string,
  imageDataUrl: string,
  prefecture: string,
  municipality: string
): Promise<string> {
  const storageRef = ref(storage, `lifestyle_cache/${cityCode}.png`);
  await uploadString(storageRef, imageDataUrl, "data_url");
  const downloadUrl = await getDownloadURL(storageRef);

  await setDoc(
    doc(db, "lifestyle_cache", cityCode),
    {
      imageUrl: downloadUrl,
      prefecture,
      municipality,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return downloadUrl;
}
