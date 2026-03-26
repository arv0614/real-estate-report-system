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

ACTION="${1:-plan}"

echo "========================================"
echo "🌍 Terraform - $ACTION"
echo "  Project: $GCP_PROJECT_ID"
echo "  Region : $GCP_REGION"
echo "========================================"

cd "$TF_DIR"

# terraform.tfvars を .env から自動生成
cat > terraform.tfvars <<EOF
project_id             = "${GCP_PROJECT_ID}"
region                 = "${GCP_REGION}"
cache_bucket_name      = "${GCS_CACHE_BUCKET}"
cloud_run_service_name = "${CLOUD_RUN_SERVICE_NAME}"
cache_ttl_days         = ${CACHE_TTL_DAYS:-30}
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
