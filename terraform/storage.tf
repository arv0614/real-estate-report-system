# ============================================
# GCS: 不動産APIキャッシュ用バケット
# ============================================
resource "google_storage_bucket" "cache" {
  name          = var.cache_bucket_name
  project       = var.project_id
  location      = var.region
  force_destroy = false

  # キャッシュファイルの自動削除（TTL超過分）
  lifecycle_rule {
    condition {
      age = var.cache_ttl_days + 7 # TTL + 7日の猶予
    }
    action {
      type = "Delete"
    }
  }

  # バージョニング（意図しないデータ損失防止）
  versioning {
    enabled = false
  }

  # 均一バケットアクセス（ACL不要）
  uniform_bucket_level_access = true

  labels = {
    env     = "production"
    purpose = "api-cache"
  }

  depends_on = [google_project_service.apis]
}

# Cloud Run SA にキャッシュバケットへのアクセス権を付与
resource "google_storage_bucket_iam_member" "cache_rw" {
  bucket = google_storage_bucket.cache.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
