#!/usr/bin/env bash
# =============================================================
# deploy.sh - バックエンドAPIをCloud Runにビルド・デプロイ
# 使い方: ./scripts/deploy.sh
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# .env を読み込む
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
else
  echo "❌ .env ファイルが見つかりません。.env.example をコピーして設定してください。"
  exit 1
fi

# 必須変数チェック
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID が .env に未設定です}"
: "${GCP_REGION:?GCP_REGION が .env に未設定です}"
: "${GCS_CACHE_BUCKET:?GCS_CACHE_BUCKET が .env に未設定です}"
: "${CLOUD_RUN_SERVICE_NAME:?CLOUD_RUN_SERVICE_NAME が .env に未設定です}"

IMAGE_REPO="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/realestate-api/backend"
IMAGE_TAG="${IMAGE_REPO}:latest"

echo "========================================"
echo "🏠 Real Estate API - Deploy Script"
echo "========================================"
echo "  Project : $GCP_PROJECT_ID"
echo "  Region  : $GCP_REGION"
echo "  Service : $CLOUD_RUN_SERVICE_NAME"
echo "  Image   : $IMAGE_TAG"
echo "========================================"

# ステップ1: Docker認証
echo ""
echo "📦 [1/4] Artifact Registry に認証..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

# ステップ2: Dockerビルド
echo ""
echo "🔨 [2/4] Dockerイメージをビルド..."
cd "$ROOT_DIR/backend"
docker build --platform linux/amd64 -t "$IMAGE_TAG" .
echo "✅ ビルド完了"

# ステップ3: プッシュ
echo ""
echo "⬆️  [3/4] Artifact Registry にプッシュ..."
docker push "$IMAGE_TAG"
echo "✅ プッシュ完了"

# ステップ4: Cloud Run デプロイ
echo ""
echo "🚀 [4/4] Cloud Run にデプロイ..."
gcloud run deploy "$CLOUD_RUN_SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=${GCP_PROJECT_ID},GCP_REGION=${GCP_REGION},GCS_CACHE_BUCKET=${GCS_CACHE_BUCKET},BQ_DATASET=${BQ_DATASET:-realestate_cache},CACHE_TTL_DAYS=${CACHE_TTL_DAYS:-30},MLIT_API_KEY=${MLIT_API_KEY:-},GEMINI_API_KEY=${GEMINI_API_KEY:-}" \
  --quiet

# デプロイ後のURLを取得
SERVICE_URL=$(gcloud run services describe "$CLOUD_RUN_SERVICE_NAME" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID" \
  --format "value(status.url)")

echo ""
echo "========================================"
echo "✅ デプロイ完了!"
echo "  URL: $SERVICE_URL"
echo "========================================"

# ステップ5: ヘルスチェック
echo ""
echo "🩺 ヘルスチェック中..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "✅ ヘルスチェック OK (HTTP $HTTP_STATUS)"
  echo ""
  echo "🧪 動作テスト（葛飾区周辺データ取得）:"
  curl -s "${SERVICE_URL}/api/property/transactions?lat=35.74&lng=139.86&zoom=15" | head -c 500
  echo ""
else
  echo "❌ ヘルスチェック失敗 (HTTP $HTTP_STATUS)"
  echo "ログを確認してください:"
  echo "  gcloud run services logs read $CLOUD_RUN_SERVICE_NAME --region $GCP_REGION --limit 50"
  exit 1
fi
