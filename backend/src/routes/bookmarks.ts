import { Hono } from "hono";
import { z } from "zod";
import * as admin from "firebase-admin";
import { config } from "../config";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

const app = new Hono();

/**
 * Authorization: Bearer <Firebase ID Token> から uid を取り出すヘルパー。
 * 失敗時は Response (401) を返す — 呼び出し側は Result の判定で分岐する。
 */
async function verifyUid(authHeader: string | undefined): Promise<
  { ok: true; uid: string } | { ok: false; response: Response }
> {
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: Firebase auth required" }),
        { status: 401, headers: { "content-type": "application/json" } }
      ),
    };
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (err) {
    console.warn(
      "[Bookmarks] ID token verification failed:",
      err instanceof Error ? err.message : err
    );
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { "content-type": "application/json" } }
      ),
    };
  }
}

const createBodySchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lng: z.number().finite().gte(-180).lte(180),
  zoom: z.number().int().gte(1).lte(22),
  title: z.string().min(1).max(120),
});

// ──────────────────────────────────────────────────────────────
// GET /api/bookmarks
// Returns: { items: Array<{ id, lat, lng, zoom, title, createdAt }> }
// ──────────────────────────────────────────────────────────────
app.get("/", async (c) => {
  const auth = await verifyUid(c.req.header("authorization"));
  if (!auth.ok) return auth.response;

  try {
    const snap = await db
      .collection("bookmarks")
      .where("uid", "==", auth.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const items = snap.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt as admin.firestore.Timestamp | undefined;
      return {
        id: doc.id,
        lat: d.lat as number,
        lng: d.lng as number,
        zoom: d.zoom as number,
        title: (d.title as string) ?? "",
        createdAt: createdAt ? createdAt.toMillis() : null,
      };
    });
    return c.json({ items });
  } catch (err) {
    console.error("[Bookmarks] list error:", err);
    return c.json({ error: "ブックマークの取得に失敗しました" }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/bookmarks
// Body: { lat, lng, zoom, title }
// Returns: { id, lat, lng, zoom, title, createdAt }
// ──────────────────────────────────────────────────────────────
app.post("/", async (c) => {
  const auth = await verifyUid(c.req.header("authorization"));
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "入力が不正です", details: parsed.error.flatten() }, 400);
  }
  const { lat, lng, zoom, title } = parsed.data;

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection("bookmarks").add({
      uid: auth.uid,
      lat,
      lng,
      zoom,
      title: title.trim(),
      createdAt: now,
    });
    return c.json({
      id: docRef.id,
      lat,
      lng,
      zoom,
      title: title.trim(),
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[Bookmarks] create error:", err);
    return c.json({ error: "ブックマークの保存に失敗しました" }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/bookmarks/:id
// 所有者(uid)が一致する場合のみ削除
// ──────────────────────────────────────────────────────────────
app.delete("/:id", async (c) => {
  const auth = await verifyUid(c.req.header("authorization"));
  if (!auth.ok) return auth.response;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  try {
    const ref = db.collection("bookmarks").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return c.json({ error: "Not Found" }, 404);
    }
    if (snap.data()?.uid !== auth.uid) {
      // 他人のリソースは存在を秘匿するため 404 を返す
      return c.json({ error: "Not Found" }, 404);
    }
    await ref.delete();
    return c.json({ ok: true });
  } catch (err) {
    console.error("[Bookmarks] delete error:", err);
    return c.json({ error: "ブックマークの削除に失敗しました" }, 500);
  }
});

export default app;
