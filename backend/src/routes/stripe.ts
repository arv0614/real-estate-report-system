import { Hono } from "hono";
import Stripe from "stripe";
import * as admin from "firebase-admin";
import { config } from "../config";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
// GCP プロジェクト（Cloud Run 等）と Firebase プロジェクトが異なる場合があるため
// FIREBASE_PROJECT_ID を優先して使用する
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.firebase.projectId || undefined,
  });
}
const db = admin.firestore();

// ── Stripe クライアント ───────────────────────────────────────
function getStripe(): Stripe {
  if (!config.stripe.secretKey) {
    throw new Error("STRIPE_SECRET_KEY が設定されていません");
  }
  return new Stripe(config.stripe.secretKey, { apiVersion: "2026-03-25.dahlia" });
}

const app = new Hono();

// ──────────────────────────────────────────────────────────────
// POST /api/stripe/create-checkout-session
// Header: Authorization: Bearer <Firebase ID Token>
// Body: { email?: string }
// Returns: { url: string }
// ──────────────────────────────────────────────────────────────
app.post("/create-checkout-session", async (c) => {
  if (!config.stripe.secretKey) {
    return c.json({ error: "Stripe is not configured" }, 503);
  }
  if (!config.stripe.priceId) {
    return c.json({ error: "STRIPE_PRICE_ID が設定されていません" }, 503);
  }

  // ── Firebase ID トークン検証（認証必須） ────────────────────
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Firebase auth required" }, 401);
  }
  const idToken = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    console.warn("[Stripe] ID token verification failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { email } = body;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      client_reference_id: uid,
      ...(email ? { customer_email: email } : {}),
      success_url: config.stripe.successUrl,
      cancel_url: config.stripe.cancelUrl,
      metadata: { uid },
    });

    if (!session.url) {
      return c.json({ error: "Checkout URLの生成に失敗しました" }, 500);
    }
    return c.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe] create-checkout-session error:", err);
    return c.json({ error: "決済セッションの作成に失敗しました" }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/stripe/webhook
// Stripe が送信する Webhook イベントを受信・処理する
// ──────────────────────────────────────────────────────────────
app.post("/webhook", async (c) => {
  // Webhook 検証のため生の body bytes を取得する（JSON.parse より前に読む）
  const rawBody = await c.req.raw.clone().arrayBuffer();
  const rawBodyBuffer = Buffer.from(rawBody);

  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "stripe-signature header is missing" }, 400);
  }
  if (!config.stripe.webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET が未設定です");
    return c.json({ error: "Webhook secret not configured" }, 503);
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      rawBodyBuffer,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    console.error("[Stripe Webhook] 署名検証エラー:", err);
    return c.json({ error: "Webhook signature verification failed" }, 400);
  }

  console.log(`[Stripe Webhook] event: ${event.type}`);

  // checkout.session.completed → Firestore の plan を "pro" に更新
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.client_reference_id ?? session.metadata?.uid;

    if (!uid) {
      console.error("[Stripe Webhook] uid が取得できません:", session.id);
      // 200 を返さないと Stripe がリトライし続けるため 200 で返す
      return c.json({ received: true, warning: "uid not found" });
    }

    try {
      await db.collection("users").doc(uid).set(
        {
          plan: "pro",
          stripeCustomerId: session.customer ?? null,
          stripeSubscriptionId: session.subscription ?? null,
          planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`[Stripe Webhook] uid=${uid} を pro プランに更新しました`);
    } catch (err) {
      console.error("[Stripe Webhook] Firestore 更新エラー:", err);
      // Firestore エラーは 500 を返して Stripe にリトライさせる
      return c.json({ error: "Firestore update failed" }, 500);
    }
  }

  // customer.subscription.deleted → Proプラン停止時に free に戻す
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const uid = subscription.metadata?.uid;
    if (uid) {
      try {
        await db.collection("users").doc(uid).set(
          { plan: "free", stripeSubscriptionId: null },
          { merge: true }
        );
        console.log(`[Stripe Webhook] uid=${uid} を free プランに戻しました`);
      } catch (err) {
        console.error("[Stripe Webhook] Firestore downgrade エラー:", err);
        return c.json({ error: "Firestore update failed" }, 500);
      }
    }
  }

  return c.json({ received: true });
});

export default app;
