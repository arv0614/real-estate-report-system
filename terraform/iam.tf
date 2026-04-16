# ============================================
# Cloud Run 用サービスアカウント（実行用）
# ============================================
resource "google_service_account" "cloud_run_sa" {
  account_id   = "realestate-api-sa"
  display_name = "Real Estate API - Cloud Run Service Account"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# ============================================
# GitHub Actions デプロイ用サービスアカウント
# ============================================
resource "google_service_account" "github_actions_sa" {
  account_id   = "github-actions-deployer"
  display_name = "GitHub Actions - CI/CD Deployer"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# Cloud Build ジョブ送信権限
resource "google_project_iam_member" "github_actions_cloudbuild" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# Cloud Run デプロイ権限
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# Artifact Registry イメージプッシュ権限
resource "google_project_iam_member" "github_actions_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# Cloud Run SA への act-as 権限（gcloud run deploy に必要）
resource "google_project_iam_member" "github_actions_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# Cloud Build が使う GCS バケットへのアクセス権限
resource "google_project_iam_member" "github_actions_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

# SA キーの出力（terraform apply 後に手動で JSON キーを発行し GitHub Secrets に登録する）
output "github_actions_sa_email" {
  description = "GitHub Actions デプロイ用 SA のメールアドレス（gcloud iam service-accounts keys create で JSON キーを生成すること）"
  value       = google_service_account.github_actions_sa.email
}
