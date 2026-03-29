# 不動産価値・リスク診断 AI レポート
### Real Estate Report System

> 国土交通省オープンデータ × Gemini AI で、任意の住所・座標から
> **不動産価値・災害リスク・周辺環境・暮らしのイメージ**を即座に分析・可視化する SaaS 型アプリケーション。
> B2B（不動産営業の提案書作成）から B2C（住宅購入検討者の自己調査）まで幅広く対応。

🔗 **本番URL**: https://realestate-frontend-418709171446.asia-northeast1.run.app

---

## 🚀 使い方 (How to Use)

### Step 1 — 検索・ピン留め
地図上をクリックするか、住所・地名（例：「東京都墨田区押上」）を入力して **「診断開始」** を押します。
国土交通省 不動産情報ライブラリ API から直近5年分の取引データを自動取得します。

### Step 2 — 取引データ・リスクを確認
- **取引価格サマリー**: 平均・中央値・最小/最大・物件種別の内訳をカード表示
- **ハザード情報**: 洪水浸水深ランク・土砂災害警戒区域の有無をバッジで即視化
- **価格推移グラフ**: Recharts によるインタラクティブな年別価格トレンド
- **生活環境情報**: 用途地域・学区（小学校/中学校）・医療機関・最寄り駅

### Step 3 — AI コンサルタントのエリア分析を読む
**10項目にわたる Gemini 2.5 Flash のエリア分析**をアコーディオンで展開。
セクションをクリックして必要な情報だけ開けます。

| # | セクション |
|---|---|
| 1 | エリア総評 |
| 2 | 住民・コミュニティ特性 |
| 3 | 歴史・文化的背景 |
| 4 | 都市開発・再開発動向 |
| 5 | 投資・資産価値の観点 |
| 6 | 最新トレンドとニュース |
| 7 | 将来予測・10年後の姿 |
| 8 | 総合評価スコア |
| 9 | **リアルな住環境と注意点**（ネガティブ情報も正直に開示） |
| 10 | **不動産プロの視点：最後の一押し**（クロージングアドバイス） |

### Step 4 — 暮らしのイメージ画像を生成（ログイン必須）
Google アカウントでログインし、AI レポート内の **「✨ 暮らしイメージを生成」** ボタンをクリック。
エリア総評テキストを基に Gemini がその土地に最適な英語プロンプトを動的生成し、Imagen 4 で画像化します。

- 豪雪地帯（北海道・長野山間部など）→ 雪景色・スキー場を自動反映
- 東京23区などの都市部 → スカイライン・都市景観を自動反映（rural 要素は自動排除）
- 温泉地・リゾート → 外湯・旅館街・リゾートシーンを自動反映

生成画像は Firebase Storage に自動保存され、次回からキャッシュ表示されます。

### Step 5 — PDF でエクスポート
右上の **「⚙️ 出力設定」** でセクションを選択し、**「📄 PDF をダウンロード」** をクリック。
顧客への提案書・社内報告書など用途に応じて5セクションを個別に ON/OFF できます。

| セクション | 内容 |
|---|---|
| 取引価格サマリー & ハザード | 価格統計とリスクバッジ |
| 生活環境情報 | 学区・医療機関・最寄り駅 |
| 価格推移グラフ | 年別トレンドチャート |
| AI エリア分析レポート | Gemini による10項目レポート |
| 取引事例一覧 | 詳細な個別取引データテーブル |

### Step 6 — 履歴から復元
右下の **「🕐 履歴」** ボタンから過去の検索を一覧表示。
クリックするだけで当時の取引データ・AI レポート・生成画像を即座に復元します。

---

## ✨ 主な機能 (Key Features)

### 取引データ分析
- 国土交通省 不動産情報ライブラリ API (XIT001) から直近5年分を並列取得
- 逆ジオコーディング（国土地理院 API）で座標→市区町村コードを自動解決
- 取引件数・平均価格・中央値・㎡単価・物件種別内訳をリアルタイム集計
- GCS（Google Cloud Storage）による30日間キャッシュで2回目以降は高速表示

### AI エリア分析（10項目）
- **Gemini 2.5 Flash** による自動レポート生成（約1,500〜2,000字）
- セクション9「リアルな住環境」ではネガティブ情報も正直に開示
- セクション10「プロの一押し」では不動産営業に使えるクロージングトークを生成
- アコーディオン UI + 全展開 / 全折りたたみボタンで快適閲覧

### 暮らしのイメージ画像（2段階アーキテクチャ）

```
[エリア総評テキスト（Section 1）]
         ↓
[Stage 1]  Gemini 2.5 Flash でエリア固有の英語プロンプトを動的生成
           豪雪 / 都市 / 温泉 / 海辺 / 農村 etc. を自動判定
         ↓
[Stage 2]  Imagen 4 Fast → gemini-2.5-flash-image → SVG モック（fallback）
         ↓
    Firebase Storage に保存 → 履歴から復元可能
```

### ハザード・生活環境情報
- 洪水浸水想定区域 (XKT026) / 土砂災害警戒区域 (XKT029)
- 用途地域 (XKT002) / 小中学校区 (XKT004/005) / 医療機関 (XKT010) / 最寄り駅 (XKT015)

