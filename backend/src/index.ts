import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { config } from "./config";
import propertyRoutes from "./routes/property";
import stripeRoutes from "./routes/stripe";
import posthogRoutes from "./routes/posthog";
import waitlistRoutes from "./routes/waitlist";

const app = new Hono();

// ミドルウェア
app.use("*", logger());
const allowedOrigins = config.cors.allowedOrigins;
app.use(
  "*",
  cors({
    // ALLOWED_ORIGINS が設定されていれば許可リストを使用、未設定時は全許可（開発用）
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

// Rate Limiting: IPアドレスベース、15分間に100リクエストまで
// Cloud Run環境では x-forwarded-for にクライアントIPが入る
app.use(
  "/api/*",
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15分
    limit: 100,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "unknown",
    message: { error: "アクセスが集中しています。しばらく待ってから再度お試しください。" },
  })
);

// ヘルスチェック
app.get("/health", (c) =>
  c.json({
    status: "ok",
    env: config.nodeEnv,
    timestamp: new Date().toISOString(),
  })
);

// APIルート
app.route("/api/property", propertyRoutes);
app.route("/api/stripe", stripeRoutes);
app.route("/api/posthog", posthogRoutes);
app.route("/api/waitlist", waitlistRoutes);

// 404
app.notFound((c) => c.json({ error: "Not Found" }, 404));

// エラーハンドラ
app.onError((err, c) => {
  console.error("[Error]", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// サーバー起動
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`🏠 Real Estate API running on http://localhost:${info.port}`);
  console.log(`   NODE_ENV: ${config.nodeEnv}`);
  console.log(`   GCP Project: ${config.gcp.projectId || "(not set)"}`);
  console.log(`   GCS Bucket: ${config.gcs.bucketName || "(not set)"}`);
});

export default app;
