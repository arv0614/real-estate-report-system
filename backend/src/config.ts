import * as dotenv from "dotenv";
import * as path from "path";

// プロジェクトルートの .env を読み込む
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT ?? "8080", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  gcp: {
    projectId: process.env.GCP_PROJECT_ID ?? "",
    region: process.env.GCP_REGION ?? "asia-northeast1",
  },

  // Firebase プロジェクト（GCP プロジェクトと別の場合がある）
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? "",
  },

  gcs: {
    bucketName: process.env.GCS_CACHE_BUCKET ?? "",
  },

  bigquery: {
    dataset: process.env.BQ_DATASET ?? "realestate_cache",
    table: process.env.BQ_TABLE ?? "property_transactions",
  },

  cache: {
    ttlDays: parseInt(process.env.CACHE_TTL_DAYS ?? "30", 10),
  },

  mlit: {
    apiKey: process.env.MLIT_API_KEY ?? "",
    baseUrl:
      process.env.MLIT_API_BASE_URL ??
      "https://www.reinfolib.mlit.go.jp/ex-api/external",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceId: process.env.STRIPE_PRICE_ID ?? "",
    successUrl: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:3000/?payment=success",
    cancelUrl: process.env.STRIPE_CANCEL_URL ?? "http://localhost:3000/?payment=cancel",
  },

  posthog: {
    webhookSecret: process.env.POSTHOG_WEBHOOK_SECRET ?? "",
  },

  cors: {
    // カンマ区切りで複数オリジン指定可。未設定時は全許可（開発用フォールバック）
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : [],
  },
} as const;
