# 物件目利きリサーチ
### Real Estate Report System — mekiki-research.com

> 国土交通省オープンデータ × Google 生成 AI で、任意の住所・座標から
> **不動産取引価格・災害リスク・周辺環境・暮らしのイメージ**を即座に分析・可視化する SaaS 型アプリケーション。
> B2B（不動産営業の提案書作成）から B2C（住宅購入検討者の自己調査）まで幅広く対応。

🔗 **本番 URL**: https://mekiki-research.com

> **🎉 オープンベータ版 公開中**
> Stripe 審査中のため、現在はすべてのアカウントで全機能（AI レポート全10項目・暮らしイメージ生成を含む）を**完全無料**でご利用いただけます。

---

## 📋 目次

1. [使い方 (How to Use)](#-使い方-how-to-use)
2. [主な機能 (Key Features)](#-主な機能-key-features)
3. [料金プランと利用制限](#-料金プランと利用制限)
4. [システムアーキテクチャ](#-システムアーキテクチャ)
5. [技術スタック (Tech Stack)](#-技術スタック-tech-stack)
6. [多言語対応（i18n）の仕組み](#-多言語対応i18nの仕組み)
7. [セキュリティ・コンプライアンス対策](#-セキュリティコンプライアンス対策)
8. [SEO 戦略と sitemap](#-seo-戦略と-sitemap)
9. [テストと品質保証 (QA)](#-テストと品質保証-qa)
10. [ローカル開発環境のセットアップ](#-ローカル開発環境のセットアップ)
11. [Cloud Run へのデプロイ](#-cloud-run-へのデプロイ)
12. [Artifact Registry コスト最適化](#-artifact-registry-コスト最適化)
13. [Stripe 決済の本番稼働手順](#-stripe-決済の本番稼働手順)
14. [ディレクトリ構成](#-ディレクトリ構成)
15. [注意事項](#-注意事項)
16. [ライセンス](#-ライセンス)

---

## 🚀 使い方 (How to Use)

### Step 1 — 検索・ピン留め
地図上をクリックするか、住所・地名（例：「東京都墨田区押上」）を入力して **「調査開始」** を押します。
国土交通省 不動産情報ライブラリ API から直近5年分の取引データを自動取得します。

### Step 2 — 取引データ・リスクを確認
- **取引価格サマリー**: 平均・中央値・最小/最大・物件種別の内訳をカード表示
- **ハザード情報**: 洪水浸水深ランク・土砂災害警戒区域の有無をバッジで即視化
- **価格推移グラフ**: Recharts によるインタラクティブな年別価格トレンド
- **生活環境情報**: 用途地域・学区（小学校/中学校）・医療機関・最寄り駅

### Step 3 — AI コンサルタントのエリア分析を読む
**10項目にわたる Gemini 2.5 Flash のエリア分析**をアコーディオンで展開。
セクションをクリックして必要な情報だけ開けます。

| # | セクション | ベータ期間中 |
|---|---|:---:|
| 1 | エリア総評 | ✅ 無料 |
| 2 | 子育て・生活環境スコア | ✅ 無料 |
| 3 | 歴史・地形の特徴 | ✅ 無料 |
| 4 | 開発・再開発動向 | ✅ 無料（通常 Pro） |
| 5 | 活用できる補助金・助成金 | ✅ 無料（通常 Pro） |
| 6 | 直近のニュース・トピックス | ✅ 無料（通常 Pro） |
| 7 | エリアの将来予想 | ✅ 無料（通常 Pro） |
| 8 | 人口の増減予想 | ✅ 無料（通常 Pro） |
| 9 | リアルな住環境と注意点 | ✅ 無料（通常 Pro） |
| 10 | 不動産プロの視点：物件の魅力とおすすめポイント | ✅ 無料（通常 Pro） |

### Step 4 — 暮らしのイメージ画像を生成
Google アカウントでログイン後、AI レポート内の **「✨ 暮らしイメージを生成」** ボタンをクリック。
エリア総評テキストを基に Gemini がエリア固有の英語プロンプトを動的生成し、Imagen 4 で画像化します。

- 豪雪地帯（北海道・長野山間部など）→ 雪景色・スキー場を自動反映
- 東京23区などの都市部 → スカイライン・都市景観を自動反映
- 温泉地・リゾート → 外湯・旅館街・リゾートシーンを自動反映

### Step 5 — PDF でエクスポート（Pro プラン）
右上の **「⚙️ 出力設定」** でセクションを選択し、**「📄 PDF をダウンロード」** をクリック。
顧客への提案書・社内報告書など用途に応じて5セクションを個別に ON/OFF できます。

| セクション | 内容 |
|---|---|
| 取引価格サマリー & ハザード | 価格統計とリスクバッジ |
| 生活環境情報 | 学区・医療機関・最寄り駅 |
| 価格推移グラフ | 年別トレンドチャート |
| AI エリア分析レポート | Gemini による10項目レポート |
| 取引事例一覧 | 詳細な個別取引データテーブル |

### Step 6 — 履歴から復元（ログインユーザー）
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
- セクション10「プロの視点」では不動産プロによる物件の魅力を生成
- アコーディオン UI + 全展開 / 全折りたたみボタンで快適閲覧

### 暮らしのイメージ画像（2段階アーキテクチャ）

```
[エリア総評テキスト（Section 1）]
         ↓
[Stage 1]  Gemini 2.5 Flash でエリア固有の英語プロンプトを動的生成
           豪雪 / 都市 / 温泉 / 海辺 / 農村 etc. を自動判定
         ↓
[Stage 2]  Imagen 4 Fast → gemini-2.5-flash-image（fallback）
         ↓
    Firebase Storage に保存 → 履歴から復元可能
```

### ハザード・生活環境情報
- 洪水浸水想定区域 (XKT026) / 土砂災害警戒区域 (XKT029)
- 用途地域 (XKT002) / 小中学校区 (XKT004/005) / 医療機関 (XKT010) / 最寄り駅 (XKT015)

### PDF エクスポート
- 5セクション個別 ON/OFF で出力内容をカスタマイズ
- `dom-to-image-more` + `jsPDF` による高品質 PDF 生成（地図・グラフ・画像含む）
- 非表示セクションは画面表示に影響なし（`pdf-hide` CSS クラス制御）

---

## 💎 料金プランと利用制限

> **現在はオープンベータ期間中のため、ログインユーザーは Pro 相当の全機能を無料でご利用いただけます。**

| 機能 | ゲスト（未ログイン） | Free / Beta | Pro（準備中） |
|---|:---:|:---:|:---:|
| エリア調査 | 1回/日 | 無制限（ベータ） | 無制限 |
| 取引価格サマリー・グラフ | ✅ | ✅ | ✅ |
| ハザード情報 | ✅ | ✅ | ✅ |
| AI レポート（セクション1〜3） | ❌ | ✅ | ✅ |
| AI レポート（セクション4〜10） | ❌ | ✅（ベータ） | ✅ |
| 暮らしのイメージ画像生成 | ❌ | ✅（ベータ） | ✅ |
| PDF エクスポート | ❌ | ❌ | ✅ |
| 検索履歴の保存 | ❌ | ✅ | ✅ |

利用制限の判定は localStorage（ゲスト）と Firestore（ログイン済み）で管理しています。

---

## 🏗 システムアーキテクチャ

```
[ブラウザ]
  │  Google Login (Firebase Auth)
  │  調査フォーム（住所 or 緯度経度入力）
  ▼
[Next.js 16 Frontend / Cloud Run — asia-northeast1]
  │  セキュリティヘッダー: HSTS / CSP / X-Frame-Options 等（next.config.ts）
  │
  │  GET /api/property/transactions
  ▼
[Hono Backend / Cloud Run — asia-northeast1]
  │  secureHeaders() ミドルウェア / CORS / IPレートリミット
  ├── reverseGeocode(lat, lng)      → 国土地理院 GSI API
  ├── fetchTransactionPrices()      → 国交省 不動産情報ライブラリ (XIT001)
  ├── fetchHazardInfo()             → XKT026 / XKT029
  ├── fetchEnvironmentInfo()        → XKT002 / XKT004 / XKT005 / XKT010 / XKT015
  ├── generateAreaReport()          → Gemini 2.5 Flash
  └── readCache / writeCache        → Google Cloud Storage (30日 TTL)

  │  POST /api/property/generate-image
  ▼
[2段階画像生成パイプライン]
  ├── generateDynamicPrompt()       → Gemini 2.5 Flash（英語プロンプト動的生成）
  ├── generateViaImagen4()          → Imagen 4 Fast（Primary）
  └── generateViaGeminiImage()      → Gemini 2.5 Flash Image（Fallback）

  │  POST /api/stripe/create-checkout-session（Firebase ID Token 認証必須）
  ▼
[Stripe Checkout] ※現在はベータ版のため無効化中
  └── Webhook → /api/stripe/webhook → Firestore users/{uid}.plan = "pro"

[Firebase]
  ├── Authentication — Google OAuth 2.0
  ├── Firestore     — ユーザープラン・検索履歴管理（Security Rules デプロイ済み）
  └── Storage       — 生成画像の永続化

[PostHog]
  └── アクセス解析・イベントトラッキング（Webhook 署名検証済み）

[Terraform]
  └── Cloud Run / Artifact Registry / GCS / IAM の IaC 管理
```

---

## 🛠 技術スタック (Tech Stack)

### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| Next.js (App Router) | 16 | フレームワーク・SSR/ISR/CSR |
| React + TypeScript | 19 / 5 | UI コンポーネント |
| Tailwind CSS | 4 | スタイリング |
| Leaflet (react-leaflet) | — | インタラクティブ地図（国土地理院タイル） |
| Recharts | — | 価格推移グラフ |
| ReactMarkdown + remark-gfm | — | AI レポートのマークダウンレンダリング |
| dom-to-image-more + jsPDF | — | PDF エクスポート |
| Firebase SDK (Auth / Firestore / Storage) | — | 認証・履歴・画像保存 |
| Playwright | — | E2E テスト（本番ドメイン対象・14シナリオ） |

### バックエンド

| 技術 | 用途 |
|---|---|
| Node.js + TypeScript | ランタイム |
| Hono | 軽量 Web フレームワーク |
| hono/secure-headers | HTTP セキュリティヘッダーミドルウェア |
| Zod | リクエストバリデーション |
| Firebase Admin SDK | サーバー側 ID Token 検証 |
| hono-rate-limiter | IP ベースのレートリミット（15分/100req） |

### インフラ・BaaS/SaaS

| サービス | 用途 |
|---|---|
| Google Cloud Run | フロントエンド・バックエンドのサーバーレスホスティング（分離構成） |
| Google Cloud Storage (GCS) | API レスポンスの30日間キャッシュ（APIコスト削減・高速化） |
| Google Artifact Registry | Docker イメージレジストリ |
| Google Cloud Build | CI/CD パイプライン（docker 不要・Cloud 上でビルド） |
| Firebase Authentication | ユーザー認証（Google OAuth 2.0） |
| Firebase Firestore | ユーザープラン・検索履歴の永続化 |
| Firebase Storage | AI 生成画像の永続化 |
| Stripe | サブスクリプション決済・Webhook（※ベータ期間中は無効化） |
| PostHog | アクセス解析・イベントトラッキング |
| Terraform | GCP リソースの IaC 管理（Cloud Run / GCS / Artifact Registry / IAM） |

### 外部 API

| API | 用途 |
|---|---|
| 国交省 不動産情報ライブラリ API (XIT001) | 取引価格データ取得 |
| 国交省 不動産情報ライブラリ API (XKT026/029/002/004/005/010/015) | ハザード・生活環境データ取得 |
| 国土地理院 API (GSI) | 逆ジオコーディング・住所検索・地図タイル |
| Gemini 2.5 Flash | エリア分析レポート生成 / 画像プロンプト動的生成 |
| Imagen 4 Fast | 暮らしのイメージ画像生成（Primary） |
| Gemini 2.5 Flash Image | 画像生成 Fallback |

---

## 🌐 多言語対応（i18n）の仕組み

`next-intl` を用いて **日本語（`/`）と英語（`/en/`）** の2言語に対応しています。SSG（静的生成）を維持したままルーティングを切り替えています。

### ルーティング構造

```
/                          → app/page.tsx（日本語ホーム）
/en                        → app/[locale]/page.tsx（英語ホーム、locale="en"）
/reports/tokyo/shinjuku    → app/[locale]/reports/[pref]/[city]/page.tsx（日本語）
/en/reports/tokyo/shinjuku → app/[locale]/reports/[pref]/[city]/page.tsx（英語）
/terms, /privacy, /about, /licenses → app/[locale]/... でロケール対応済み
```

`next.config.ts` の `i18n` 設定と `middleware.ts` で `/en` プレフィックスを自動付与します。

### バックエンド API の多言語対応

フロントエンドから API を呼ぶ際に `locale` パラメータを付与します。

```typescript
// frontend/lib/api.ts
const res = await fetch(`${getApiBase()}/api/property/transactions?lat=...&locale=${locale}`);
```

バックエンドはこの `locale` を受け取り、Gemini へのプロンプトを切り替えます。

```typescript
// backend/src/services/geminiApi.ts
const report = locale === "en" ? await buildPromptEn(data) : await buildPromptJa(data);
```

生成されたレポートは GCS へ **ロケール別キー** で独立してキャッシュされます。

```
z15/x29100/y12901/ja   ← 日本語レポート
z15/x29100/y12901/en   ← 英語レポート（独立して保持）
```

> **言語ミスマッチ検出**: 旧キャッシュが誤ったロケールで保存されていた場合、
> レポート冒頭80文字の日本語文字数（≥10文字）を判定してミスマッチを検出し、
> Gemini に再生成を依頼します（`backend/src/routes/property.ts`）。

### API クライアントの絶対パス要件

クライアントコンポーネントからバックエンドを呼ぶ際は **必ず `getApiBase()` で絶対パスを使用** してください。

```typescript
// ✅ 正しい（frontend/lib/api.ts）
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}
fetch(`${getApiBase()}/api/property/transactions?...`);

// ❌ NG — 相対パスは /en/api/... に解決されて 404 になる
fetch(`/api/property/transactions?...`);
```

### CORS とローカル開発

バックエンドの CORS 設定では、`ALLOWED_ORIGINS` に指定した本番ドメインに加えて、
**ローカル開発用の `http://localhost:3000` と `http://localhost:3001` を常に追加** しています。

```typescript
// backend/src/index.ts
const devOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"];
const effectiveOrigins = allowedOrigins.length > 0 ? [...allowedOrigins, ...devOrigins] : [];
```

これにより、`.env` の `ALLOWED_ORIGINS` を本番ドメイン限定に設定した状態でも、
ローカル開発で `Failed to fetch` エラーが発生しません。

---

## 🔒 セキュリティ・コンプライアンス対策

本番公開前にセキュリティ監査を実施し、以下の対策をすべて実装・デプロイ済みです。

### HTTP セキュリティヘッダー（フロントエンド・バックエンド両対応）

`next.config.ts` の `headers()` と Hono の `secureHeaders()` ミドルウェアにより、全ルートに以下のヘッダーを出力しています。

| ヘッダー | 値 | 目的 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS 強制（2年・preload 申請可能） |
| `X-Content-Type-Options` | `nosniff` | MIME タイプスニッフィング防止 |
| `X-Frame-Options` | `SAMEORIGIN` | クリックジャッキング防止 |
| `X-XSS-Protection` | `1; mode=block` | レガシーブラウザ向け XSS フィルター |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー情報の漏洩制御 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 不要なブラウザ API の無効化 |
| `Content-Security-Policy` | 下記参照 | リソース読み込み元の厳格なホワイトリスト制御 |

#### Content-Security-Policy（CSP）設計

外部サービスを壊さないよう、アーキテクチャに合わせて以下ドメインを許可しています。

| ディレクティブ | 許可ドメイン | 理由 |
|---|---|---|
| `connect-src` | `*.googleapis.com`, `*.firebaseio.com`, `wss://*.firebaseio.com` | Firebase Auth / Firestore / Storage |
| `connect-src` | `us.i.posthog.com` | PostHog アクセス解析 |
| `connect-src` | `*.run.app` | Cloud Run バックエンド API |
| `img-src` | `lh3.googleusercontent.com` | Google アカウント プロフィール写真 |
| `img-src` | `cyberjapandata.gsi.go.jp`, `maps.gsi.go.jp` | 国土地理院 地図タイル |
| `img-src` | `firebasestorage.googleapis.com` | Firebase Storage 生成画像 |
| `frame-src` | `accounts.google.com` | Google OAuth ポップアップ |
| `font-src` | `fonts.gstatic.com` | Google Fonts |

### 認証・認可

| 対策 | 実装内容 |
|---|---|
| **Stripe Checkout の認証強化** | Firebase ID Token をヘッダー（`Authorization: Bearer <token>`）で受け取り、サーバー側で `admin.auth().verifyIdToken()` を使って検証。検証済み UID のみ Checkout Session を作成可能 |
| **Stripe Webhook 署名検証** | `stripe.webhooks.constructEvent()` による署名検証を実装。改ざんされたイベントでプランが書き換えられることを防止 |
| **Firebase Authentication** | Google OAuth 2.0 のみ対応。パスワードを自社で管理しないセキュアな認証基盤 |

### Firestore Security Rules（デプロイ済み）

```
// users/{uid} — 本人のみ読み書き可
allow create : plan == "free" 固定・Stripe フィールド書き込み不可
allow update : plan / stripeCustomerId / stripeSubscriptionId / planActivatedAt の直接書き換え禁止
allow delete : 禁止

// waitlist/* — クライアントから読み書き不可（バックエンド経由のみ）
// その他すべて — デフォルト拒否
```

`diff().affectedKeys()` を用いたフィールドレベルの書き込み制御により、クライアントが直接 `plan: "pro"` に書き換えることを防止しています。

### ネットワーク・API セキュリティ

| 対策 | 実装内容 |
|---|---|
| **CORS 設定** | 本番環境では `ALLOWED_ORIGINS` 環境変数で許可ドメインを厳格に制限。未設定時は起動ログで警告を出力 |
| **IP ベースのレートリミット** | 15分間に100リクエスト超過で `429 Too Many Requests` を返却。ボット・総当たり攻撃を防止 |
| **PostHog Webhook 署名検証** | `X-Webhook-Secret` ヘッダー必須化。未設定時は `503`、不一致時は `401` を返却（サイレントスキップを廃止） |
| **ヘルスチェックエンドポイント** | `/health` から `env` フィールドを削除。内部環境情報の漏洩を防止 |

### パフォーマンス・課金防御

| 対策 | 実装内容 |
|---|---|
| **GCS API レスポンスキャッシュ** | 同一座標・ズームレベルへの重複リクエストを GCS にキャッシュ（TTL 30日）。MLIT API への二重コールと Gemini 生成コストを削減 |
| **モックデータの完全排除** | 本番コードパスからモックデータを削除。API キー未設定時は `503`、API 障害時は `502` を返却し、架空データでのレスポンスを防止 |
| **エラーハンドリング明確化** | ハザード・環境情報の取得失敗時は空データを返却。Gemini 生成失敗時は `undefined` を返却し、フロントエンドで適切に表示 |

### PCI DSS / カード情報の非保持

決済はすべて **Stripe Checkout** にリダイレクトして行います。カード番号・有効期限・CVC などの決済情報は自社サーバー・データベースでは一切処理・保持しない設計（PCI DSS SAQ A 相当）。

### XSS・インジェクション対策

- Next.js の React 自動エスケープにより XSS を防止
- Zod によるバックエンド入力バリデーション（型・範囲チェック）
- Cloud Run（フルマネージド）上で動作。OS パッチ適用・コンテナ分離・IAM によるリソースアクセス制御を Google が管理

### リーガル・コンプライアンス

| 対応事項 | 詳細 |
|---|---|
| **生成 AI 免責事項** | AI レポート・生成画像は参考情報であることを UI と PDF に明記 |
| **国交省データクレジット** | CC BY 4.0 ライセンスに基づき「国土交通省 不動産情報ライブラリ」のクレジットをフッターに常時表示 |
| **改正電気通信事業法（外部送信規律）対応** | Firebase Analytics・PostHog・Stripe 等の外部送信について `/privacy` ページに開示 |
| **OSS ライセンス一覧** | `/licenses` ページで使用ライブラリのライセンスを自動生成・一覧表示 |
| **利用規約 / プライバシーポリシー** | `/terms`・`/privacy` ページを公開。フッターから常時アクセス可能 |

---

## 🗺 SEO 戦略と sitemap

### プログラマティック SEO（`/reports/[pref]/[city]`）

全国の主要エリアを対象に、静的パス生成（`generateStaticParams`）と ISR（24時間 revalidate）を組み合わせたエリア別レポートページを実装しています。

| 都道府県 | 対象エリア数 |
|---|---|
| 東京都（23区 + 主要市） | 26 |
| 神奈川県 | 3 |
| 大阪府 | 4 |
| 計 | **33エリア** |

### sitemap.xml（計38エントリ）

`/app/sitemap.ts` が `NEXT_PUBLIC_SITE_URL`（未設定時: `https://mekiki-research.com`）をベースに自動生成します。

| 種別 | パス | priority |
|---|---|---|
| トップページ | `/` | 1.0 |
| サービス紹介 | `/about` | 0.8 |
| 動的エリアページ | `/reports/[pref]/[city]` × 33件 | 0.7 |
| 法的ページ | `/terms`, `/privacy`, `/licenses` | 0.2〜0.3 |

```bash
# sitemap の確認
curl https://mekiki-research.com/sitemap.xml | grep "<loc>" | wc -l
# → 38
```

---

## 🧪 テストと品質保証 (QA)

### Playwright E2E テスト — 本番ドメイン対象

`frontend/tests/production_e2e.spec.ts` に、**本番環境 `https://mekiki-research.com` を対象**とした E2E テストスイートを実装しています。

```bash
cd frontend
npx playwright test tests/production_e2e.spec.ts --reporter=list
```

#### テストスイート構成

| シナリオ | テスト内容 | ステータス |
|---|---|---|
| **シナリオA** トップページ | HTTP 200 応答・主要 UI 要素の存在確認 | ✅ PASS |
| **シナリオA** トップページ | `<title>` に「物件目利きリサーチ」が含まれること | ✅ PASS |
| **シナリオB** `/about` | HTTP 200・見出し「精密調査」の存在確認 | ✅ PASS |
| **シナリオB** `/terms` | HTTP 200・見出し「利用規約」の存在確認 | ✅ PASS |
| **シナリオB** `/privacy` | HTTP 200・見出し「プライバシーポリシー」の存在確認 | ✅ PASS |
| **シナリオB** `/licenses` | HTTP 200・見出し「オープンソースライセンス」の存在確認 | ✅ PASS |
| **シナリオB** フッターリンク | 利用規約リンク → `/terms` 遷移 | ✅ PASS |
| **シナリオB** フッターリンク | プライバシーポリシーリンク → `/privacy` 遷移 | ✅ PASS |
| **シナリオC** ゲスト検索 | 1回目の検索で結果が表示されること（最大120秒） | ✅ PASS |
| **シナリオC** ゲスト上限 | 2回目の検索で WaitlistModal が表示されること | ✅ PASS |
| **シナリオC** WaitlistModal | UI 要素（メール入力・登録ボタン・キャンセルボタン）が揃っていること | ✅ PASS |
| **メタデータ** OGP | トップページの `og:title` が設定されていること | ✅ PASS |
| **メタデータ** `/terms` | `<title>` が「利用規約 \| 物件目利きリサーチ」形式であること | ✅ PASS |
| **メタデータ** `/privacy` | `<title>` が「プライバシーポリシー \| 物件目利きリサーチ」形式であること | ✅ PASS |

**全14シナリオ PASS** 確認済み（検証日: 2026-03-30）

#### テスト設計上の留意点

- シナリオC（ゲスト検索）は Cloud Run コールドスタート + MLIT API + Gemini 生成の合計時間を考慮し、テスト単体タイムアウトを120秒に設定
- `waitForFunction(fn, undefined, { timeout: 90_000 })` で Playwright の引数順（`pageFunction`, `arg?`, `options?`）を正しく指定
- ゲスト利用制限は localStorage キー `guest_last_search_date` で管理。テスト前に `page.evaluate()` でリセット

---

## ⚡ ローカル開発環境のセットアップ

### 前提条件
- Node.js 20+
- Docker（Dev Container 推奨・OrbStack 対応）
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

# Gemini / Imagen API
GEMINI_API_KEY=your-gemini-api-key

# フロントエンドが参照するバックエンド URL（Cloud Run デプロイ後に取得）
NEXT_PUBLIC_API_URL=https://your-backend-url.run.app

# 本番サイト URL（sitemap.xml / OGP に使用）
NEXT_PUBLIC_SITE_URL=https://mekiki-research.com

# Stripe（※ベータ期間中は使用しないが設定は必要）
STRIPE_SECRET_KEY=sk_test_XXX
STRIPE_PRICE_ID=price_XXX
STRIPE_WEBHOOK_SECRET=whsec_XXX

# PostHog
POSTHOG_WEBHOOK_SECRET=your-webhook-secret

# CORS（本番ドメインをカンマ区切りで指定）
ALLOWED_ORIGINS=https://mekiki-research.com
```

フロントエンドのローカル開発用に `frontend/.env.local` を作成:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000

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

### 5. Firestore Security Rules のデプロイ

```bash
# firebase.json が存在することを確認してから実行
npx firebase-tools@latest deploy --only firestore:rules --project your-project-id
```

---

## 🚀 Cloud Run へのデプロイ

### バックエンド（Cloud Build 経由）

ローカル環境に Docker が不要。`gcloud builds submit` で Cloud 上でビルドします。

```bash
source .env
IMAGE="asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/realestate-api/backend:latest"

# Cloud Build でビルド＆プッシュ
gcloud builds submit ./backend --tag "${IMAGE}" --project="${GCP_PROJECT_ID}"

# Cloud Run にデプロイ（env-vars-file 使用で URL 等の特殊文字を安全に渡す）
cat > /tmp/backend_env.yaml <<YAML
GCP_PROJECT_ID: "${GCP_PROJECT_ID}"
GCS_CACHE_BUCKET: "${GCS_CACHE_BUCKET}"
GEMINI_API_KEY: "${GEMINI_API_KEY}"
ALLOWED_ORIGINS: "${ALLOWED_ORIGINS}"
YAML

gcloud run deploy realestate-api \
  --image "${IMAGE}" \
  --region asia-northeast1 \
  --project="${GCP_PROJECT_ID}" \
  --env-vars-file /tmp/backend_env.yaml
```

### フロントエンド

```bash
source .env
bash scripts/deploy_frontend.sh
```

> **Note**: `NEXT_PUBLIC_*` はビルド時に JS バンドルへ焼き込まれるため、Cloud Run の実行時環境変数では反映されません。必ず Cloud Build のビルド引数として渡してください（`scripts/deploy_frontend.sh` 参照）。

---

## 💰 Artifact Registry コスト最適化

デプロイのたびに `:latest` タグが新しいイメージへ移動し、古いイメージはタグなし（untagged）で蓄積されます。
放置すると Artifact Registry のストレージ料金が継続的に増加するため、**クリーンアップポリシー**を設定しています。

### 対象リポジトリ

| リポジトリ | ロケーション | 用途 |
|---|---|---|
| `realestate-api` | `asia-northeast1` | `backend:latest` と `frontend:latest` イメージ |
| `cloud-run-source-deploy` | `asia-northeast1` | Cloud Run ソースデプロイ用自動生成イメージ |

### 適用ポリシー（2ルール）

| ルール名 | アクション | 条件 |
|---|---|---|
| `keep-5-most-recent` | **保持** | 各パッケージの最新5バージョンを常に保持（ロールバック用） |
| `delete-old-untagged` | **削除** | タグなし（untagged）かつ作成から1日（86400秒）以上経過したイメージ |

### ポリシーの再適用方法

設定変更が必要な場合は以下のコマンドを実行してください。

```bash
cat > /tmp/cleanup-policy.json <<'EOF'
[
  {
    "name": "keep-5-most-recent",
    "action": { "type": "Keep" },
    "mostRecentVersions": { "keepCount": 5 }
  },
  {
    "name": "delete-old-untagged",
    "action": { "type": "Delete" },
    "condition": { "tagState": "untagged", "olderThan": "86400s" }
  }
]
EOF

for REPO in realestate-api cloud-run-source-deploy; do
  gcloud artifacts repositories set-cleanup-policies "$REPO" \
    --project realestate-report-2026 \
    --location asia-northeast1 \
    --policy /tmp/cleanup-policy.json \
    --no-dry-run
done
```

> GCP がクリーンアップを実行するタイミングはプラットフォーム側のスケジュール依存ですが、通常は数時間以内に古いイメージが自動削除されます。

---

## 💳 Stripe 決済の本番稼働手順

### 現在の状態

Stripe の本番審査を経て、決済導線は**ベータ期間中は無効化**しています。
フロントエンドの以下 **1行** を変更するだけで本番稼働に切り替えられます。

```typescript
// frontend/components/PlanComparisonModal.tsx
const IS_STRIPE_APPROVED = false  // → true に変更
```

### 審査通過後の本番切り替え手順

#### Step 1 — Stripe ダッシュボードで本番用リソースを準備

1. [Stripe Dashboard](https://dashboard.stripe.com) でテストモード → **本番モード** に切り替え
2. **製品カタログ** で Proプランの商品・価格を作成 → `price_live_XXX` を控える
3. **Webhooks** でエンドポイントを登録:
   - URL: `https://<backend-cloud-run-url>/api/stripe/webhook`
   - イベント: `checkout.session.completed` / `customer.subscription.deleted`
   - 表示された `whsec_live_XXX` を控える

#### Step 2 — Cloud Run の環境変数を本番キーに更新

```bash
cat > /tmp/stripe_env.yaml <<YAML
STRIPE_SECRET_KEY: "sk_live_XXX"
STRIPE_PRICE_ID: "price_live_XXX"
STRIPE_WEBHOOK_SECRET: "whsec_live_XXX"
YAML

gcloud run services update realestate-api \
  --region asia-northeast1 \
  --project $GCP_PROJECT_ID \
  --env-vars-file /tmp/stripe_env.yaml
```

#### Step 3 — フロントエンドのフラグを変更してデプロイ

```bash
# IS_STRIPE_APPROVED = false → true に変更後
bash scripts/deploy_frontend.sh
```

#### Step 4 — 本番テスト

本番カードで少額決済を実施し、Firestore の `users/{uid}.plan` が `"pro"` になることを確認してください。

### ローカルでの Webhook テスト（開発時）

```bash
stripe login
stripe listen --forward-to http://localhost:8080/api/stripe/webhook
# → 表示された whsec_... を .env の STRIPE_WEBHOOK_SECRET に設定

# 別ターミナルでテストイベントを送信
stripe trigger checkout.session.completed \
  --add checkout_session:client_reference_id=YOUR_FIREBASE_UID
```

---

## 📁 ディレクトリ構成

```
real-estate-report-system/
├── backend/
│   └── src/
│       ├── index.ts                  # Hono エントリーポイント・secureHeaders・CORS・レートリミット
│       ├── config.ts                 # 環境変数設定
│       ├── routes/
│       │   ├── property.ts           # /api/property/* ルート定義
│       │   ├── stripe.ts             # Stripe Checkout / Webhook（ID Token 認証付き）
│       │   ├── posthog.ts            # PostHog Webhook（署名検証付き）
│       │   └── waitlist.ts           # ウェイトリスト登録
│       ├── services/
│       │   ├── mlitApi.ts            # 国交省 API クライアント
│       │   ├── geminiApi.ts          # Gemini エリア分析レポート生成
│       │   ├── imagenApi.ts          # 2段階画像生成パイプライン
│       │   └── gcsCache.ts           # GCS キャッシュ管理（30日 TTL）
│       └── utils/
│           ├── geocode.ts            # 逆ジオコーディング (GSI)
│           └── tile.ts               # タイル座標変換
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # 日本語ホームページ
│   │   ├── HomeClient.tsx            # メインページクライアントコンポーネント
│   │   ├── sitemap.ts                # sitemap.xml 自動生成（静的5件 + 動的33件 = 38件）
│   │   ├── [locale]/                 # next-intl ロケール対応ルート（en / ja）
│   │   │   ├── page.tsx              # 英語ホームページ (/en)
│   │   │   ├── reports/[pref]/[city]/# エリア別 SEO ページ（ISR 24h・全33エリア）
│   │   │   ├── about/                # サービス紹介ページ（日英）
│   │   │   ├── terms/                # 利用規約（日英）
│   │   │   ├── privacy/              # プライバシーポリシー（日英）
│   │   │   └── licenses/             # OSS ライセンス一覧（日英）
│   │   └── layout.tsx
│   ├── components/
│   │   ├── AiReport.tsx              # AI レポートアコーディオン + 暮らしイメージ生成 UI
│   │   ├── PlanComparisonModal.tsx   # ベータ案内 / 料金プラン比較（IS_STRIPE_APPROVED フラグ管理）
│   │   ├── PriceTrendChart.tsx       # 価格推移グラフ (Recharts)
│   │   ├── TransactionTable.tsx      # 取引事例テーブル
│   │   ├── SummaryCards.tsx          # 価格サマリー + ハザードカード
│   │   ├── EnvironmentInfo.tsx       # 生活環境情報カード
│   │   ├── SearchForm.tsx            # 検索フォーム + Leaflet 地図
│   │   ├── HistoryList.tsx           # 検索履歴一覧（フローティング）
│   │   └── WaitlistModal.tsx         # ゲスト上限到達時のウェイトリスト登録モーダル
│   ├── messages/
│   │   ├── ja.json                   # 日本語翻訳リソース（全ページ・全コンポーネント対応）
│   │   └── en.json                   # 英語翻訳リソース
│   ├── lib/
│   │   ├── api.ts                    # バックエンド API クライアント（getApiBase() 絶対パス・locale 対応）
│   │   ├── areas.ts                  # エリアマスターデータ（SEO・sitemap・ページ生成に使用）
│   │   ├── firebase.ts               # Firebase 初期化
│   │   ├── history.ts                # Firestore 履歴 CRUD + Storage 画像保存
│   │   ├── userPlan.ts               # プラン判定・ゲスト利用制限管理
│   │   ├── geocode.ts                # GSI ジオコーディング
│   │   └── exportPdf.ts              # PDF エクスポート
│   ├── next.config.ts                # HTTP セキュリティヘッダー（CSP / HSTS 等）設定
│   └── tests/
│       └── production_e2e.spec.ts    # Playwright E2E テスト（本番ドメイン・14シナリオ全 PASS）
├── terraform/                        # GCP インフラ IaC（Cloud Run / GCS / Artifact Registry）
├── scripts/
│   ├── deploy_frontend.sh            # フロントエンドビルド + Cloud Run デプロイ
│   └── deploy.sh                     # バックエンドデプロイ（Cloud Build 利用推奨）
├── marketing/
│   ├── launch_tweets.md              # X（Twitter）ローンチ告知ツイートツリー（初回）
│   ├── beta_launch_tweets.md         # X（Twitter）Stripe BAN → 無料ベータ公開告知ツイートツリー
│   ├── note_story.md                 # note.com 開発ストーリー記事ドラフト（初回）
│   ├── note_beta_story.md            # note.com Stripe BAN エピソード記事ドラフト
│   └── waitlist_emails.md            # ウェイトリスト登録者向けメール文面
├── firestore.rules                   # Firestore Security Rules（デプロイ済み）
├── firebase.json                     # Firebase CLI 設定
├── .env.example                      # 環境変数テンプレート
└── README.md
```

---

## 📝 注意事項

- 取引データ・AI レポートはすべて参考情報です。投資判断・購入判断の際は必ず最新の公式情報をご確認ください。
- 暮らしのイメージ画像は AI が生成した架空のイメージであり、実際の物件・街並みとは異なります。
- 国土交通省 不動産情報ライブラリ API の利用には API キーの申請が必要です（無料）。
- Gemini API / Imagen API の利用料金は Google AI Studio の料金体系に従います。

---

## 📄 ライセンス

MIT License

本サービスは国土交通省「不動産情報ライブラリ」のデータを利用しています（CC BY 4.0）。
