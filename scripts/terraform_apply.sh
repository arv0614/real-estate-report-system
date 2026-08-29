#!/usr/bin/env bash
# =============================================================
# terraform_apply.sh - Terraform でGCPリソースを構築
# 使い方: ./scripts/terraform_apply.sh [plan|apply|destroy]
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$ROOT_DIR/terraform"

# .env を読み込む
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
else
  echo "❌ .env ファイルが見つかりません"
  exit 1
fi

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID が未設定です}"
: "${GCP_REGION:?GCP_REGION が未設定です}"
: "${GCS_CACHE_BUCKET:?GCS_CACHE_BUCKET が未設定です}"
: "${CLOUD_RUN_SERVICE_NAME:?CLOUD_RUN_SERVICE_NAME が未設定です}"
: "${MLIT_API_KEY:?MLIT_API_KEY が未設定です}"
: "${GEMINI_API_KEY:?GEMINI_API_KEY が未設定です}"
: "${ESTAT_API_KEY:?ESTAT_API_KEY が未設定です}"
: "${ALLOWED_ORIGINS:?ALLOWED_ORIGINS が未設定です}"
: "${ADMIN_EMAILS:?ADMIN_EMAILS が未設定です}"
: "${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID が未設定です}"

ACTION="${1:-plan}"

echo "========================================"
echo "🌍 Terraform - $ACTION"
echo "  Project: $GCP_PROJECT_ID"
echo "  Region : $GCP_REGION"
echo "========================================"

cd "$TF_DIR"

# terraform.tfvars を .env から自動生成（.gitignore 済み・コミット禁止）
cat > terraform.tfvars <<EOF
project_id             = "${GCP_PROJECT_ID}"
region                 = "${GCP_REGION}"
cache_bucket_name      = "${GCS_CACHE_BUCKET}"
cloud_run_service_name = "${CLOUD_RUN_SERVICE_NAME}"
cache_ttl_days         = ${CACHE_TTL_DAYS:-30}

# Cloud Run コンテナ env（稼働中サービスと一致させ apply を no-op に保つ）
mlit_api_key        = "${MLIT_API_KEY}"
gemini_api_key      = "${GEMINI_API_KEY}"
estat_api_key       = "${ESTAT_API_KEY}"
allowed_origins     = "${ALLOWED_ORIGINS}"
admin_emails        = "${ADMIN_EMAILS}"
firebase_project_id = "${FIREBASE_PROJECT_ID}"
EOF

echo "✅ terraform.tfvars を自動生成しました"

terraform init -upgrade

case "$ACTION" in
  plan)
    terraform plan
    ;;
  apply)
    terraform apply -auto-approve
    echo ""
    echo "✅ Terraform apply 完了"
    terraform output
    ;;
  destroy)
    echo "⚠️  全リソースを削除します。本当に続けますか？ (yes/no)"
    read -r confirm
    if [[ "$confirm" == "yes" ]]; then
      terraform destroy -auto-approve
    else
      echo "キャンセルしました"
    fi
    ;;
  *)
    echo "使い方: $0 [plan|apply|destroy]"
    exit 1
    ;;
esac
