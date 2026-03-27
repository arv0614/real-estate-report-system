import {
  collection,
  addDoc,
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

export async function saveSearchHistory(
  uid: string,
  data: SaveSearchHistoryData
): Promise<void> {
  const ref = collection(db, "users", uid, "search_history");
  await addDoc(ref, {
    ...data,
    searchedAt: serverTimestamp(),
  });
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
