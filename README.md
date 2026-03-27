# 不動産価値・リスク診断レポート
### Real Estate Report System

国土交通省のオープンデータと Google Gemini API を組み合わせ、任意の住所・座標から**不動産取引価格・災害リスク・周辺生活環境を即座に分析・可視化**する SaaS 型 Web アプリケーション。

---

## 主な機能 (Features)

| 機能 | 説明 |
|------|------|
| **取引価格サマリー** | 直近5年分の取引データを取得し、平均・中央値・㎡単価を集計 |
| **価格推移グラフ** | Recharts を用いた年別・種別の価格トレンド可視化 |
| **ハザード情報** | 洪水浸水想定（最大浸水深）・土砂災害警戒区域を地図ピン選択で即時取得 |
| **生活環境データ** | 用途地域・建ぺい率・容積率、学区（小・中）、周辺医療機関数、最寄り駅・乗降客数 |
| **AI エリア分析レポート** | Gemini API (`gemini-2.5-flash`) が 8 項目の分析を自動生成（アコーディオン UI） |
| **PDF エクスポート** | `html2canvas` + `jsPDF` でレポート全体を PDF に書き出し |
| **ユーザー認証** | Firebase Authentication（Google ログイン）でマルチユーザー対応 |
| **検索履歴** | Cloud Firestore に自動保存、FAB ボタンから過去の検索を即座に再現 |

### AI レポートの 8 項目

1. エリア総評
2. 子育て・生活環境スコア
3. 歴史・地形の特徴
4. 開発・再開発動向
5. 活用できる補助金・助成金
6. 直近のニュース・トピックス
7. エリアの将来予想
8. 人口の増減予想

---

## 技術スタック (Tech Stack)

### Frontend
- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS v4** — スタイリング
- **Leaflet** — インタラクティブ地図 + ピン選択
- **Recharts** — 価格推移グラフ
- **Radix UI / shadcn-ui** — UI コンポーネント
- **react-markdown** + **remark-gfm** — AI レポートの Markdown レンダリング

### Backend
- **Node.js** + **Hono** + **TypeScript**
- **GCS キャッシュ** — タイル座標をキーに 30 日 TTL でキャッシュ

### Infrastructure & DevOps
- **Google Cloud Run** — バックエンド・フロントエンドのサーバーレス実行
- **Cloud Build** — コンテナイメージのビルド & プッシュ
- **Artifact Registry** — Docker イメージ管理
- **Cloud Storage (GCS)** — API レスポンスのキャッシュ（JSON）
- **Terraform** — インフラ全体の IaC 管理
- **Docker** — ローカル開発 / Cloud Build でのビルド

### Database & Auth
- **Firebase Authentication** — Google ログイン
- **Cloud Firestore** — 検索履歴の保存・リアルタイム同期

### External APIs
- **国土交通省 不動産情報ライブラリ API** — 取引価格・ハザード・用途地域・学区・医療・駅データ
- **国土地理院 地理院地図 API** — 逆ジオコーディング（地区名特定）
- **Google Gemini API** — AI エリア分析レポート生成

---

## アーキテクチャ

```
[ブラウザ (Next.js / Cloud Run)]
        ↓ lat, lng
[バックエンド API (Hono / Cloud Run)]
    │
    ├─ キャッシュ HIT ──→ [Cloud Storage: z15/x/y.json]
    │                          ├─ aiReport あり → 即返却
    │                          └─ aiReport なし → Gemini 生成 → 非同期でキャッシュ更新
    │
    └─ キャッシュ MISS ─→ [国交省 MLIT API] ─→ [Gemini API]
                                                    └─ 非同期で GCS に保存
```

**キャッシュキー**: リクエスト座標をズームレベル 15 のタイル座標 `z{z}/x{x}/y{y}` に変換して一意のキーを生成。同一市区町村への重複リクエストを防ぎ、TTL 30 日でコストを最小化します。

---

## セットアップ (Getting Started)

### 前提条件

