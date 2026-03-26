# ============================================
# BigQuery: 構造化キャッシュデータ
# ============================================
resource "google_bigquery_dataset" "realestate_cache" {
  dataset_id                  = var.bq_dataset_id
  project                     = var.project_id
  location                    = var.region
  description                 = "不動産APIキャッシュ・構造化データ格納用"
  delete_contents_on_destroy  = false

  labels = {
    env     = "production"
    purpose = "api-cache"
  }

  depends_on = [google_project_service.apis]
}

# 不動産取引価格データテーブル
resource "google_bigquery_table" "property_transactions" {
  dataset_id          = google_bigquery_dataset.realestate_cache.dataset_id
  table_id            = "property_transactions"
  project             = var.project_id
  deletion_protection = false

  description = "国交省API: 不動産取引価格情報キャッシュ"

  # 30日でパーティション期限切れ
  require_partition_filter = false

  time_partitioning {
    type          = "DAY"
    field         = "fetched_at"
    expiration_ms = var.cache_ttl_days * 24 * 60 * 60 * 1000
  }

  schema = jsonencode([
    { name = "cache_key", type = "STRING", mode = "REQUIRED", description = "タイル座標ベースのキャッシュキー" },
    { name = "lat", type = "FLOAT64", mode = "REQUIRED", description = "緯度" },
    { name = "lng", type = "FLOAT64", mode = "REQUIRED", description = "経度" },
    { name = "zoom", type = "INT64", mode = "REQUIRED", description = "ズームレベル" },
    { name = "tile_x", type = "INT64", mode = "REQUIRED", description = "タイルX座標" },
    { name = "tile_y", type = "INT64", mode = "REQUIRED", description = "タイルY座標" },
    { name = "prefecture_code", type = "STRING", mode = "NULLABLE", description = "都道府県コード" },
    { name = "transaction_price", type = "INT64", mode = "NULLABLE", description = "取引価格（円）" },
    { name = "area", type = "FLOAT64", mode = "NULLABLE", description = "面積（㎡）" },
    { name = "price_per_sqm", type = "FLOAT64", mode = "NULLABLE", description = "㎡単価（円）" },
    { name = "land_shape", type = "STRING", mode = "NULLABLE", description = "土地形状" },
    { name = "building_structure", type = "STRING", mode = "NULLABLE", description = "建物構造" },
    { name = "year_built", type = "INT64", mode = "NULLABLE", description = "築年数" },
    { name = "raw_data", type = "JSON", mode = "NULLABLE", description = "APIレスポンス生データ" },
    { name = "fetched_at", type = "TIMESTAMP", mode = "REQUIRED", description = "データ取得日時" },
    { name = "expires_at", type = "TIMESTAMP", mode = "REQUIRED", description = "キャッシュ有効期限" },
  ])
}

# Cloud Run SA に BigQuery アクセス権付与
resource "google_bigquery_dataset_iam_member" "bq_editor" {
  dataset_id = google_bigquery_dataset.realestate_cache.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
  project    = var.project_id
}

resource "google_project_iam_member" "bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
