# 物件目利きリサーチ
### Real Estate Report System — mekiki-research.com

> 国土交通省オープンデータ × Google 生成 AI で、任意の住所・座標から
> **不動産取引価格・災害リスク・周辺環境・暮らしのイメージ**を即座に分析・可視化する SaaS 型アプリケーション。
> B2B（不動産営業の提案書作成）から B2C（住宅購入検討者の自己調査）まで幅広く対応。

🔗 **本番 URL**: https://mekiki-research.com
🚀 **ステータス**: 商用リリース済み（Lemon Squeezy 決済稼働中・GA4 ファネル計測導入済み）
📰 **ブログ自動運用**: 毎朝 JST 07:00 に Gemini 2.5 Pro が4言語の日次記事を自動生成 → 自動デプロイ

> **💳 Pro プラン（¥980/月）の決済が本番稼働中です**
> Free プランでは基本機能を無料でご利用いただけます。検索上限（ゲスト: 1回/日、Free: 3回/日）に達した際は直接プランモーダルに誘導し、Lemon Squeezy でシームレスにアップグレードできます。Pro プランでは検索無制限・PDF 出力・暮らしイメージ生成などすべての機能が利用可能です。

---

## 📋 目次

1. [使い方 (How to Use)](#-使い方-how-to-use)
2. [主な機能 (Key Features)](#-主な機能-key-features)
3. [料金プランと利用制限](#-料金プランと利用制限)
4. [システムアーキテクチャ](#-システムアーキテクチャ)
5. [ブログ完全自動化基盤（メディア運用）](#-ブログ完全自動化基盤メディア運用)
6. [GitHub Actions ワークフロー（CI/CD）](#-github-actions-ワークフローcicd)
7. [技術スタック (Tech Stack)](#-技術スタック-tech-stack)
8. [多言語対応（i18n）の仕組み](#-多言語対応i18nの仕組み)
9. [セキュリティ・コンプライアンス対策](#-セキュリティコンプライアンス対策)
10. [SEO 戦略と sitemap](#-seo-戦略と-sitemap)
11. [テストと品質保証 (QA)](#-テストと品質保証-qa)
12. [環境変数と GitHub Secrets](#-環境変数と-github-secrets)
13. [ローカル開発環境のセットアップ](#-ローカル開発環境のセットアップ)
14. [Cloud Run へのデプロイ](#-cloud-run-へのデプロイ)
15. [Artifact Registry コスト最適化](#-artifact-registry-コスト最適化)
16. [Lemon Squeezy 決済の運用手順](#-lemon-squeezy-決済の運用手順)
17. [ディレクトリ構成](#-ディレクトリ構成)
18. [注意事項](#-注意事項)
19. [ライセンス](#-ライセンス)

---

## 🚀 使い方 (How to Use)

### Step 1 — 検索・ピン留め
地図上をクリックするか、住所・地名（例：「東京都墨田区押上」）を入力して **「調査開始」** を押します。
国土交通省 不動産情報ライブラリ API から直近5年分の取引データを自動取得します。
ブログ記事末尾の CTA から遷移してきた場合は、`?lat=&lng=` クエリで検索が自動実行されます。

### Step 2 — 取引データ・リスクを確認
- **取引価格サマリー**: 平均・中央値・最小/最大・物件種別の内訳をカード表示
- **ハザード情報**: 洪水浸水深ランク・土砂災害警戒区域の有無をバッジで即視化
- **価格推移グラフ**: Recharts によるインタラクティブな年別価格トレンド
- **生活環境情報**: 用途地域・学区（小学校/中学校）・医療機関・最寄り駅

### Step 3 — AI コンサルタントのエリア分析を読む
**10項目にわたる Gemini 2.5 Flash のエリア分析**をアコーディオンで展開。

| # | セクション | Free | Pro |
|---|---|:---:|:---:|
| 1 | エリア総評 | ✅ | ✅ |
| 2 | 子育て・生活環境スコア | ✅ | ✅ |
| 3 | 歴史・地形の特徴 | ✅ | ✅ |
| 4 | 開発・再開発動向 | ✅ | ✅ |
| 5 | 活用できる補助金・助成金 | ✅ | ✅ |
| 6 | 直近のニュース・トピックス | ✅ | ✅ |
| 7 | エリアの将来予想 | ✅ | ✅ |
| 8 | 人口の増減予想 | ✅ | ✅ |
| 9 | リアルな住環境と注意点 | ✅ | ✅ |
| 10 | 不動産プロの視点：物件の魅力とおすすめポイント | ✅ | ✅ |

### Step 4 — 暮らしのイメージ画像を生成
Google アカウントでログイン後、AI レポート内の **「✨ 暮らしイメージを生成」** ボタンをクリック。
エリア総評テキストを基に Gemini がエリア固有の英語プロンプトを動的生成し、Imagen 4 で画像化します。

### Step 5 — PDF でエクスポート（Pro プラン）
右上の **「⚙️ 出力設定」** で5セクションを個別 ON/OFF し、**「📄 PDF をダウンロード」** をクリック。

### Step 6 — 履歴から復元（ログインユーザー）
右下の **「🕐 履歴」** から過去の検索を一覧表示し、当時のレポート・生成画像を即座に復元します。

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

### Pro プラン（¥980/月）— 商用リリース済み
- 検索無制限 / PDF レポート出力 / 暮らしのイメージ画像生成
- Firebase ID Token 認証 + HMAC-SHA256 Webhook 署名検証

### GA4 コンバージョンファネル計測（導入済み）

| イベント名 | 発火タイミング | 主なパラメータ |
|---|---|---|
| `click_lp_cta` | LP の「無料で試す」CTA クリック | `event_category`: "acquisition", `event_label`: "heroCta" / "bottomCta" |
| `sign_up` | 新規サインアップ完了直後 | `event_category`: "engagement", `event_label`: "email" / "google" |
| `generate_report` | 検索APIが成功し結果が表示された瞬間 | `event_label`: 都道府県＋市区町村名 |
| `reach_limit` | 日次検索上限に達してプランモーダルが開く直前 | `event_label`: "guest" / "free" |
| `view_plan_modal` | 料金モーダルが表示される直前 | `event_label`: "header" / "limit_modal" / "pdf" |
| `begin_checkout` | 決済ボタンクリック → Lemon Squeezy API 呼び出し前 | `event_label`: "Pro" |
| `purchase` | `?payment=success` リダイレクト検知時（初回のみ） | `value`: 980, `currency`: "JPY" |

---

## 📈 広告運用モニタリング（無料ダッシュボード基盤）

Web 広告の出稿効果を **無料**（Looker Studio + GA4 標準）で可視化・監視する自動化スイート。

| スクリプト | 役割 | 実行 |
|---|---|---|
| `scripts/setup_marketing_dashboard.js` | Looker Studio + GA4 接続手順 / インプレッション・CTR・CVR の指標定義を `docs/marketing_dashboard.md` に生成 | 手動 (`npm run dashboard:setup`) |
| `scripts/monitor_traffic_anomalies.js` | Cloud Run ログを解析し、同一IPから 1分あたり閾値（既定10）以上のアクセスを検知 → Bot 不正クリック監視 | `monitor_traffic.yml`（30分毎 cron） |
| `scripts/summarize_ad_performance.js` | GA4 Data API から前日の広告指標を取得しテキスト要約を Slack 送信 | `ad_daily_report.yml`（毎朝 JST 09:00 cron） |

**アラート経路**: 異常検知時、監視スクリプトは終了コード1で失敗し、GitHub のジョブ失敗通知（メール）がそのままアラートになります。`SLACK_WEBHOOK_URL` を設定すれば Slack 通知も飛びます。

**必要な Secrets / 環境変数**: `GCP_SA_KEY`, `GCP_PROJECT_ID`, `GA4_PROPERTY_ID`, `SLACK_WEBHOOK_URL`（任意）, `FRONTEND_CLOUD_RUN_SERVICE_NAME`（任意）。SA には対象 GA4 プロパティの「閲覧者」権限と Analytics Data API の有効化が必要。詳細は `.env.example` 参照。

各スクリプトは `--dry-run` / `--input <file>` でローカル検証可能（GCP/GA4 認証なしでロジック確認）。

---

## 💎 料金プランと利用制限

| 機能 | ゲスト（未ログイン） | Free（無料） | Pro（¥980/月） |
|---|:---:|:---:|:---:|
| エリア調査 | 1回/日 | 3回/日 | **無制限** |
| 取引価格サマリー・グラフ | ✅ | ✅ | ✅ |
| ハザード情報 | ✅ | ✅ | ✅ |
| AI レポート（全10項目） | ✅ | ✅ | ✅ |
| 暮らしのイメージ画像生成 | ❌ | ✅ | ✅ |
| PDF エクスポート | ❌ | ❌ | **✅** |
| 検索履歴の保存 | ❌ | ✅ | ✅ |

利用制限は localStorage（ゲスト）と Firestore（ログイン済み）で管理。

---

## 🏗 システムアーキテクチャ

本リポジトリは **3つの責務** を1つの monorepo で管理しています。

```
┌─────────────────────────────────────────────────────────────────────┐
│  ① Frontend (Next.js 16 / Cloud Run / asia-northeast1)             │
│     mekiki-research.com 本番ドメイン                                 │
│     - App Router + next-intl で 4言語ルーティング                    │
│     - ?lat=&lng= で検索を自動実行（ブログCTA・シェアURLから着地）  │
│     - HSTS / CSP / X-Frame-Options 等のセキュリティヘッダー出力     │
└───────────────────┬─────────────────────────────────────────────────┘
                    │ GET /api/property/transactions?lat=&lng=&zoom=15&locale=
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ② Backend API (Hono / Cloud Run / asia-northeast1)                │
│     realestate-api-2hctlfcy6a-an.a.run.app                          │
│     - secureHeaders() ミドルウェア / CORS / IPレートリミット         │
│     - reverseGeocode → 国土地理院 GSI                                │
│     - fetchTransactionPrices → 国交省 XIT001                         │
│     - fetchHazardInfo → XKT026 / XKT029                              │
│     - fetchEnvironmentInfo → XKT002/004/005/010/015                  │
│     - generateAreaReport → Gemini 2.5 Flash                          │
│     - GCS キャッシュ（30日 TTL・ロケール別キー）                    │
│     - Lemon Squeezy Checkout / Webhook (HMAC-SHA256 署名検証)       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ③ Automation Scripts (GitHub Actions / scripts/)                  │
│     - generate_daily_blog.js: 毎朝7時に4言語ブログ記事を生成        │
│       → 実データ取得 (上記 ② の同じAPIを叩く) → エビデンスとして引用 │
│       → 加重ランダムで全国の都市を選定（首都圏偏重を回避）          │
│       → ?lat=&lng= 形式で① のトップページにCTAリンク                │
│     - post_to_x.js: 旧 X 自動投稿（現在は無効化）                    │
│     - monitor_traffic_anomalies.js: 30分毎に不正クリック監視         │
│     - summarize_ad_performance.js: 毎朝 GA4 日次広告レポート → Slack │
│     - setup_marketing_dashboard.js: Looker Studio 手順書を生成       │
│     - deploy.sh / deploy_frontend.sh: Cloud Run 手動デプロイ         │
└─────────────────────────────────────────────────────────────────────┘

[Firebase]  Authentication / Firestore (users, history) / Storage (images)
[GA4 + GTM] click_lp_cta / sign_up / generate_report / view_plan_modal / begin_checkout / purchase
[PostHog]   行動ログ計測（Webhook 署名検証付き）
[Terraform] Cloud Run / Artifact Registry / GCS / IAM の IaC 管理
```

---

## 📰 ブログ完全自動化基盤（メディア運用）

オウンドメディア [/blog](https://mekiki-research.com/blog) は **完全自動運用** されています。
人間の介入なしに、毎朝 JST 07:00 に新規記事が4言語同時に公開され、自動的に Cloud Run にデプロイされます。

### 全体フロー

```
[GitHub Actions] generate-blog.yml (cron: "0 22 * * *" UTC = JST 07:00)
      │
      ▼
[Node 20] node scripts/generate_daily_blog.js
      │
      ├─ ① 加重ランダムで地域選定（REGION_POOL）
      ├─ ② Gemini 2.5 Pro: メタデータ生成（slug/title/desc/tags/primaryLocation/outline）
      ├─ ③ ★ 実データ取得: 本番 API /api/property/transactions?lat=&lng= を叩く
      │     → MLIT 取引データ + 国土地理院ハザード + 周辺環境 を summarize
      ├─ ④ Gemini 2.5 Pro: 本文生成（実データを引用エビデンスとして注入）
      ├─ ⑤ Gemini 2.5 Pro: 英 / 繁 / 簡 の3言語にメタ + 本文を翻訳
      └─ ⑥ frontend/content/blog/YYYY-MM-DD-<slug>.{,en,zh-TW,zh-CN}.md として保存
      │
      ▼
[Git] PAT_TOKEN で main へ直接 push
      │
      ▼ (push が deploy.yml の paths: frontend/** にマッチ → 連鎖トリガー)
      │
[GitHub Actions] deploy.yml → Cloud Build → Cloud Run デプロイ
      │
      ▼
[mekiki-research.com/blog] 4言語で記事公開
```

### 1. `scripts/generate_daily_blog.js` の仕組み（Gemini API 使用）

| 項目 | 仕様 |
|---|---|
| LLM | Google Gemini 2.5 Pro（`gemini-2.5-pro`、`GEMINI_MODEL` で上書き可） |
| SDK | `@google/genai` |
| 実行環境 | Node 20+（`fetch`/`AbortController` 標準利用） |
| 出力先 | `frontend/content/blog/YYYY-MM-DD-<slug>.md`（+ `.en.md` / `.zh-TW.md` / `.zh-CN.md`） |
| 必須環境変数 | `GEMINI_API_KEY` |
| 任意環境変数 | `GEMINI_MODEL`（既定 `gemini-2.5-pro`）<br>`BLOG_DATE`（YYYY-MM-DD で対象日上書き）<br>`BLOG_DRY_RUN=1`（API を呼ばず構成のみ確認）<br>`BLOG_API_BASE_URL`（既定: Cloud Run の本番URL）<br>`BLOG_SITE_BASE_URL`（既定: `https://mekiki-research.com`） |

**設計上の分離**: メタデータ（JSON）と本文（Markdown）は **別々の Gemini 呼び出し** で生成しています。本文を JSON 文字列に詰め込むと制御文字エスケープが破綻して `JSON.parse` が失敗するため、実運用で問題が起きた末に分離した経緯があります。

### 2. 4言語展開とSEO対策（hreflang / canonical / 構造化データ）

1記事あたり日本語 → 英語 → 繁体字 → 簡体字 の順に翻訳して、合計 **4ファイル** を生成します。

| ロケール | URL 形式 | siteLocale |
|---|---|---|
| 日本語 (`ja`) | `/blog/<slug>` | `ja_JP` |
| 英語 (`en`) | `/en/blog/<slug>` | `en_US` |
| 繁体字 (`zh-TW`) | `/zh-TW/blog/<slug>` | `zh_TW` |
| 簡体字 (`zh-CN`) | `/zh-CN/blog/<slug>` | `zh_CN` |

`frontend/app/[locale]/blog/[slug]/page.tsx` の `generateMetadata` が以下を出力します：

| SEO 要素 | 仕様 |
|---|---|
| **canonical** | `alternates.canonical = blogPathFor(currentLocale, slug)`（現在ロケールの絶対URL） |
| **hreflang alternate** | `alternates.languages` に **翻訳済みロケールのみ** を列挙（未翻訳言語は意図的に含めない、Google の品質基準に準拠） |
| **x-default** | 日本語版が存在する場合、`x-default` として日本語URLを指定 |
| **OGP** | `og:type=article`, `og:url=canonical`, `og:title`, `og:description`, `og:image` |
| **OGP 画像** | `/api/og/blog?title=...&description=...&tags=...&date=...` で記事ごとに 1200×630 を動的生成（next/og） |
| **Twitter Card** | `summary_large_image` |
| **JSON-LD** | `BlogPosting` 構造化データ（`headline`, `description`, `datePublished`, `author`, `publisher`, `keywords`） |
| **言語切替 UI** | `LanguageToggle` コンポーネントが**翻訳済みロケールのみ** をボタン表示 |

> 翻訳が片方向だけ存在する slug があった場合、未翻訳側を `hreflang` から除外することで、Google Search Console の「翻訳ペアが不一致」警告を回避しています。

### 3. ★ 実データ連動：本番APIから取得したエビデンスで本文を補強

これが本ブログ自動化システムの **最も重要な特徴** です。

メタ生成と本文生成の **間** に、`primaryLocation.lat / lng` を使ってトップページが叩くのと同じバックエンド API を叩き、実取引データ・ハザード・周辺環境を取得して本文プロンプトに注入します。

```
┌─ Stage 1: メタ生成 ────────────┐
│  Gemini → primaryLocation:     │
│    { lat, lng, name }          │
└────────────────┬───────────────┘
                 │
                 ▼ fetchAreaData(lat, lng)
┌─ Stage 2: 実データ取得（NEW）──────────────────────────┐
│  GET ${API_BASE_URL}/api/property/transactions       │
│    ?lat=<lat>&lng=<lng>&zoom=15&locale=ja            │
│  ↓                                                    │
│  summarizeAreaData() で約3〜4KBに圧縮:                │
│    - location (prefecture/municipality/cityCode)     │
│    - transactionStats (sampleCount, yearRange,       │
│        avg/median/min/max tradePrice, avgUnitPrice)  │
│    - samples (上位6件: type/use/district/price/...)  │
│    - hazard (flood / landslide)                      │
│    - environment (zoning/schools/station/medical)    │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼ jaBodyPrompt({ today, meta, areaData })
┌─ Stage 3: 本文生成 ───────────────────────────────────┐
│  Gemini プロンプトに JSON エビデンスブロックを注入:   │
│  「以下は実際にバックエンドから取得した実データです。 │
│   本文中で **複数セクション** で具体的に引用し、      │
│   推測ではなく裏付けとして専門的に分析してください」 │
│  - 価格は ○,○○○万円 形式に変換（45,320,000 → 約4,500万円） │
│  - 単価は ○○万円/㎡ 形式に変換                          │
│  - データ0件/null は捏造禁止、率直に開示              │
└──────────────────────────────────────────────────────┘
```

**API 失敗時のフォールバック**: ネットワークエラーや上流障害で実データ取得に失敗した場合は `areaData = null` のまま本文生成に進み、プロンプトは「一般公開情報・国交省統計・地価公示の傾向に基づいて執筆。具体的な数値の断定は避けること」というフォールバック指示に切り替わります。記事生成プロセス自体は止めません。

### 4. ★ 地域分散アルゴリズム：加重ランダム選定

過去の記事が首都圏（東京23区中心部）に偏る問題を解決するため、**加重ランダム** で全国の地域を意図的にローテーションします。

```javascript
// scripts/generate_daily_blog.js
const REGION_POOL = [
  { name: "関西エリア",       weight: 3, examples: "大阪市梅田・なんば、京都市..." },
  { name: "中京エリア",       weight: 2, examples: "名古屋市栄・名駅、岐阜市..." },
  { name: "北海道・東北",     weight: 2, examples: "札幌市大通、仙台市青葉区..." },
  { name: "中国・四国",       weight: 2, examples: "広島市紙屋町、岡山市..." },
  { name: "九州・沖縄",       weight: 2, examples: "福岡市天神・博多、那覇市..." },
  { name: "北陸・甲信越",     weight: 2, examples: "新潟市、金沢市、長野市..." },
  { name: "注目地方エリア",   weight: 1, examples: "ニセコ町、軽井沢、別府市..." },
  { name: "首都圏（最低頻度）", weight: 1, examples: "..." },
];
```

| 重み | 地域 | 採用確率（合計重み15） |
|---|---|---|
| 3 | 関西エリア | 20% |
| 2 | 中京 / 北海道東北 / 中国四国 / 九州沖縄 / 北陸甲信越 | 各 13.3%（合計 66.7%） |
| 1 | 注目地方エリア / 首都圏 | 各 6.7%（合計 13.3%） |

選定された地域は `jaMetaPrompt()` に **強い制約** として渡され、Gemini は以下を厳守させられます：

- 本記事は **「${region.name}」** に必ずフォーカスすること（他地域への逸脱禁止）
- 候補エリア例から具体的な都市・地区を1つ選ぶこと
- **首都圏（東京23区中心部・横浜駅周辺など）に偏ってはいけない**
- 過去30件の slug と重複しない地点を意図的に選ぶこと
- `primaryLocation.lat/lng` は **正確な実在座標** を出力（架空・近似丸めは禁止）

### 5. トップページへの動的ルーティング（CTAクエリパラメータ）

各ブログ記事の末尾には、その記事で扱った地域を **トップページで実際に検索する** ための CTA リンクが必ず挿入されます。

```markdown
## 8. まとめ

...本文の結論...

[博多駅周辺の不動産データを物件目利きリサーチで実際に調べる →](https://mekiki-research.com/?lat=33.5904&lng=130.4208)
```

**フロントエンド側の受け側ロジック**（`frontend/app/HomeClient.tsx`）：

```typescript
useEffect(() => {
  if (autoSearchTriggered.current) return;
  if (authLoading || planLoading) return;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  if (latParam && lngParam) {
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (!isNaN(lat) && !isNaN(lng)) {
      autoSearchTriggered.current = true;
      setExternalCoords({ lat, lng });
      handleSearch(lat, lng);  // クエリ着地時に即検索を発火
    }
  }
}, [authLoading, planLoading]);
```

> **設計判断**: 旧来の `?address=` ベースのシェアURL や、ベータ版の `/research` パスではなく、**本番トップページの `?lat=&lng=`** に統一しました。これにより
> ① ジオコーディングを経由しない高速着地、② ベータ機能の品質変動から記事の体験を切り離し、③ GA4 上で「ブログ流入 → 検索完了」までを一貫して計測、を達成しています。

---

## 🤖 GitHub Actions ワークフロー（CI/CD）

`.github/workflows/` 配下の5ワークフローでメディア運用 + デプロイ + 監視を完全自動化しています。

| ワークフロー | トリガー | 主な役割 | 状態 |
|---|---|---|---|
| `generate-blog.yml` | cron 22:00 UTC（毎日） + 手動 | 4言語ブログ記事を Gemini で自動生成し main へ push | 🟢 稼働中 |
| `deploy.yml` | `frontend/**` への push + 手動 | Cloud Build → Cloud Run デプロイ + sitemap ping | 🟢 稼働中 |
| `auto_merge_blog.yml` | `pull_request` + cron 毎時 | `claude/*` ブランチの自動生成 PR を main に即マージ | 🟢 稼働中（旧スケジュールエージェント救済用） |
| `blog_check.yml` | cron 01:00 UTC（毎日） | 当日記事の存在を main で検査し、なければ Issue 起票 | 🟢 稼働中 |
| `x_post.yml` | `workflow_dispatch` のみ | X 自動投稿（旧月水金 09:00 JST） | 🔴 **無効化済み（2026-05-09）** |

### 1. `generate-blog.yml` — 毎朝7時の自動記事生成

```yaml
on:
  schedule:
    - cron: "0 22 * * *"   # UTC 22:00 = JST 07:00
  workflow_dispatch:
```

| 設計上の重要ポイント | 解説 |
|---|---|
| **PAT_TOKEN による checkout / push** | デフォルトの `GITHUB_TOKEN` で push しても他ワークフローはトリガーされない（GitHub の無限ループ防止仕様）。`secrets.PAT_TOKEN`（repo + workflow スコープの PAT）を `actions/checkout` の `token` と `git remote set-url` の双方に渡すことで、push 後に **deploy.yml が連鎖起動** する設計。 |
| **concurrency: generate-daily-blog** | 同時実行を防ぎ、JST 07:00 のスケジュールと手動 dispatch が衝突しないようにする（`cancel-in-progress: false`）。 |
| **競合保護** | push 直前に `git pull --rebase origin main` を実行し、他ワークフローが先に main を進めていた場合に rebase してから push。 |
| **空コミット防止** | 生成失敗時は `git diff --cached --quiet` で検知し、`::notice::` を出して exit 0。空コミットは作らない。 |

### 2. `deploy.yml` — Cloud Run デプロイ + SEO Ping

```yaml
on:
  push:
    branches: [main]
    paths:
      - "frontend/**"           # ブログ記事追加もここに含まれる
      - "scripts/deploy_frontend.sh"
      - ".github/workflows/deploy.yml"
  workflow_dispatch:
```

ステップ:

1. `google-github-actions/auth@v2` で `GCP_SA_KEY` 認証
2. `gcloud builds submit frontend/` で Cloud Build 経由で Docker イメージビルド
   - `_NEXT_PUBLIC_*` を substitution として渡す（ビルド時バンドル焼き込み）
3. `gcloud run deploy realestate-frontend` で Cloud Run へデプロイ
4. 本番 URL に対して 6回 × 10秒間隔のヘルスチェック
5. `sitemap.xml` の到達性確認 → Google Ping（廃止 API なので非致命的） + IndexNow（Bing/Yandex）

### 3. `auto_merge_blog.yml` — PR 自動マージ（旧経路の救済）

`claude/*` ブランチで作成された自動 PR を、ホワイトリスト判定の上で即マージするワークフロー。
**現在の主経路は `generate-blog.yml` の直接 push** ですが、過去の Anthropic スケジュールエージェントが PR ベースで動作していた名残として残しています。

ホワイトリスト：

- `frontend/content/blog/*.md`
- `marketing/x_promotions.json`

これら以外を変更している PR はスキップして手動マージに委ねます。コンフリクト時は `merge-conflict` ラベルを付与して人間に委譲。

### 4. `blog_check.yml` — 当日記事の存在監視

```yaml
on:
  schedule:
    - cron: "0 1 * * *"   # UTC 01:00 = JST 10:00
  workflow_dispatch:
```

JST 10:00（生成想定時刻 07:00 から3時間後）に `frontend/content/blog/${TODAY}-*.md` の存在を確認。存在しなければ：

1. 同日タイトルの open Issue がないことを確認（重複起票防止）
2. `⚠️ Blog post missing for YYYY-MM-DD` Issue を起票
3. ジョブを `exit 1` で失敗させ、GitHub のメール通知を発火

### 5. `x_post.yml` — X 自動投稿（**現在は無効化**）

旧仕様では月・水・金 JST 09:00 に `marketing/x_promotions.json` から1ツイートをランダム選択して投稿していました。**スパム判定回避のため2026-05-09 に無効化**しています。

現在の状態：

```yaml
on:
  workflow_dispatch:   # cron スケジュールは削除済み

jobs:
  noop:
    name: Disabled (no-op)
    steps:
      - run: echo "::notice::X Auto Post is disabled."
```

旧設定（cron + post ステップ）は同ファイル末尾にコメントとして保存されています。

#### 復活させる場合の手順

1. `.github/workflows/x_post.yml` の末尾コメントブロックから cron + post ステップを復元
2. 冒頭の `name: X Auto Post (Disabled)` を `name: X Auto Post` に戻し、`noop` ジョブを削除
3. GitHub Secrets に以下を設定（無効化中も削除はしていない想定）:
   - `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
4. X (Twitter) Developer ポータルでアプリのレートリミット・スパム判定状態を確認
5. 1日1回程度の頻度に抑えた cron（例: `0 0 * * 1` の月曜のみ）で再開し、段階的に増やす
6. `node scripts/post_to_x.js --dry-run` で文面を事前検証してから本番投稿

> **再開時の注意**: 短期間に同一文面を連投するとスパム判定で **アカウント凍結リスク** があります。`marketing/x_promotions.json` の文面バリエーションを十分に増やし、頻度を抑えること。

---

## 🛠 技術スタック (Tech Stack)

### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| Next.js (App Router) | 16 | フレームワーク・SSR/ISR/CSR |
| React + TypeScript | 19 / 5 | UI コンポーネント |
| next-intl | 4.9 | i18n（4ロケール: ja/en/zh-TW/zh-CN） |
| Tailwind CSS | 4 | スタイリング |
| Leaflet (react-leaflet) | — | インタラクティブ地図（国土地理院タイル） |
| Recharts | — | 価格推移グラフ |
| ReactMarkdown + remark-gfm | — | AIレポート・ブログ記事の Markdown レンダリング |
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

### 自動化スクリプト

| 技術 | 用途 |
|---|---|
| `@google/genai` | Gemini 2.5 Pro 呼び出し（記事生成・翻訳） |
| Node 20 native `fetch` | 本番APIからの実データ取得 |
| `twitter-api-v2` | X 自動投稿用 SDK（現在は無効化） |

### インフラ・BaaS/SaaS

| サービス | 用途 |
|---|---|
| Google Cloud Run | フロントエンド・バックエンドのサーバーレスホスティング（分離構成） |
| Google Cloud Storage | API レスポンスの30日間キャッシュ |
| Google Artifact Registry | Docker イメージレジストリ |
| Google Cloud Build | CI/CD パイプライン（docker 不要・Cloud 上でビルド） |
| Firebase Authentication | Google OAuth 2.0 |
| Firebase Firestore | ユーザープラン・検索履歴の永続化 |
| Firebase Storage | AI 生成画像の永続化 |
| Lemon Squeezy | サブスクリプション決済・Webhook（本番稼働中） |
| PostHog | アクセス解析・イベントトラッキング |
| Google Analytics 4 + GTM | コンバージョンファネル計測 |
| Adobe Analytics | 補助的なトラッキング（CSPで許可済み） |
| Terraform | GCP リソースの IaC 管理 |
| GitHub Actions | CI/CD・ブログ自動生成・PR 自動マージ・監視 |

### 外部 API

| API | 用途 |
|---|---|
| 国交省 不動産情報ライブラリ API (XIT001) | 取引価格データ取得 |
| 国交省 不動産情報ライブラリ API (XKT026/029/002/004/005/010/015) | ハザード・生活環境データ取得 |
| 国土地理院 API (GSI) | 逆ジオコーディング・住所検索・地図タイル |
| Gemini 2.5 Pro | ブログ記事生成・翻訳（バッチ） |
| Gemini 2.5 Flash | エリア分析レポート / 画像プロンプト動的生成（リアルタイム） |
| Imagen 4 Fast | 暮らしのイメージ画像生成（Primary） |
| Gemini 2.5 Flash Image | 画像生成 Fallback |
| e-Stat API | 人口動態スコア（オプション） |

---

## 🌐 多言語対応（i18n）の仕組み

`next-intl` v4 を用いて **4言語**（日本語・英語・繁体字・簡体字）に対応。SSG/ISR を維持したままロケールルーティングを切り替えています。

### ルーティング構造

```
/                              → app/[locale]/page.tsx (ja, デフォルト)
/en                            → app/[locale]/page.tsx (en)
/zh-TW                         → app/[locale]/page.tsx (zh-TW)
/zh-CN                         → app/[locale]/page.tsx (zh-CN)
/blog/<slug>                   → app/[locale]/blog/[slug]/page.tsx (ja)
/en/blog/<slug>                → 〃 (en)
/reports/tokyo/shinjuku        → app/[locale]/reports/[pref]/[city]/page.tsx (ja, ISR 24h)
/en/reports/tokyo/shinjuku     → 〃 (en, ISR 24h)
```

`frontend/proxy.ts`（Next.js 16 の proxy 規約）が `next-intl` のミドルウェアをラップ。
`/api/*`、静的アセット、`/reports/[pref]/[city]`（SSG維持のため）はマッチャから除外。

### バックエンド API の多言語対応

```typescript
const res = await fetch(`${getApiBase()}/api/property/transactions?lat=...&locale=${locale}`);
```

GCS キャッシュは **ロケール別キー** で独立保持（`z15/x29100/y12901/ja`, `.../en`）。
旧キャッシュが誤ったロケールで保存されていた場合は冒頭80文字の日本語文字数（≥10）でミスマッチを検出し、再生成を依頼します。

### API クライアントの絶対パス要件

```typescript
// ✅ 正しい — 絶対パス必須
fetch(`${getApiBase()}/api/property/transactions?...`);

// ❌ NG — /en/api/... に解決されて 404
fetch(`/api/property/transactions?...`);
```

`getApiBase()` は `NEXT_PUBLIC_API_URL` → `window.location.origin` → `NEXT_PUBLIC_SITE_URL` → `http://localhost:3000` の優先順位で解決します。

### CORS とローカル開発

バックエンドは `ALLOWED_ORIGINS`（本番ドメイン）に加え、`http://localhost:3000` / `:3001` / `:8080` を常に許可。`.env` を本番ドメイン限定にしていてもローカルで `Failed to fetch` にならない設計。

---

## 🔒 セキュリティ・コンプライアンス対策

本番公開前にセキュリティ監査を実施し、以下の対策をすべて実装・デプロイ済みです。

### HTTP セキュリティヘッダー（フロントエンド・バックエンド両対応）

`next.config.ts` の `headers()` と Hono の `secureHeaders()` ミドルウェアにより、全ルートに以下を出力。

| ヘッダー | 値 | 目的 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS 強制（2年・preload 申請可能） |
| `X-Content-Type-Options` | `nosniff` | MIME タイプスニッフィング防止 |
| `X-Frame-Options` | `SAMEORIGIN` | クリックジャッキング防止 |
| `X-XSS-Protection` | `1; mode=block` | レガシーブラウザ向け XSS フィルター |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー漏洩制御 |
| `Permissions-Policy` | `camera=(), microphone=()` | 不要なブラウザ API 無効化 |
| `Content-Security-Policy` | 下記参照 | リソース読み込み元の厳格制御 |

### Content-Security-Policy（CSP）設計方針

**`frontend/next.config.ts`** で構築。アーキテクチャの全コンポーネントが連携できるよう、必要最小限のドメインだけを許可するホワイトリスト方式を採用。dev 環境のみ `http://localhost:8080` / `:3001` を `connect-src` に追加。

| ディレクティブ | 許可ドメイン | 理由 |
|---|---|---|
| `default-src` | `'self'` | 既定はオリジン同一のみ |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | Next.js / Tailwind / Firebase SDK の動的スクリプト |
| 〃 | `apis.google.com`, `www.gstatic.com` | Firebase Auth 動的スクリプト・Google API |
| 〃 | `us-assets.i.posthog.com` | PostHog アセット |
| 〃 | `assets.lemonsqueezy.com` | Lemon Squeezy チェックアウト |
| 〃 | `www.googletagmanager.com`, `www.google-analytics.com` | GTM + GA4 |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind / CSS-in-JS |
| 〃 | `fonts.googleapis.com`, `assets.lemonsqueezy.com` | フォント・LS UI |
| `img-src` | `'self' data: blob:` | base64・blob URL（PDF生成・OGP） |
| 〃 | `lh3.googleusercontent.com` | Google プロフィール写真 |
| 〃 | `firebasestorage.googleapis.com` | Firebase Storage 生成画像 |
| 〃 | `cyberjapandata.gsi.go.jp`, `maps.gsi.go.jp` | 国土地理院 地図タイル |
| 〃 | `assets.lemonsqueezy.com` | Lemon Squeezy 画像 |
| 〃 | `www.googletagmanager.com`, `www.google-analytics.com`, `*.google-analytics.com`, `analytics.google.com`, `www.google.com` | GTM / GA4 ピクセルビーコン |
| 〃 | `*.omtrdc.net`, `*.sc.omtrdc.net`, `*.2o7.net` | **Adobe Analytics** ビーコン |
| 〃 | `*.tile.openstreetmap.org` | OSM タイル（fallback） |
| `font-src` | `'self'`, `fonts.gstatic.com`, `assets.lemonsqueezy.com` | Google Fonts / LS フォント |
| `connect-src` | `'self'` | XHR/fetch/WebSocket オリジン |
| 〃 | `*.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`, `firebasestorage.googleapis.com`, `storage.googleapis.com` | Firebase / GCS |
| 〃 | `*.firebaseio.com`, `wss://*.firebaseio.com`, `*.firebaseapp.com` | Firebase Realtime / Auth iframe |
| 〃 | `*.a.run.app`, `*.run.app` | **Cloud Run バックエンド** API（asia-northeast1 は `*.a.run.app` 形式） |
| 〃 | `us.i.posthog.com`, `us-assets.i.posthog.com` | PostHog ingestion |
| 〃 | `msearch.gsi.go.jp`, `mreversegeocoder.gsi.go.jp` | 国土地理院 検索/逆ジオコーディング |
| 〃 | `app.lemonsqueezy.com`, `api.lemonsqueezy.com` | LS チェックアウト + API |
| 〃 | `www.googletagmanager.com`, `www.google-analytics.com`, `*.google-analytics.com`, `analytics.google.com`, `www.google.com`, `region1.google-analytics.com` | **GTM + GA4** データ収集（リージョン分割対応） |
| 〃 | `*.omtrdc.net`, `*.sc.omtrdc.net`, `*.2o7.net` | **Adobe Analytics** データ収集 |
| 〃 | `*.tile.openstreetmap.org` | MapLibre OSM タイル fetch |
| `frame-src` | `'self'` | iframe 同一オリジン |
| 〃 | `accounts.google.com` | Google OAuth ポップアップ |
| 〃 | `*.firebaseapp.com` | Firebase Auth hidden iframe |
| 〃 | `app.lemonsqueezy.com` | LS チェックアウト iframe |
| 〃 | `www.googletagmanager.com` | GTM noscript iframe |
| `worker-src` | `'self' blob:` | Service Worker / blob ワーカー |
| `object-src` | `'none'` | プラグイン全面禁止 |
| `base-uri` | `'self'` | `<base>` タグ改ざん防止 |

> **GTM / GA4 / Adobe Analytics の追加経緯**: c0441b6 (2026-05-06) で Google + Adobe Analytics 用ドメインを CSP に正式追加。`*.omtrdc.net` は `*.sc.omtrdc.net` を内包するが、明示性のため両方記載しています。

### 認証・認可

| 対策 | 実装内容 |
|---|---|
| **Lemon Squeezy Checkout の認証強化** | Firebase ID Token を `Authorization: Bearer` で受け取り、サーバー側で `admin.auth().verifyIdToken()` で検証。検証済み UID のみチェックアウトセッションを作成可能 |
| **Lemon Squeezy Webhook 署名検証** | `HMAC-SHA256` + `crypto.timingSafeEqual()` による署名検証。`x-signature` 不一致時は `400`。改ざんされたイベントでプランが書き換えられることを防止 |
| **Firebase Authentication** | Google OAuth 2.0 のみ。パスワードを自社管理しない |

### Firestore Security Rules（デプロイ済み）

```
// users/{uid} — 本人のみ読み書き可
allow create : plan == "free" 固定・Stripe フィールド書き込み不可
allow update : plan / stripeCustomerId / stripeSubscriptionId / planActivatedAt の直接書き換え禁止
allow delete : 禁止

// waitlist/* — クライアントから読み書き不可（バックエンド経由のみ）
// その他すべて — デフォルト拒否
```

`diff().affectedKeys()` を用いたフィールドレベルの書き込み制御により、クライアントが直接 `plan: "pro"` に書き換えることを防止。

### ネットワーク・API セキュリティ

| 対策 | 実装内容 |
|---|---|
| **CORS 設定** | 本番では `ALLOWED_ORIGINS` 環境変数で許可ドメインを厳格制限。未設定時は起動ログで警告 |
| **IPベースのレートリミット** | 15分間に100req超で `429` |
| **PostHog Webhook 署名検証** | `X-Webhook-Secret` 必須化。未設定時 `503`、不一致時 `401` |
| **ヘルスチェックエンドポイント** | `/health` から `env` フィールドを削除（内部情報漏洩防止） |

### PCI DSS / カード情報の非保持

決済はすべて **Lemon Squeezy Checkout** にリダイレクト。カード情報は自社サーバーで一切処理・保持しない（PCI DSS SAQ A 相当）。

### XSS・インジェクション対策

- Next.js の React 自動エスケープ
- Zod によるバックエンド入力バリデーション
- Cloud Run（フルマネージド）上で動作。OS パッチ・コンテナ分離・IAM は Google が管理

### リーガル・コンプライアンス

| 対応事項 | 詳細 |
|---|---|
| **生成 AI 免責事項** | AIレポート・生成画像は参考情報であることを UI と PDF に明記 |
| **国交省データクレジット** | CC BY 4.0 ライセンスに基づきフッターに常時表示 |
| **改正電気通信事業法（外部送信規律）対応** | Firebase / PostHog / GA4 / Adobe / LS 等の外部送信を `/privacy` で開示 |
| **OSS ライセンス一覧** | `/licenses` で自動生成・一覧表示 |
| **利用規約 / プライバシーポリシー** | `/terms` / `/privacy` をフッターから常時アクセス可能 |

---

## 🗺 SEO 戦略と sitemap

### プログラマティック SEO（`/reports/[pref]/[city]`）

`generateStaticParams` + ISR（24時間 revalidate）で全国主要33エリアのレポートページを生成。

| 都道府県 | 対象エリア数 |
|---|---|
| 東京都（23区 + 主要市） | 26 |
| 神奈川県 | 3 |
| 大阪府 | 4 |
| 計 | **33エリア** |

### sitemap.xml

`/app/sitemap.ts` が `NEXT_PUBLIC_SITE_URL` をベースに自動生成。記事URLは `frontend/content/blog/` の Markdown を読み取って動的に追加されます。

| 種別 | パス | priority |
|---|---|---|
| トップページ | `/` | 1.0 |
| サービス紹介 | `/about` | 0.8 |
| 動的エリアページ | `/reports/[pref]/[city]` × 33 | 0.7 |
| ブログ記事 | `/blog/<slug>` × N（4言語ぶん） | 0.6 |
| 法的ページ | `/terms`, `/privacy`, `/licenses` | 0.2〜0.3 |

`deploy.yml` のデプロイ後ステップで Google Ping（廃止 API のため非致命的）+ IndexNow（Bing/Yandex）を発火。

---

## 🧪 テストと品質保証 (QA)

### Playwright E2E テスト — 本番ドメイン対象

`frontend/tests/production_e2e.spec.ts` に、本番環境 `https://mekiki-research.com` を対象とした14シナリオを実装。

```bash
cd frontend
npx playwright test tests/production_e2e.spec.ts --reporter=list
```

主要シナリオ：

- ホーム / about / terms / privacy / licenses の HTTP 200 + 主要見出しの存在確認
- フッターリンクの遷移確認（terms/privacy）
- ゲスト1回検索 → 結果表示（最大120秒タイムアウト：Cloud Run コールドスタート + MLIT API + Gemini 生成の合計を考慮）
- ゲスト2回目 → `PlanComparisonModal` 表示
- メタデータ（OGP・title）確認

### ブログ生成スクリプトのローカル検証

```bash
# ドライラン（API を呼ばずプロンプト構成のみ確認）
BLOG_DRY_RUN=1 node scripts/generate_daily_blog.js

# 実行（GEMINI_API_KEY 必須・実 API を叩く）
GEMINI_API_KEY=... node scripts/generate_daily_blog.js

# 日付を指定して既存ファイルとの衝突を回避
BLOG_DATE=2026-12-31 GEMINI_API_KEY=... node scripts/generate_daily_blog.js
```

---

## 🔑 環境変数と GitHub Secrets

### GitHub Secrets（Settings → Secrets and variables → Actions）

| Secret 名 | 設定先ワークフロー | 目的 |
|---|---|---|
| **`PAT_TOKEN`** | `generate-blog.yml` | repo + workflow スコープの Personal Access Token。デフォルトの `GITHUB_TOKEN` では他ワークフローを連鎖トリガーできない仕様への対処。push 後に `deploy.yml` を発火させるために必須 |
| **`GEMINI_API_KEY`** | `generate-blog.yml` | Gemini 2.5 Pro 呼び出し用 API キー（記事生成・翻訳） |
| `GCP_SA_KEY` | `deploy.yml` | Cloud Run / Artifact Registry / Cloud Build へのデプロイ権限を持つサービスアカウントの JSON キー |
| `GCP_PROJECT_ID` | `deploy.yml` | GCP プロジェクト ID |
| `GCP_REGION` | `deploy.yml` | デプロイリージョン（`asia-northeast1`） |
| `NEXT_PUBLIC_API_URL` | `deploy.yml` | バックエンド Cloud Run の URL（ビルド時にバンドル焼き込み） |
| `NEXT_PUBLIC_SITE_URL` | `deploy.yml` | 本番サイトURL（OGP / sitemap / canonical 用） |
| `NEXT_PUBLIC_FIREBASE_API_KEY` 他 | `deploy.yml` | Firebase Web SDK 設定 7変数 |
| `NEXT_PUBLIC_POSTHOG_KEY` | `deploy.yml` | PostHog プロジェクトキー |
| `ESTAT_API_KEY` | `deploy.yml` | e-Stat API 人口動態スコア用（オプション） |
| `INDEXNOW_KEY` | `deploy.yml` | IndexNow（Bing/Yandex）の認証キー（オプション） |
| `X_API_KEY` 他 | `x_post.yml` (無効化中) | X Developer の Consumer/Access Token 4種（復活時のみ必要） |
| `GITHUB_TOKEN` | `auto_merge_blog.yml`, `blog_check.yml` | デフォルト発行。明示設定不要 |

### バックエンド環境変数（Cloud Run の `--env-vars-file`）

| 変数名 | 必須 | 用途 |
|---|---|---|
| `GCP_PROJECT_ID` | ✅ | GCP プロジェクト |
| `GCP_REGION` | ✅ | リージョン |
| `GCS_CACHE_BUCKET` | ✅ | キャッシュ用バケット |
| `MLIT_API_KEY` | ✅ | 国交省 不動産情報ライブラリ API |
| `MLIT_API_BASE_URL` | ✅ | `https://www.reinfolib.mlit.go.jp/ex-api/external` |
| `GEMINI_API_KEY` | ✅ | エリア分析・画像プロンプト生成 |
| `FIREBASE_PROJECT_ID` | △ | 省略時 `GCP_PROJECT_ID` を使用 |
| `ALLOWED_ORIGINS` | ✅ | CORS 許可ドメイン（カンマ区切り） |
| `CACHE_TTL_DAYS` | △ | 既定 30 |
| `LEMONSQUEEZY_API_KEY` | ✅ | LS REST API |
| `LEMONSQUEEZY_STORE_ID` | ✅ | LS ストア |
| `LEMONSQUEEZY_VARIANT_ID` | ✅ | Pro プランのバリアント |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | ✅ | HMAC-SHA256 署名検証 |
| `LEMONSQUEEZY_SUCCESS_URL` | ✅ | 決済完了リダイレクト先 |
| `POSTHOG_WEBHOOK_SECRET` | ✅ | PostHog Webhook 署名検証 |
| `ESTAT_API_KEY` | △ | 人口動態スコア（未設定時はフォールバック） |
| `PORT` | ❌ | Cloud Run 予約変数のため指定禁止 |

### 自動化スクリプトの環境変数

`scripts/generate_daily_blog.js` で利用：

| 変数名 | 必須 | 既定値 | 用途 |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Gemini 2.5 Pro |
| `GEMINI_MODEL` | ❌ | `gemini-2.5-pro` | モデル切替 |
| `BLOG_DATE` | ❌ | JST 本日 | 対象日上書き |
| `BLOG_DRY_RUN` | ❌ | — | `1` で API 呼び出しスキップ |
| `BLOG_API_BASE_URL` | ❌ | `https://realestate-api-2hctlfcy6a-an.a.run.app` | 実データ取得先 |
| `BLOG_SITE_BASE_URL` | ❌ | `https://mekiki-research.com` | CTA リンクのドメイン |

---

## ⚡ ローカル開発環境のセットアップ

### 前提条件
- Node.js 20+
- Docker（Dev Container 推奨・OrbStack 対応）
- GCP プロジェクト（Cloud Run / GCS / Artifact Registry 有効化済み）
- Firebase プロジェクト（Auth / Firestore / Storage 有効化済み）

### 1. クローン + 環境変数

```bash
git clone <repo-url>
cd real-estate-report-system
cp .env.example .env                           # ルート（バックエンド・スクリプト用）
cp frontend/.env.local.example frontend/.env.local
# 各値を埋める
```

### 2. バックエンド起動

```bash
cd backend && npm install && npm run dev   # http://localhost:8080
```

### 3. フロントエンド起動

```bash
cd frontend && npm install && npm run dev  # http://localhost:3000
```

### 4. ブログ生成スクリプトの動作確認

```bash
# プロジェクトルートから
BLOG_DRY_RUN=1 node scripts/generate_daily_blog.js  # 構成確認のみ
GEMINI_API_KEY=... node scripts/generate_daily_blog.js  # 実際に1記事生成
```

### 5. Firestore Security Rules のデプロイ

```bash
npx firebase-tools@latest deploy --only firestore:rules --project your-project-id
```

---

## 🚀 Cloud Run へのデプロイ

### バックエンド（手動）

```bash
bash scripts/deploy.sh
```

`deploy.sh` は `.env` を読み込み、Docker ビルド → Artifact Registry プッシュ → Cloud Run デプロイまで一括。

> **環境変数の更新だけ行いたい場合**
>
> `--set-env-vars` は **指定変数だけに置き換え（他は消える）** ため危険です。`--env-vars-file` を使ってください。`PORT` は Cloud Run 予約変数のため除外が必要です。
>
> ```bash
> source .env
> cat > /tmp/backend_env.yaml <<YAML
> GCP_PROJECT_ID: "${GCP_PROJECT_ID}"
> GCS_CACHE_BUCKET: "${GCS_CACHE_BUCKET}"
> MLIT_API_KEY: "${MLIT_API_KEY}"
> # ... 他必須変数を YAML に列挙
> YAML
>
> gcloud run services update realestate-api \
>   --region asia-northeast1 \
>   --env-vars-file /tmp/backend_env.yaml
> ```

### フロントエンド（自動・GitHub Actions）

`frontend/**` への push をトリガーに `deploy.yml` が実行されます。手動デプロイする場合：

```bash
gh workflow run deploy.yml
# または
source .env
bash scripts/deploy_frontend.sh
```

> **Note**: `NEXT_PUBLIC_*` はビルド時バンドル焼き込みのため、Cloud Run の実行時環境変数では反映されません。必ず Cloud Build の substitution として渡してください（`scripts/deploy_frontend.sh` 参照）。

---

## 💰 Artifact Registry コスト最適化

`:latest` タグの移動で蓄積される untagged イメージのストレージ料金を抑えるため、クリーンアップポリシーを適用しています。

| ポリシー | 動作 |
|---|---|
| `keep-5-most-recent` | 各パッケージの最新5バージョンを常に保持 |
| `delete-old-untagged` | タグなし & 86400秒（1日）以上経過したイメージを削除 |

```bash
cat > /tmp/cleanup-policy.json <<'EOF'
[
  { "name": "keep-5-most-recent", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 5 } },
  { "name": "delete-old-untagged", "action": { "type": "Delete" }, "condition": { "tagState": "untagged", "olderThan": "86400s" } }
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

---

## 💳 Lemon Squeezy 決済の運用手順

### 決済フロー

```
[Free ユーザー]
  → 「Pro にアップグレード」ボタン または プランモーダル CTA をクリック
  → POST /api/lemonsqueezy/create-checkout（Firebase ID Token 認証）
  → Lemon Squeezy Checkout ページにリダイレクト
  → 決済完了
  → Lemon Squeezy が Webhook 送信
  → POST /api/lemonsqueezy/webhook
    - HMAC-SHA256 署名検証（x-signature）
    - subscription_created / subscription_updated → users/{uid}.plan = "pro"
    - subscription_expired / subscription_cancelled → users/{uid}.plan = "free"
  → ヘッダーバッジが Free → Pro に変わり、全機能が解放される
```

### Lemon Squeezy ダッシュボード設定

| 項目 | 値 |
|---|---|
| Webhook URL | `https://realestate-api-2hctlfcy6a-an.a.run.app/api/lemonsqueezy/webhook` |
| Signing Secret | `.env` の `LEMONSQUEEZY_WEBHOOK_SECRET` と一致させる |
| イベント | `subscription_created`, `subscription_updated`, `subscription_expired`, `subscription_cancelled` |

### キーの更新

```bash
gcloud run services update realestate-api \
  --region asia-northeast1 \
  --update-env-vars="LEMONSQUEEZY_API_KEY=新しいキー,LEMONSQUEEZY_WEBHOOK_SECRET=新しいSecret"
```

### ローカルでの Webhook テスト

```bash
PAYLOAD='{"meta":{"event_name":"subscription_created","custom_data":{"uid":"YOUR_FIREBASE_UID"}},"data":{"id":"sub_xxx","attributes":{"status":"active","customer_id":123}}}'
SECRET="your-webhook-secret"
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -X POST http://localhost:8080/api/lemonsqueezy/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIG" \
  -d "$PAYLOAD"
```

---

## 📁 ディレクトリ構成

```
real-estate-report-system/
├── .github/
│   └── workflows/
│       ├── generate-blog.yml           # 毎朝7時のブログ自動生成（PAT_TOKENで連鎖デプロイ）
│       ├── deploy.yml                  # Cloud Build + Cloud Run デプロイ + sitemap ping
│       ├── auto_merge_blog.yml         # claude/* PR の自動マージ（旧経路救済）
│       ├── blog_check.yml              # 当日記事の存在確認 → 未生成時は Issue 起票
│       └── x_post.yml                  # X 自動投稿（DISABLED 2026-05-09）
├── backend/
│   └── src/
│       ├── index.ts                    # Hono エントリ・secureHeaders・CORS・レートリミット
│       ├── config.ts                   # 環境変数設定
│       ├── routes/
│       │   ├── property.ts             # /api/property/* — 取引データ・画像生成
│       │   ├── lemonsqueezy.ts         # Checkout + Webhook（ID Token + HMAC-SHA256）
│       │   ├── posthog.ts              # PostHog Webhook（署名検証）
│       │   └── waitlist.ts             # 旧ウェイトリスト（廃止予定）
│       ├── services/
│       │   ├── mlitApi.ts              # 国交省 API クライアント
│       │   ├── geminiApi.ts            # Gemini エリア分析レポート生成
│       │   ├── imagenApi.ts            # 2段階画像生成パイプライン
│       │   └── gcsCache.ts             # GCS キャッシュ（30日 TTL・ロケール別キー）
│       └── utils/
│           ├── geocode.ts              # 逆ジオコーディング (GSI)
│           └── tile.ts                 # タイル座標変換
├── frontend/
│   ├── app/
│   │   ├── HomeClient.tsx              # ?lat=&lng= で自動検索する着地ロジック
│   │   ├── api/
│   │   │   ├── og/route.tsx            # トップページ用 OGP 画像生成
│   │   │   ├── og/blog/route.tsx       # ブログ記事用 OGP 画像生成
│   │   │   ├── research-og/route.tsx   # research ページ用 OGP
│   │   │   ├── sitemap/route.ts        # sitemap.xml（rewrites でルーティング）
│   │   │   └── robots/route.ts         # robots.txt
│   │   ├── [locale]/
│   │   │   ├── page.tsx                # ホーム（4ロケール対応）
│   │   │   ├── blog/page.tsx           # ブログ一覧
│   │   │   ├── blog/[slug]/page.tsx    # ブログ詳細（hreflang/canonical/JSON-LD）
│   │   │   ├── reports/[pref]/[city]/  # エリア別 SEO ページ（ISR 24h・全33エリア）
│   │   │   ├── research/               # β版機能ページ
│   │   │   ├── about/, terms/, privacy/, licenses/
│   │   │   └── layout.tsx
│   │   └── ...
│   ├── content/
│   │   └── blog/                       # YYYY-MM-DD-<slug>.{,en,zh-TW,zh-CN}.md
│   ├── components/                     # AiReport / SearchForm / PlanComparisonModal 等
│   ├── messages/{ja,en,zh-TW,zh-CN}.json   # next-intl 翻訳辞書
│   ├── lib/
│   │   ├── api.ts                      # getApiBase() + fetchTransactions() 等
│   │   ├── blog/                       # ブログ Markdown ローダー + マップスタイル
│   │   ├── research/                   # 人口動態 / 地震 / 類似検索 (β機能)
│   │   ├── geo/, links/, parsers/, schemas/, scoring/, debug/
│   │   ├── firebase.ts, gtag.ts, analytics.ts, posthog.ts
│   │   ├── userPlan.ts                 # プラン判定・ゲスト制限
│   │   └── exportPdf.ts                # PDF エクスポート
│   ├── proxy.ts                        # next-intl ロケールルーティング
│   ├── next.config.ts                  # CSP / HSTS / rewrites（sitemap・robots）
│   ├── cloudbuild.yaml                 # Cloud Build substitution 定義
│   └── tests/production_e2e.spec.ts    # Playwright E2E（本番ドメイン・14シナリオ）
├── scripts/
│   ├── generate_daily_blog.js          # ブログ自動生成（Gemini + 実データ + 地域分散）
│   ├── post_to_x.js                    # X 自動投稿（無効化中）
│   ├── deploy.sh                       # バックエンド手動デプロイ
│   ├── deploy_frontend.sh              # フロントエンド手動デプロイ
│   ├── terraform_apply.sh              # Terraform 適用ヘルパー
│   └── test_local.sh                   # ローカル疎通テスト
├── terraform/                          # GCP IaC（Cloud Run / GCS / Artifact Registry / IAM）
├── marketing/
│   ├── x_promotions.json               # X 投稿文面プール（再開時に使用）
│   ├── launch_tweets.md, beta_launch_tweets.md
│   ├── note_story.md, note_beta_story.md
│   └── waitlist_emails.md
├── firestore.rules                     # Firestore Security Rules
├── firebase.json                       # Firebase CLI 設定
├── .env.example                        # ルート環境変数テンプレート
├── package.json                        # `post:x` / `generate:blog` npm scripts
└── README.md                           # 本ファイル
```

---

## 📝 注意事項

- 取引データ・AI レポート・自動生成ブログ記事はすべて参考情報です。投資判断・購入判断の際は必ず最新の公式情報をご確認ください。
- 暮らしのイメージ画像は AI が生成した架空のイメージであり、実際の物件・街並みとは異なります。
- 国土交通省 不動産情報ライブラリ API の利用には API キーの申請が必要です（無料）。
- Gemini API / Imagen API の利用料金は Google AI Studio の料金体系に従います。
- ブログ自動生成は1日1記事 × 4言語 = 4ファイルを Gemini 2.5 Pro で呼び出すため、`GEMINI_API_KEY` の課金枠に余裕を持たせてください。

---

## 📄 ライセンス

MIT License

本サービスは国土交通省「不動産情報ライブラリ」のデータを利用しています（CC BY 4.0）。