### PDF エクスポート
- 5セクション個別 ON/OFF で出力内容をカスタマイズ
- `dom-to-image-more` + `jsPDF` による高品質 PDF 生成
- 非表示セクションは画面表示に影響なし（`pdf-hide` CSS クラス制御）

---

## 🛠 技術スタック (Tech Stack)

### Frontend
| 技術 | 用途 |
|---|---|
| Next.js 16 (App Router) | フレームワーク |
| React + TypeScript | UI コンポーネント |
| Tailwind CSS | スタイリング |
| Leaflet (react-leaflet) | インタラクティブ地図 |
| Recharts | 価格推移グラフ |
| ReactMarkdown + remark-gfm | AI レポートのマークダウンレンダリング |
| dom-to-image-more + jsPDF | PDF エクスポート |
| Firebase SDK (Auth / Firestore / Storage) | 認証・履歴・画像保存 |

### Backend
| 技術 | 用途 |
|---|---|
| Node.js + TypeScript | ランタイム |
| Hono | 軽量 Web フレームワーク |
| Google Cloud Run | サーバーレスホスティング |
| Google Cloud Storage | API レスポンスの30日キャッシュ |

### AI & External APIs
| API | 用途 |
|---|---|
| Gemini 2.5 Flash (Text) | エリア分析レポート生成 / 画像プロンプト動的生成 |
| Imagen 4 Fast | 暮らしのイメージ画像生成（Primary） |
| Gemini 2.5 Flash Image | 画像生成 Fallback |
| 国土交通省 不動産情報ライブラリ API | 取引価格・ハザード・生活環境データ |
| 国土地理院 API (GSI) | 逆ジオコーディング・住所検索 |

### Infrastructure
| 技術 | 用途 |
|---|---|
| Firebase Auth (Google OAuth) | ユーザー認証 |
| Firebase Firestore | 検索履歴の保存 |
| Firebase Storage | 生成画像の永続化 |
| Terraform | GCP リソースの IaC 管理 |
| Google Cloud Build | CI/CD パイプライン |

---

## 🏗 アーキテクチャ概要

```
[Browser]
  │  Google Login (Firebase Auth)
  │  fetchTransactions(lat, lng)
  ▼
[Next.js Frontend / Cloud Run]
  │
  │  GET /api/property/transactions
  ▼
[Hono Backend / Cloud Run]
  ├── reverseGeocode(lat, lng)   → 国土地理院 API
  ├── fetchTransactionPrices()   → 国交省 不動産情報ライブラリ (XIT001)
  ├── fetchHazardInfo()          → XKT026 / XKT029
  ├── fetchEnvironmentInfo()     → XKT002 / XKT004 / XKT005 / XKT010 / XKT015
  ├── generateAreaReport()       → Gemini 2.5 Flash
  └── readCache / writeCache     → Google Cloud Storage (30日 TTL)

  │  POST /api/property/generate-image
  ▼
[2段階画像生成パイプライン]
  ├── generateDynamicPrompt()    → Gemini 2.5 Flash (テキスト)
  ├── generateViaImagen4()       → Imagen 4 Fast
  └── generateViaGeminiImage()   → Gemini 2.5 Flash Image (fallback)
  │
  ▼
[Firebase Storage]   ← 生成画像を保存
[Firestore]          ← 検索履歴・ダウンロード URL を保存
```

---

## ⚡ ローカル開発環境のセットアップ (Getting Started)

### 前提条件
- Node.js 20+
- Docker（Dev Container 推奨）
- GCP プロジェクト（Cloud Run / GCS / Artifact Registry 有効化済み）
- Firebase プロジェクト（Auth / Firestore / Storage 有効化済み）

### 1. リポジトリのクローン

```bash
git clone <repo-url>
cd real-estate-report-system
```

### 2. 環境変数の設定

プロジェクトルートに `.env` を作成（`.env.example` を参照）:

```bash
# GCP
GCP_PROJECT_ID=your-project-id
GCP_REGION=asia-northeast1
GCS_CACHE_BUCKET=your-cache-bucket-name

# 国土交通省 不動産情報ライブラリ API
MLIT_API_KEY=your-mlit-api-key
MLIT_API_BASE_URL=https://www.reinfolib.mlit.go.jp/ex-api/external

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# フロントエンドが参照するバックエンド URL（Cloud Run デプロイ後に取得）
NEXT_PUBLIC_API_URL=https://your-backend-url.run.app
```

フロントエンドのローカル開発用に `frontend/.env.local` を作成:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080

NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. バックエンドの起動

```bash
cd backend
npm install
npm run dev       # http://localhost:8080 で起動
```

### 4. フロントエンドの起動

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000 で起動
```

---

## 🚀 Cloud Run へのデプロイ

### バックエンド

```bash
source .env
IMAGE="asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/realestate-api/backend:latest"

gcloud builds submit ./backend --tag "${IMAGE}" --project="${GCP_PROJECT_ID}"
gcloud run deploy realestate-api --image "${IMAGE}" --region asia-northeast1 --project="${GCP_PROJECT_ID}"
```

### フロントエンド

```bash
source .env
IMAGE="asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/realestate-api/frontend:latest"