- Node.js 20+
- Google Cloud SDK (`gcloud`)
- Terraform 1.5+
- GCP プロジェクト（課金有効）
- 国土交通省 不動産情報ライブラリ API キー（[申請ページ](https://www.reinfolib.mlit.go.jp/)）
- Google Gemini API キー（[Google AI Studio](https://aistudio.google.com/)）

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/real-estate-report-system.git
cd real-estate-report-system
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、以下の値を設定してください。

| 変数名 | 説明 |
|--------|------|
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `GCP_REGION` | リージョン（例: `asia-northeast1`） |
| `GCS_CACHE_BUCKET` | キャッシュ用 GCS バケット名 |
| `CLOUD_RUN_SERVICE_NAME` | バックエンド Cloud Run サービス名 |
| `MLIT_API_KEY` | 国交省 API キー（省略時はモックデータで動作） |
| `GEMINI_API_KEY` | Gemini API キー（省略時はモック AI レポートで動作） |

フロントエンドの環境変数は `frontend/.env.local.example` を参考に `frontend/.env.local` を作成してください。

```bash
cp frontend/.env.local.example frontend/.env.local
```

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_API_URL` | バックエンド API の URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API キー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 認証ドメイン |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase プロジェクト ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage バケット |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 送信者 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase アプリ ID |

### 3. GCP 認証

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 4. Terraform でインフラ構築

```bash
./scripts/terraform_apply.sh plan    # 変更内容を確認
./scripts/terraform_apply.sh apply   # インフラを作成
```

Cloud Run・GCS バケット・Artifact Registry・IAM が自動でプロビジョニングされます。

### 5. ローカル開発

**バックエンド:**

```bash
cd backend
npm install
npm run dev    # http://localhost:8080
```

**フロントエンド:**

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

主なエンドポイント:

```
GET /health
GET /api/property/transactions?lat=35.74&lng=139.86&zoom=15
```

### 6. 本番デプロイ

**バックエンド:**

```bash
./scripts/deploy.sh
```

**フロントエンド:**

```bash
./scripts/deploy_frontend.sh
```

デプロイ後、自動でヘルスチェックが実行されます。

---

## ディレクトリ構成

```
.
├── .env.example                  # 環境変数テンプレート（バックエンド）
├── backend/
│   ├── src/
│   │   ├── index.ts              # エントリーポイント
│   │   ├── config.ts             # 設定値（環境変数読み込み）
│   │   ├── routes/
│   │   │   └── property.ts       # GET /api/property/transactions
│   │   ├── services/
│   │   │   ├── mlitApi.ts        # 国交省 API クライアント
│   │   │   ├── geminiApi.ts      # Gemini AI レポート生成
│   │   │   └── gcsCache.ts       # GCS キャッシュ読み書き
│   │   └── utils/
│   │       └── tile.ts           # タイル座標計算
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   └── page.tsx              # メインページ
│   ├── components/
│   │   ├── SearchForm.tsx        # 住所・座標入力 + Leaflet 地図
│   │   ├── SummaryCards.tsx      # 取引価格サマリー + ハザード表示
│   │   ├── PriceTrendChart.tsx   # 年別価格推移グラフ（Recharts）
│   │   ├── EnvironmentInfo.tsx   # 生活環境カード
│   │   ├── AiReport.tsx          # AI レポート（アコーディオン）
│   │   ├── TransactionTable.tsx  # 取引明細テーブル
│   │   └── HistoryList.tsx       # 検索履歴 FAB パネル
│   ├── lib/
│   │   ├── api.ts                # バックエンド API クライアント
│   │   ├── firebase.ts           # Firebase 初期化
│   │   ├── history.ts            # Firestore 検索履歴
│   │   ├── exportPdf.ts          # PDF エクスポート
│   │   └── geocode.ts            # 地理院 API ジオコーディング
│   └── .env.local.example        # フロントエンド環境変数テンプレート
├── terraform/                    # GCP リソース定義（IaC）
├── scripts/
│   ├── deploy.sh                 # バックエンド Cloud Run デプロイ
│   ├── deploy_frontend.sh        # フロントエンド Cloud Run デプロイ
│   ├── terraform_apply.sh        # Terraform ラッパー
│   └── test_local.sh             # ローカル動作確認
└── README.md
```

---

## 開発フロー（プロジェクト憲法）

本プロジェクトは以下のフローを厳守しています。

1. **コード修正** — 実装を行う
2. **ビルド & デプロイ** — ローカルまたは Cloud Run へ反映
3. **実機動作確認** — エンドポイントを叩き、意図した動作かを検証
4. **✅ 問題なし** → `git commit` / **❌ 不具合あり** → 修正して 2 へ戻る

---

## データソース・謝辞

- [国土交通省 不動産情報ライブラリ](https://www.reinfolib.mlit.go.jp/) — 取引価格・ハザード・都市計画データ
- [国土地理院 地理院地図](https://maps.gsi.go.jp/) — 逆ジオコーディング
- [Google Gemini API](https://ai.google.dev/) — AI レポート生成

---

## ライセンス

MIT
