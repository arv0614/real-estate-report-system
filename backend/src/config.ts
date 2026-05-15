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

  lemonSqueezy: {
    apiKey: process.env.LEMONSQUEEZY_API_KEY ?? "",
    storeId: process.env.LEMONSQUEEZY_STORE_ID ?? "",
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID ?? "",
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "",
    successUrl: process.env.LEMONSQUEEZY_SUCCESS_URL ?? "http://localhost:3000/?payment=success",
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

  admin: {
    // ADMIN_EMAILS=foo@example.com,bar@example.com 形式。カンマ区切り、空白除去、小文字化。
    emails: (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  },
} as const;

/** メールアドレスが管理者として登録されているか判定する（大文字小文字非区別） */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return config.admin.emails.includes(email.toLowerCase());
}
