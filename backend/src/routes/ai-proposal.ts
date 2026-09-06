import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { z } from "zod";
import * as admin from "firebase-admin";
import { config } from "../config";
import { generateCustomerProposal } from "../services/geminiApi";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

const app = new Hono();

// ── ルート個別レートリミット ─────────────────────────────────
// グローバルレートリミット (15分100req) に加えて、AI生成を伴うためコスト保護として
// 1時間20件まで（IPベース）に制限する（feedback.ts と同様の二重防衛）。
app.use(
  "*",
  rateLimiter({
    windowMs: 60 * 60 * 1000, // 1時間
    limit: 20,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "unknown",
    message: { error: "生成回数が上限に達しました。1時間後に再度お試しください。" },
  })
);

const bodySchema = z.object({
  targetProfile: z.string().trim().min(1).max(1000),
  budget: z.string().trim().min(1).max(300),
  targetArea: z.string().trim().min(1).max(50),
  locale: z.enum(["ja", "en"]).optional(),
});

/**
 * POST /api/pro/generate-proposal
 * 認証必須: Authorization: Bearer <Firebase ID Token>。Pro プラン限定機能。
 * Body: { targetProfile: string, budget: string, locale?: "ja"|"en" }
 * Returns: { areas: Array<{ areaName, reasons, salesScript, catchcopy }> }
 *
 * 未認証 → 401 / 認証済みだが Pro でない → 403 で弾く（フロントの表示上の
 * ペイウォールとは独立に、バックエンド側でも必ずプランを検証する）。
 */
app.post("/generate-proposal", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Firebase auth required" }, 401);
  }

  let uid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch (err) {
    console.warn(
      "[AiProposal] ID token verification failed:",
      err instanceof Error ? err.message : err
    );
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  // ── Pro プラン限定 ────────────────────────────────────
  let plan = "free";
  try {
    const snap = await db.collection("users").doc(uid).get();
    plan = (snap.exists ? (snap.data()?.plan as string | undefined) : undefined) ?? "free";
  } catch (err) {
    console.error("[AiProposal] plan lookup failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Failed to verify plan" }, 500);
  }
  if (plan !== "pro") {
    return c.json(
      { error: "Forbidden: This feature is available on the Pro plan only" },
      403
    );
  }

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

  try {
    const result = await generateCustomerProposal(parsed.data);
    return c.json(result);
  } catch (err) {
    console.error("[AiProposal] Gemini 生成失敗:", err instanceof Error ? err.message : err);
    return c.json({ error: "提案の生成に失敗しました。しばらく後にお試しください。" }, 500);
  }
});

export default app;
