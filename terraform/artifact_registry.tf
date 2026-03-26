# ============================================
# Artifact Registry: コンテナイメージ管理
# ============================================
resource "google_artifact_registry_repository" "realestate" {
  provider      = google
  project       = var.project_id
  location      = var.region
  repository_id = "realestate-api"
  description   = "不動産レポートシステム - コンテナイメージ"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}
