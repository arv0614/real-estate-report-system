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
