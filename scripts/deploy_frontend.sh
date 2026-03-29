#!/usr/bin/env bash
# =============================================================
# deploy_frontend.sh - フロントエンドをCloud Runにビルド・デプロイ
# 使い方: ./scripts/deploy_frontend.sh
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$ROOT_DIR/terraform"
FRONTEND_DIR="$ROOT_DIR/frontend"

# .env を読み込む
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
else
  echo "❌ .env ファイルが見つかりません。"
  exit 1
fi

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID が .env に未設定です}"
: "${GCP_REGION:=${GCP_REGION:-asia-northeast1}}"

IMAGE="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/realestate-api/frontend:latest"
FRONTEND_SERVICE="${FRONTEND_CLOUD_RUN_SERVICE_NAME:-realestate-frontend}"

echo "========================================"
echo "🏠 Real Estate Frontend - Deploy Script"
echo "========================================"
echo "  Project : $GCP_PROJECT_ID"
echo "  Region  : $GCP_REGION"
echo "  Service : $FRONTEND_SERVICE"
echo "  Image   : $IMAGE"
echo "========================================"

# ステップ1: バックエンドURL取得（Terraform output）
echo ""
echo "🔍 [1/3] バックエンドURLを取得中..."
cd "$TERRAFORM_DIR"
BACKEND_URL=$(terraform output -raw cloud_run_url 2>/dev/null)
if [[ -z "$BACKEND_URL" ]]; then
  echo "❌ terraform output から cloud_run_url を取得できませんでした。"
  echo "   terraform apply でバックエンドをデプロイ済みか確認してください。"
  exit 1
fi
echo "  Backend URL: $BACKEND_URL"

# ステップ2: Cloud Build でフロントエンドイメージをビルド・プッシュ
echo ""
echo "🔨 [2/3] Cloud Build でイメージをビルド・プッシュ..."
cd "$ROOT_DIR"
gcloud builds submit "$FRONTEND_DIR" \
  --config "$FRONTEND_DIR/cloudbuild.yaml" \
  --substitutions "_NEXT_PUBLIC_API_URL=$BACKEND_URL,_IMAGE=$IMAGE,_NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},_NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},_NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --project "$GCP_PROJECT_ID"
echo "✅ ビルド・プッシュ完了"

# ステップ3: Cloud Run を強制リデプロイ（:latest タグは Terraform が変化を検知しないため直接 gcloud を使う）
echo ""
echo "🚀 [3/3] Cloud Run に新イメージを強制デプロイ..."
gcloud run deploy "$FRONTEND_SERVICE" \
  --image "$IMAGE" \
  --region "$GCP_REGION" \
  --platform managed \
  --project "$GCP_PROJECT_ID" \
  --quiet

# Terraform state を現状と同期（設定ドリフト防止）
cd "$TERRAFORM_DIR"
terraform apply -auto-approve \
  -target=google_cloud_run_v2_service.frontend \
  -target=google_cloud_run_v2_service_iam_member.frontend_public \
  2>/dev/null || true

FRONTEND_URL=$(terraform output -raw frontend_cloud_run_url)

echo ""
echo "========================================"
echo "✅ デプロイ完了!"
echo "  フロントエンド URL: $FRONTEND_URL"
echo "  バックエンド  URL: $BACKEND_URL"
echo "========================================"

# ヘルスチェック
echo ""
echo "🩺 ヘルスチェック中 (最大30秒待機)..."
for i in $(seq 1 6); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    echo "✅ ヘルスチェック OK (HTTP $HTTP_STATUS)"
    break
  fi
  echo "  ... HTTP $HTTP_STATUS (${i}/6回目、5秒後に再試行)"
  sleep 5
done

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "⚠️  ヘルスチェック未確認 (HTTP $HTTP_STATUS)"
  echo "   ブラウザで直接アクセスするか、ログを確認してください:"
  echo "   gcloud run services logs read $FRONTEND_SERVICE --region $GCP_REGION --limit 50"
fi
