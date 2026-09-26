# ============================================
# GCS: 不動産APIキャッシュ用バケット
# ============================================
resource "google_storage_bucket" "cache" {
  name          = var.cache_bucket_name
  project       = var.project_id
  location      = var.region
  force_destroy = false

  # 不動産取引キャッシュ（backend/src/services/gcsCache.ts、`cache/` 配下）の自動削除。
  # matches_prefix で明示的にスコープしないと、下の seo-images/ ルールと合わせてバケット全体に
  # 掛かってしまい、10年保持したい SEO 画像キャッシュまで37日で消えてしまう（実際に過去
  # そうなっていた: プレフィックス無しの単一ルールが全オブジェクトに適用されていた）。
  lifecycle_rule {
    condition {
      age            = var.cache_ttl_days + 7 # TTL + 7日の猶予
      matches_prefix = ["cache/"]
    }
    action {
      type = "Delete"
    }
  }

  # SEO暮らしイメージ画像キャッシュ（backend/src/services/seoImageCache.ts、`seo-images/` 配下）。
  # Gemini 画像生成のコストが高いため意図的に長期保持（CACHE_TTL_DAYS = 3650日 = 10年、要同期）。
  # このルールが無いと上の cache/ ルール相当の短期TTLで巻き込み削除され、毎回課金再生成される。
  lifecycle_rule {
    condition {
      age            = 3650 + 7
      matches_prefix = ["seo-images/"]
    }
    action {
      type = "Delete"
    }
  }

  # 失敗・中断したマルチパートアップロードの残骸が課金対象のまま蓄積するのを防ぐ。
  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "AbortIncompleteMultipartUpload"
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
