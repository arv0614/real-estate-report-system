# ============================================
# Cloud Run 用サービスアカウント
# ============================================
resource "google_service_account" "cloud_run_sa" {
  account_id   = "realestate-api-sa"
  display_name = "Real Estate API - Cloud Run Service Account"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}
