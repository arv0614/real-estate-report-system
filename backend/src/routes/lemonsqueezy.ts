import { Hono } from "hono";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { config } from "../config";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.firebase.projectId || undefined,
  });
}
const db = admin.firestore();

const app = new Hono();

// ──────────────────────────────────────────────────────────────
// POST /api/lemonsqueezy/create-checkout
// Header: Authorization: Bearer <Firebase ID Token>
// Returns: { url: string }
// ──────────────────────────────────────────────────────────────
app.post("/create-checkout", async (c) => {
  if (!config.lemonSqueezy.apiKey) {
    return c.json({ error: "LEMONSQUEEZY_API_KEY が設定されていません" }, 503);
  }
  if (!config.lemonSqueezy.storeId || !config.lemonSqueezy.variantId) {
    return c.json({ error: "LEMONSQUEEZY_STORE_ID / VARIANT_ID が設定されていません" }, 503);
  }

  // ── Firebase ID トークン検証 ────────────────────────────────
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
    console.warn("[LS] ID token verification failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  try {
    lemonSqueezySetup({ apiKey: config.lemonSqueezy.apiKey });

    const checkout = await createCheckout(
      config.lemonSqueezy.storeId,
      config.lemonSqueezy.variantId,
      {
        checkoutData: {
          email: email ?? undefined,
          // Webhook でユーザーを特定するために uid を埋め込む
          custom: { uid },
        },
        checkoutOptions: {
          // チェックアウトページの言語は自動判定
        },
        productOptions: {
          redirectUrl: config.lemonSqueezy.successUrl,
        },
      }
    );

    const url = checkout.data?.data?.attributes?.url;
    if (!url) {
      console.error("[LS] create-checkout: URL が取得できませんでした", checkout);
      return c.json({ error: "チェックアウトURLの生成に失敗しました" }, 500);
    }

    return c.json({ url });
  } catch (err) {
    console.error("[LS] create-checkout error:", err);
    return c.json({ error: "決済セッションの作成に失敗しました" }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/lemonsqueezy/webhook
// Lemon Squeezy から送信される Webhook を受信・処理する
// ──────────────────────────────────────────────────────────────
app.post("/webhook", async (c) => {
  if (!config.lemonSqueezy.webhookSecret) {
    console.error("[LS Webhook] LEMONSQUEEZY_WEBHOOK_SECRET が未設定です");
    return c.json({ error: "Webhook secret not configured" }, 503);
  }

  // 署名検証のため生の body bytes を取得
  const rawBody = await c.req.raw.clone().arrayBuffer();
  const rawBodyBuffer = Buffer.from(rawBody);

  // ── HMAC-SHA256 署名検証 ──────────────────────────────────
  const signature = c.req.header("x-signature");
  if (!signature) {
    return c.json({ error: "x-signature header is missing" }, 400);
  }
  const expected = crypto
    .createHmac("sha256", config.lemonSqueezy.webhookSecret)
    .update(rawBodyBuffer)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
    console.warn("[LS Webhook] 署名不一致 — 不正なリクエストの可能性があります");
    return c.json({ error: "Webhook signature verification failed" }, 400);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBodyBuffer.toString("utf-8"));
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const meta = payload.meta as Record<string, unknown> | undefined;
  const eventName = meta?.event_name as string | undefined;
  const customData = meta?.custom_data as Record<string, unknown> | undefined;
  const uid = customData?.uid as string | undefined;

  console.log(`[LS Webhook] event: ${eventName}, uid: ${uid ?? "(none)"}`);

  // ── subscription_created / subscription_updated → pro に昇格 ─
  if (
    eventName === "subscription_created" ||
    eventName === "subscription_updated"
  ) {
    if (!uid) {
      console.error("[LS Webhook] uid が取得できません。custom_data:", customData);
      // 200 を返して Lemon Squeezy のリトライを防ぐ
      return c.json({ received: true, warning: "uid not found in custom_data" });
    }

    const data = payload.data as Record<string, unknown> | undefined;
    const attrs = data?.attributes as Record<string, unknown> | undefined;
    const customerId = attrs?.customer_id;
    const subscriptionId = data?.id;
    const status = attrs?.status as string | undefined;

    // ステータスが active / trialing のときのみ pro に昇格
    const isActive = !status || status === "active" || status === "trialing";

    try {
      await db.collection("users").doc(uid).set(
        {
          plan: isActive ? "pro" : "free",
          lemonSqueezyCustomerId: customerId ?? null,
          lemonSqueezySubscriptionId: subscriptionId ?? null,
          planActivatedAt: isActive ? admin.firestore.FieldValue.serverTimestamp() : null,
        },
        { merge: true }
      );
      console.log(`[LS Webhook] uid=${uid} plan=${isActive ? "pro" : "free"} に更新`);
    } catch (err) {
      console.error("[LS Webhook] Firestore 更新エラー:", err);
      return c.json({ error: "Firestore update failed" }, 500);
    }
  }

  // ── subscription_expired / subscription_cancelled → free に戻す ─
  if (
    eventName === "subscription_expired" ||
    eventName === "subscription_cancelled"
  ) {
    if (uid) {
      try {
        await db.collection("users").doc(uid).set(
          { plan: "free", lemonSqueezySubscriptionId: null },
          { merge: true }
        );
        console.log(`[LS Webhook] uid=${uid} を free プランに戻しました`);
      } catch (err) {
        console.error("[LS Webhook] Firestore downgrade エラー:", err);
        return c.json({ error: "Firestore update failed" }, 500);
      }
    }
  }

  return c.json({ received: true });
});

export default app;
