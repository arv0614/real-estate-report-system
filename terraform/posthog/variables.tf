variable "posthog_api_key" {
  description = "PostHog Personal API Key (PostHog > Settings > Personal API Keys で生成)"
  type        = string
  sensitive   = true
}

variable "posthog_project_id" {
  description = "PostHog Project ID (PostHog > Project Settings > Project ID)"
  type        = string
}

variable "posthog_host" {
  description = "PostHog インスタンスのURL。クラウド版は https://us.i.posthog.com または https://eu.i.posthog.com"
  type        = string
  default     = "https://us.i.posthog.com"
}
