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
import { db } from "@/lib/firebase";

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
 * 生成した暮らしイメージ画像をFirestoreの履歴ドキュメントに保存する。
 * cityCode をドキュメントIDとして使用。
 */
export async function updateLifestyleImage(
  uid: string,
  cityCode: string,
  imageDataUrl: string
): Promise<void> {
  const docRef = doc(db, "users", uid, "search_history", cityCode);
  await updateDoc(docRef, { lifestyleImage: imageDataUrl });
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
