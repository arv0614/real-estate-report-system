variable "project_id" {
  description = "GCP プロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "cache_bucket_name" {
  description = "不動産APIキャッシュ用GCSバケット名"
  type        = string
}

variable "bq_dataset_id" {
  description = "BigQueryデータセットID"
  type        = string
  default     = "realestate_cache"
}

variable "cloud_run_service_name" {
  description = "Cloud Runサービス名"
  type        = string
  default     = "realestate-api"
}

variable "cache_ttl_days" {
  description = "GCSキャッシュの有効期限（日数）"
  type        = number
  default     = 30
}

variable "frontend_cloud_run_service_name" {
  description = "フロントエンド Cloud Run サービス名"
  type        = string
  default     = "realestate-frontend"
}

# ─────────────────────────────────────────────────────────────────────
# Cloud Run コンテナに注入する追加の環境変数。
# これらは元々 scripts/deploy.sh / GitHub Actions の `gcloud run deploy
# --set-env-vars` で後付けされており Terraform 管理外だった。稼働中の値と
# 一致させて `terraform apply` を no-op に保つため、ここで宣言する。
# 値はコミットしない terraform.tfvars（.gitignore 済み）または TF_VAR_* /
# scripts/terraform_apply.sh の .env 連携で与える。
# 将来のハードニング: API キー類は google_secret_manager_secret + env の
# value_source.secret_key_ref へ移行するのが望ましい（憲法§3）。
# ─────────────────────────────────────────────────────────────────────

variable "mlit_api_key" {
  description = "国土交通省 不動産情報ライブラリ API キー (バックエンド MLIT_API_KEY)"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Gemini API キー (バックエンド GEMINI_API_KEY)"
  type        = string
  sensitive   = true
}

variable "estat_api_key" {
  description = "e-Stat API キー (フロントエンド ESTAT_API_KEY)"
  type        = string
  sensitive   = true
}

variable "allowed_origins" {
  description = "バックエンド CORS 許可オリジン (カンマ区切り, ALLOWED_ORIGINS)"
  type        = string
}

variable "admin_emails" {
  description = "管理画面 /admin の許可メールアドレス (カンマ区切り, ADMIN_EMAILS)"
  type        = string
}

variable "firebase_project_id" {
  description = "Firestore / Firebase Auth のプロジェクト ID (FIREBASE_PROJECT_ID, bf134 側)"
  type        = string
}
