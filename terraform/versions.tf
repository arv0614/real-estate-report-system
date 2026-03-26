terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # 本番運用時は GCS バックエンドに切り替え
  # backend "gcs" {
  #   bucket = "your-terraform-state-bucket"
  #   prefix = "realestate-report-system"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