gcloud builds submit ./frontend \
  --config ./frontend/cloudbuild.yaml \
  --substitutions "_NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL},_IMAGE=${IMAGE},\
_NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},\
_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},\
_NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},\
_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},\
_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},\
_NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --project="${GCP_PROJECT_ID}"

gcloud run deploy realestate-frontend --image "${IMAGE}" --region asia-northeast1 --project="${GCP_PROJECT_ID}"
```

> **Note**: `NEXT_PUBLIC_*` はビルド時に JS バンドルへ焼き込まれるため、Cloud Run の実行時環境変数では反映されません。必ず Cloud Build のビルド引数として渡してください。

---

## 📁 ディレクトリ構成

```
real-estate-report-system/
├── backend/
│   └── src/
│       ├── index.ts              # Hono サーバーエントリーポイント
│       ├── config.ts             # 環境変数設定
│       ├── routes/
│       │   └── property.ts       # /api/property/* ルート定義
│       ├── services/
│       │   ├── mlitApi.ts        # 国交省 API クライアント
│       │   ├── geminiApi.ts      # Gemini エリア分析レポート生成
│       │   ├── imagenApi.ts      # 2段階画像生成パイプライン
│       │   └── gcsCache.ts       # GCS キャッシュ管理
│       └── utils/
│           ├── geocode.ts        # 逆ジオコーディング (GSI)
│           └── tile.ts           # タイル座標変換
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # メインページ（検索・結果表示）
│   │   ├── globals.css           # グローバルスタイル・PDF制御
│   │   └── layout.tsx
│   ├── components/
│   │   ├── AiReport.tsx          # AI レポートアコーディオン + 画像生成 UI
│   │   ├── PriceTrendChart.tsx   # 価格推移グラフ (Recharts)
│   │   ├── TransactionTable.tsx  # 取引事例テーブル
│   │   ├── SummaryCards.tsx      # 価格サマリー + ハザードカード
│   │   ├── EnvironmentInfo.tsx   # 生活環境情報カード
│   │   ├── SearchForm.tsx        # 検索フォーム + Leaflet 地図
│   │   ├── HistoryList.tsx       # 検索履歴一覧（フローティング）
│   │   └── SourceBadge.tsx       # データソース表示バッジ
│   └── lib/
│       ├── api.ts                # バックエンド API クライアント
│       ├── firebase.ts           # Firebase 初期化
│       ├── history.ts            # Firestore 履歴 CRUD + Storage 画像保存
│       ├── geocode.ts            # GSI ジオコーディング
│       └── exportPdf.ts          # PDF エクスポート
├── terraform/                    # GCP インフラ IaC（Cloud Run / GCS / Artifact Registry）
├── scripts/                      # デプロイスクリプト
├── .env.example                  # 環境変数テンプレート
└── README.md
```

---

## 🔒 セキュリティ対策（Stripe審査・PCI DSS準拠対応）

本システムでは、Stripe本番環境審査および一般的なセキュリティ要件を満たすため、以下の対策を実施しています。

### クレジットカード情報の非保持

決済はすべて **Stripe Checkout** にリダイレクトして行います。カード番号・有効期限・CVCなどの決済情報は自社サーバー・データベースでは一切処理・保持しない設計です。これにより PCI DSS SAQ A（最も簡易なスコープ）の要件を満たします。

### 不正ログイン・アクセス対策

- **認証**: Firebase Authentication（Google OAuth 2.0）を利用し、パスワードを自社で管理しないセキュアな認証基盤を採用しています。
- **Rate Limiting**: バックエンドAPIに IPアドレスベースのレートリミットを導入しています。1つのIPにつき **15分間に100リクエスト** を超過した場合、`429 Too Many Requests` を返してボットや総当たり攻撃を防ぎます。
  ```
  // backend/src/index.ts
  rateLimiter({ windowMs: 15 * 60 * 1000, limit: 100 })
  ```

### 脆弱性・マルウェア対策

- **XSS対策**: フロントエンドは Next.js を使用しており、React の自動エスケープとCSPヘッダーによるXSS攻撃を標準機能で防いでいます。
- **OSレベルの保護**: バックエンド・フロントエンドともに **Cloud Run（フルマネージド）** 上で動作しており、OSパッチ適用・コンテナ分離・IAMによるリソースアクセス制御をGoogleが管理します。
- **機密情報管理**: APIキー・サービスアカウント等はすべて環境変数で管理し、ソースコードには一切含まれません（`.gitignore` で保護）。

---

## 📝 注意事項

- 取引データ・AI レポートはすべて参考情報です。投資判断の際は必ず最新の公式情報をご確認ください。
- 暮らしのイメージ画像は AI が生成した架空のイメージであり、実際の物件・街並みとは異なります。
- 国土交通省 不動産情報ライブラリ API の利用には API キーの申請が必要です（無料）。
- Gemini API / Imagen API の利用料金は Google AI Studio の料金体系に従います。

---

## 📄 ライセンス

MIT License
