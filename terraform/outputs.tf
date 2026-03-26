output "cloud_run_url" {
  description = "Cloud Run サービスのURL"
  value       = google_cloud_run_v2_service.api.uri
}

output "gcs_cache_bucket" {
  description = "GCSキャッシュバケット名"
  value       = google_storage_bucket.cache.name
}

output "artifact_registry_repo" {
  description = "Artifact Registry リポジトリURL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/realestate-api"
}

output "service_account_email" {
  description = "Cloud Run サービスアカウント"
  value       = google_service_account.cloud_run_sa.email
}

output "bigquery_dataset" {
  description = "BigQuery データセット"
  value       = "${var.project_id}.${google_bigquery_dataset.realestate_cache.dataset_id}"
}
