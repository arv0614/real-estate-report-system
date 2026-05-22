import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getApiBase } from "@/lib/api";

export interface Bookmark {
  id: string;
  lat: number;
  lng: number;
  zoom: number;
  title: string;
  createdAt: number | null;
}

/** 同じ地点の判定: 地図ピンと住所検索でも微妙に座標がぶれるので少しだけ吸収する。 */
const COORD_EPS = 1e-4;

export function sameCoords(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): boolean {
  return Math.abs(a.lat - b.lat) < COORD_EPS && Math.abs(a.lng - b.lng) < COORD_EPS;
}

async function authHeader(): Promise<Record<string, string>> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("not-authenticated");
  return { Authorization: `Bearer ${idToken}` };
}

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const res = await fetch(`${getApiBase()}/api/bookmarks`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`bookmarks fetch failed: ${res.status}`);
  const json = (await res.json()) as { items: Bookmark[] };
  return json.items;
}

export async function createBookmark(input: {
  lat: number;
  lng: number;
  zoom: number;
  title: string;
}): Promise<Bookmark> {
  const res = await fetch(`${getApiBase()}/api/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `bookmarks create failed: ${res.status}`);
  }
  return (await res.json()) as Bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/bookmarks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeader(),
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `bookmarks delete failed: ${res.status}`);
  }
}

/**
 * ブックマーク一覧と CRUD を扱う軽量フック。
 * uid が変わったとき (ログイン・ログアウト) に自動再フェッチする。
 * uid が null の場合は空配列のまま何もしない。
 */
export function useBookmarks(uid: string | null | undefined) {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchBookmarks();
      setItems(list);
    } catch (err) {
      console.error("[bookmarks] reload failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (input: { lat: number; lng: number; zoom: number; title: string }) => {
      const created = await createBookmark(input);
      setItems((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteBookmark(id);
    setItems((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { items, loading, error, reload, add, remove };
}
