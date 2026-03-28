import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface SearchHistoryItem {
  id: string;
  lat: number;
  lng: number;
  prefecture: string;
  municipality: string;
  cityCode: string;
  years: number[];
  totalCount: number;
  avgTradePrice: number;
  avgUnitPrice: number;
  searchedAt: Timestamp;
  /** AI生成の暮らしイメージ画像（data URL or base64） */
  lifestyleImage?: string;
}

export interface SaveSearchHistoryData {
  lat: number;
  lng: number;
  prefecture: string;
  municipality: string;
  cityCode: string;
  years: number[];
  totalCount: number;
  avgTradePrice: number;
  avgUnitPrice: number;
}

/**
 * 検索履歴を保存する。cityCode をドキュメントIDとして使うことで
 * 同じ市区町村の履歴は常に上書き（重複防止）される。
 */
export async function saveSearchHistory(
  uid: string,
  data: SaveSearchHistoryData
): Promise<void> {
  const docRef = doc(db, "users", uid, "search_history", data.cityCode);
  await setDoc(docRef, {
    ...data,
    searchedAt: serverTimestamp(),
  });
}

/**
 * 生成した暮らしイメージ画像を Firebase Storage にアップロードし、
 * 取得した公開URLをFirestoreの履歴ドキュメントに保存する。
 * Base64 data URL をそのままFirestoreに入れると1MB制限を超えるためこの方式を採用。
 */
export async function updateLifestyleImage(
  uid: string,
  cityCode: string,
  imageDataUrl: string
): Promise<void> {
  // Storage: users/{uid}/images/{cityCode}.png にアップロード
  const storageRef = ref(storage, `users/${uid}/images/${cityCode}.png`);
  await uploadString(storageRef, imageDataUrl, "data_url");
  const downloadUrl = await getDownloadURL(storageRef);

  // Firestore: ダウンロードURLのみ保存（軽量）
  const docRef = doc(db, "users", uid, "search_history", cityCode);
  await updateDoc(docRef, { lifestyleImage: downloadUrl });
}

export function subscribeHistory(
  uid: string,
  callback: (items: SearchHistoryItem[]) => void
): () => void {
  const ref = collection(db, "users", uid, "search_history");
  const q = query(ref, orderBy("searchedAt", "desc"), limit(20));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SearchHistoryItem, "id">),
    }));
    callback(items);
  });
}
