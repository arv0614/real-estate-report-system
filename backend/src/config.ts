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
} as const;
