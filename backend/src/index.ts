import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";
import { config } from "./config";
import propertyRoutes from "./routes/property";
import lemonSqueezyRoutes from "./routes/lemonsqueezy";
import posthogRoutes from "./routes/posthog";
import waitlistRoutes from "./routes/waitlist";

const app = new Hono();

// ミドルウェア
app.use("*", logger());
// セキュリティヘッダー (X-Content-Type-Options, X-Frame-Options 等)
app.use("*", secureHeaders());
const allowedOrigins = config.cors.allowedOrigins;
if (allowedOrigins.length === 0 && config.nodeEnv === "production") {
  console.warn("[Security] ALLOWED_ORIGINS が未設定です。本番環境では必ず設定してください。");
}
// ローカル開発用オリジンは常に追加（本番環境でも無害。localhost は外部からアクセス不可）
const devOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"];
const effectiveOrigins = allowedOrigins.length > 0 ? [...allowedOrigins, ...devOrigins] : [];
app.use(
  "*",
  cors({
    // ALLOWED_ORIGINS が設定されていれば許可リスト（localhost含む）を使用、未設定時は全許可（開発用のみ）
    origin: effectiveOrigins.length > 0 ? effectiveOrigins : "*",
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
    timestamp: new Date().toISOString(),
  })
);

// APIルート
app.route("/api/property", propertyRoutes);
app.route("/api/lemonsqueezy", lemonSqueezyRoutes);
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
