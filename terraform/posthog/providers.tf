terraform {
  required_version = ">= 1.5"

  required_providers {
    posthog = {
      source  = "posthog/posthog"
      version = "~> 1.0"
    }
  }
}

provider "posthog" {
  api_key    = var.posthog_api_key
  host       = var.posthog_host
  project_id = var.posthog_project_id
}
