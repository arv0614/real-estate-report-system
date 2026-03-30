import { Hono } from "hono";
import * as admin from "firebase-admin";
import { config } from "../config";

// Firebase Admin は stripe.ts で初期化済みのため冪等チェックのみ
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.firebase.projectId || undefined,
  });
}
const db = admin.firestore();

const app = new Hono();

// ──────────────────────────────────────────────────────────────
// POST /api/posthog/survey-webhook
// PostHog HogFunction から呼ばれる。
// Survey 回答（メールアドレス）を Firestore waitlist に保存する。
//
// Body: { email, survey_id, survey_name, distinct_id }
// Header: X-Webhook-Secret: <POSTHOG_WEBHOOK_SECRET>
// ──────────────────────────────────────────────────────────────
app.post("/survey-webhook", async (c) => {
  // ── シークレット検証（必須） ──────────────────────────────
  const expectedSecret = config.posthog.webhookSecret;
  if (!expectedSecret) {
    console.error("[PostHog Webhook] POSTHOG_WEBHOOK_SECRET が未設定です。リクエストを拒否します。");
    return c.json({ error: "Webhook not configured" }, 503);
  }
  const receivedSecret = c.req.header("x-webhook-secret") ?? "";
  if (receivedSecret !== expectedSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // ── ペイロード解析 ────────────────────────────────────────
  let body: { email?: string; survey_id?: string; survey_name?: string; distinct_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Invalid email" }, 400);
  }

  // ── Firestore waitlist に保存（upsert） ───────────────────
  try {
    const docId = email.replace(/[^a-zA-Z0-9]/g, "_");
    await db.collection("waitlist").doc(docId).set(
      {
        email,
        source: "posthog_survey",
        surveyId: body.survey_id ?? null,
        surveyName: body.survey_name ?? null,
        distinctId: body.distinct_id ?? null,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.info(`[PostHog Survey] waitlist saved: ${email}`);
    return c.json({ ok: true });
  } catch (err) {
    console.error("[PostHog Survey] Firestore write error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
