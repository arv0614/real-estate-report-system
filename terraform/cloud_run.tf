# ============================================
# Cloud Run: バックエンドAPIサービス
# ============================================
locals {
  image_url          = "${var.region}-docker.pkg.dev/${var.project_id}/realestate-api/backend:latest"
  frontend_image_url = "${var.region}-docker.pkg.dev/${var.project_id}/realestate-api/frontend:latest"
}

resource "google_cloud_run_v2_service" "api" {
  name     = var.cloud_run_service_name
  project  = var.project_id
  location = var.region

  template {
    service_account = google_service_account.cloud_run_sa.email

    # Hono はリクエストの大半を MLIT/Gemini などの外部 API 待ちで消費する I/O バウンドな
    # ワークロードのため、1インスタンスあたりの並行処理数を高めに設定してインスタンス数
    # （＝課金対象のCPU/メモリ確保時間）を抑える。
    max_instance_request_concurrency = 100

    scaling {
      min_instance_count = 0 # 夜間・アイドル時は完全に課金停止
      max_instance_count = 5
    }

    containers {
      image = local.image_url

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true # リクエスト処理中のみCPU割り当て（アイドル時課金ゼロ）
        startup_cpu_boost = true # コールドスタート時のみCPUを一時的にブーストし体感速度を維持
      }

      # NOTE: NODE_ENV=production は backend/Dockerfile の `ENV` で設定済みのため
      # Cloud Run の env には出さない（稼働中サービスにも無い）。
      # env ブロックの順序は稼働中サービスと一致させること（google_cloud_run_v2_service は
      # env を順序ありリストとして扱うため、順序が違うと apply が差分を出す）。
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCS_CACHE_BUCKET"
        value = var.cache_bucket_name
      }
      env {
        name  = "BQ_DATASET"
        value = var.bq_dataset_id
      }
      env {
        name  = "CACHE_TTL_DAYS"
        value = tostring(var.cache_ttl_days)
      }
      env {
        name  = "MLIT_API_KEY"
        value = var.mlit_api_key
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }
      env {
        name  = "ADMIN_EMAILS"
        value = var.admin_emails
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.firebase_project_id
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.realestate,
  ]
}

# 未認証アクセスを許可（MVP段階。本番ではCloud Armor等で保護）
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ============================================
# Cloud Run: フロントエンド（Next.js）
# ============================================
resource "google_cloud_run_v2_service" "frontend" {
  name     = var.frontend_cloud_run_service_name
  project  = var.project_id
  location = var.region

  template {
    service_account = google_service_account.cloud_run_sa.email

    # Next.js SSR も Hono と同様 I/O 待ち中心のため 80〜100 の範囲で明示設定。
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0 # 夜間・アイドル時は完全に課金停止
      max_instance_count = 3
    }

    containers {
      image = local.frontend_image_url

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi" # SSR + ISR 再生成のメモリ余裕を確保（512Mi運用でOOMリスクありのため引き上げ）
        }
        # cpu_idle = true: アイドル時課金ゼロを優先。ISR のバックグラウンド再生成
        # (standalone server が応答後に行う fire-and-forget の再生成処理) は
        # CPUスロットリングの影響を受け得るが、次リクエストが来た時点で古いキャッシュを
        # 返しつつ再生成が完了する stale-while-revalidate 挙動のため実害は小さいと判断し、
        # 本番で実際にこの設定のまま運用・検証済み。
        cpu_idle          = true
        startup_cpu_boost = true # コールドスタート時のみCPUを一時的にブーストし体感速度を維持
      }

      # e-Stat API キー。元は deploy.yml / deploy_frontend.sh が --set-env-vars で付与。
      # NEXT_PUBLIC_* のビルド時変数は Cloud Build 側 (cloudbuild.yaml) で焼き込むため
      # ここには出さない。稼働時に読む env はこの 1 件のみ。
      env {
        name  = "ESTAT_API_KEY"
        value = var.estat_api_key
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.realestate,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
