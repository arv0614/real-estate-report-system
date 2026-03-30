import { Hono } from "hono";
import { z } from "zod";
import * as admin from "firebase-admin";
import { config } from "../config";

// Firebase Admin 初期化（冪等）
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

const app = new Hono();

const bodySchema = z.object({
  email: z.string().email(),
  source: z.string().default("limit_reached_modal"),
  uid: z.string().optional(),
});

/**
 * POST /api/waitlist
 * メールアドレスを Firestore `waitlist` コレクションに保存する。
 * 同一メールの重複登録は上書き（merge: true）で許容。
 */
app.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "メールアドレスが正しくありません", details: parsed.error.flatten() }, 400);
  }

  const { email, source, uid } = parsed.data;

  // Firestore のドキュメントIDはメールを sanitize したもの（@ . を _ に変換）
  const docId = email.replace(/[^a-zA-Z0-9]/g, "_");

  try {
    await db.collection("waitlist").doc(docId).set(
      {
        email,
        source,
        uid: uid ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`[Waitlist] 登録: ${email} (source=${source})`);
    return c.json({ ok: true });
  } catch (err) {
    console.error("[Waitlist] Firestore 書き込みエラー:", err);
    return c.json({ error: "登録に失敗しました。しばらく後にお試しください。" }, 500);
  }
});

export default app;
