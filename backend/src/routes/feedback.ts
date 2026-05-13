import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { z } from "zod";
import * as admin from "firebase-admin";
import { config } from "../config";
import { generateFeedbackPrompt, type FeedbackType } from "../services/geminiApi";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

const app = new Hono();

// ── ルート個別レートリミット ─────────────────────────────────
// グローバルレートリミット (15分100req) に加えて、
// フィードバック送信は1時間に10件まで（IPベース）に制限。
// AI生成を伴うためコスト保護とスパム対策の二重防衛。
app.use(
  "*",
  rateLimiter({
    windowMs: 60 * 60 * 1000, // 1時間
    limit: 10,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "unknown",
    message: { error: "フィードバックの送信回数が上限に達しました。1時間後に再度お試しください。" },
  })
);

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  type: z.enum(["bug", "feature", "other"]),
});

/**
 * POST /api/feedback
 * 認証必須: Authorization: Bearer <Firebase ID Token>
 * Body: { message: string, type: "bug"|"feature"|"other" }
 *
 * 1. Firebase ID トークンで認証
 * 2. Gemini で「Claude Code 向け要件定義書プロンプト」を生成
 * 3. Firestore `feedbacks` コレクションに保存
 */
app.post("/", async (c) => {
  // ── 認証チェック ─────────────────────────────────────
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Firebase auth required" }, 401);
  }
  const idToken = authHeader.slice(7);
  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email;
  } catch (err) {
    console.warn("[Feedback] ID token verification failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  // ── 入力バリデーション ────────────────────────────────
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "入力が不正です", details: parsed.error.flatten() }, 400);
  }
  const { message, type } = parsed.data;

  // ── Gemini で要件定義書プロンプトを生成 ────────────────
  // 生成失敗時でも原文は失わないように、aiPrompt を null として Firestore に保存する
  let aiPrompt: string | null = null;
  let aiError: string | null = null;
  try {
    aiPrompt = await generateFeedbackPrompt(type as FeedbackType, message);
  } catch (err) {
    aiError = err instanceof Error ? err.message : String(err);
    console.error("[Feedback] Gemini 生成失敗:", aiError);
  }

  // ── Firestore に保存 ────────────────────────────────
  try {
    const docRef = await db.collection("feedbacks").add({
      uid,
      email: email ?? null,
      type,
      message,
      aiPrompt,
      aiError,
      status: "new",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Feedback] 保存完了: docId=${docRef.id}, uid=${uid}, type=${type}`);
    return c.json({ ok: true, id: docRef.id });
  } catch (err) {
    console.error("[Feedback] Firestore 書き込みエラー:", err);
    return c.json({ error: "送信に失敗しました。しばらく後にお試しください。" }, 500);
  }
});

export default app;
