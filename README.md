# 不動産リスク&適正価格 自動レポート生成システム

税理士・FP向けB2B SaaS。国交省「不動産情報ライブラリAPI」のデータを元に、不動産リスク分析と適正価格レポートをPDFで自動生成する。

## アーキテクチャ

```
[クライアント (Next.js)]
        ↓
[Cloud Run: バックエンドAPI (Node.js/Hono)]
    ↓ キャッシュHIT → [GCS: JSON生データ]
    ↓ キャッシュMISS → [国交省 MLIT API]
                            ↓ 非同期保存
                  [GCS] / [BigQuery: 構造化データ]
```

## キャッシュ機構

1. リクエスト座標をズームレベル15のタイル座標（`z{z}/x{x}/y{y}`）に変換してキーを生成
2. GCSに過去データが存在し有効期限（30日）内なら即返却
3. キャッシュなし→MLITAPIを呼び、非同期でGCS/BigQueryに保存

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js (TypeScript) |
| バックエンドAPI | Node.js + Hono + TypeScript |
| インフラ | GCP (Cloud Run, GCS, BigQuery, Artifact Registry) |
| IaC | Terraform |
| コンテナ | Docker (linux/amd64) |

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して実際の値を設定
```

必須の設定値：

| 変数名 | 説明 |
|---|---|
| `GCP_PROJECT_ID` | GCPプロジェクトID |
| `GCP_REGION` | リージョン（例: asia-northeast1） |
| `GCS_CACHE_BUCKET` | キャッシュ用GCSバケット名 |
| `CLOUD_RUN_SERVICE_NAME` | Cloud Runサービス名 |
| `MLIT_API_KEY` | 国交省APIキー（省略時はモックデータ） |

### 2. GCPログイン

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Terraformでインフラ構築

```bash
./scripts/terraform_apply.sh plan   # 確認
./scripts/terraform_apply.sh apply  # 適用
```

### 4. ローカル開発

```bash
./scripts/test_local.sh
# または
cd backend && npm install && npm run dev
```

APIエンドポイント：
- `GET /health` — ヘルスチェック
- `GET /api/property/transactions?lat=35.74&lng=139.86&zoom=15` — 取引価格取得

### 5. Cloud Runへデプロイ

```bash
./scripts/deploy.sh
```

デプロイ後は自動でヘルスチェックと動作テストが実行される。

## ディレクトリ構成

```
.
├── .env.example          # 環境変数テンプレート
├── backend/              # バックエンドAPI
│   ├── src/
│   │   ├── index.ts      # エントリーポイント
│   │   ├── config.ts     # 設定値
│   │   ├── routes/       # APIルート
│   │   ├── services/     # GCSキャッシュ・MLIT API
│   │   └── utils/        # タイル座標計算
│   ├── Dockerfile
│   └── package.json
├── terraform/            # GCPリソース定義
│   ├── versions.tf
│   ├── variables.tf
│   ├── apis.tf           # API有効化
│   ├── iam.tf            # サービスアカウント
│   ├── storage.tf        # GCSバケット
│   ├── bigquery.tf       # BigQueryデータセット
│   ├── artifact_registry.tf
│   ├── cloud_run.tf      # Cloud Runサービス
│   └── outputs.tf
├── scripts/
│   ├── deploy.sh         # Cloud Runデプロイ
│   ├── terraform_apply.sh
│   └── test_local.sh
└── frontend/             # Next.js (今後実装)
```

## 開発フロー（プロジェクト憲法）

1. コード修正
2. `npm test` でテスト実行
3. ローカル or Cloud Run で動作確認
4. 問題なければ `git commit`
