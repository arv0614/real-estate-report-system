import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { config } from "./config";
import propertyRoutes from "./routes/property";

const app = new Hono();

// ミドルウェア
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*", // MVP段階。本番ではオリジンを制限すること
    allowMethods: ["GET", "POST", "OPTIONS"],
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
