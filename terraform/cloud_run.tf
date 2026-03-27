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

    scaling {
      min_instance_count = 0
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
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
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
        name  = "GCP_REGION"
        value = var.region
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

    scaling {
      min_instance_count = 0
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
          memory = "512Mi"
        }
        cpu_idle = true
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
