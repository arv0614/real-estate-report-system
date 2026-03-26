#!/usr/bin/env bash
# =============================================================
# test_local.sh - ローカルで動作確認（GCS不使用のモックモード）
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR/backend"

echo "📦 依存パッケージをインストール..."
npm install

echo ""
echo "🧪 ユニットテストを実行..."
npm test

echo ""
echo "✅ テスト完了"
echo ""
echo "🚀 ローカルサーバーを起動します (Ctrl+C で停止)..."
echo "   テストコマンド:"
echo "   curl http://localhost:8080/health"
echo "   curl 'http://localhost:8080/api/property/transactions?lat=35.74&lng=139.86'"
echo ""
npm run dev
