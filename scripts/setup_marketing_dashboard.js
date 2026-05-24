#!/usr/bin/env node
/**
 * setup_marketing_dashboard.js
 *
 * 広告運用向け「無料モニターダッシュボード」(Looker Studio + GA4) のセットアップ手順書を
 * Markdown で生成する。次の2ファイルを出力する:
 *   - docs/marketing_dashboard.md      … 全体設計・指標定義・接続手順 (概念編)
 *   - docs/looker_studio_setup_guide.md … 各グラフの具体的な設定・計算フィールド
 *                                          コピペ集・GA4 探索での計測確認手順 (実装編)
 *
 * 使い方:
 *   node scripts/setup_marketing_dashboard.js            # 両ファイルを docs/ に書き出す
 *   node scripts/setup_marketing_dashboard.js --stdout   # 両ファイルを標準出力に出す (書き込まない)
 *   node scripts/setup_marketing_dashboard.js --out path # 概念編(marketing_dashboard.md) の出力先を指定
 *
 * 任意の環境変数 (未設定でもプレースホルダで生成する):
 *   GA4_MEASUREMENT_ID  — GA4 測定ID (例: G-MF8SLJ81D2)
 *   GA4_PROPERTY_ID     — GA4 プロパティ番号 (例: 123456789) — Data API / 接続で使用
 *   NEXT_PUBLIC_SITE_URL — 本番サイトURL (例: https://mekiki-research.com)
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const STDOUT_ONLY = args.includes("--stdout");
const outIdx = args.indexOf("--out");
const OUT_PATH =
  outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(process.cwd(), args[outIdx + 1])
    : path.resolve(__dirname, "../docs/marketing_dashboard.md");

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "G-MF8SLJ81D2";
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || "<GA4_PROPERTY_ID>";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mekiki-research.com").replace(/\/$/, "");

const GENERATED_AT = new Date().toISOString();

const md = `# 広告運用モニターダッシュボード セットアップ手順 (Looker Studio + GA4)

> このファイルは \`scripts/setup_marketing_dashboard.js\` により自動生成されています。
> 直接編集せず、スクリプト側を更新して再生成してください。
> 生成日時: ${GENERATED_AT}

Web 広告の出稿効果を **無料** (Looker Studio + GA4 標準) で可視化するためのテンプレート構成です。
GA4 の測定ID \`${MEASUREMENT_ID}\` / プロパティ \`${PROPERTY_ID}\` を前提とします。

---

## 0. 全体像

\`\`\`
[広告 (Google/Meta/X)] --UTM付きURL--> [LP ${SITE_URL}/lp]
        │ impression(到達)             │ click_lp_cta
        ▼                              ▼
  GA4 session_start / page_view    GA4 click_lp_cta イベント
        │                              │
        └──────────────┬───────────────┘
                       ▼
              [GA4 プロパティ ${PROPERTY_ID}]
                       │ (標準データソースコネクタ)
                       ▼
              [Looker Studio レポート]  ← 本手順で構築
\`\`\`

広告計測の3指標は次のファネルで定義します。

| 指標 | 定義 | 元になる GA4 イベント |
|---|---|---|
| **インプレッション (到達)** | 広告URLパラメータ付きで LP に着地したセッション数 | \`session_start\` (utm 付き) |
| **クリック (CTA)** | LP の「無料で試す」CTA クリック数 | \`click_lp_cta\` |
| **コンバージョン** | サインアップ / 課金開始 | \`sign_up\` / \`begin_checkout\` / \`purchase\` |
| **CTR** | クリック ÷ インプレッション | 計算フィールド |
| **CVR** | コンバージョン ÷ クリック | 計算フィールド |

> 注: GA4 は「広告表示回数 (ad impression)」そのものは計測しません。ここでの
> インプレッションは「広告経由で LP に到達したセッション = 着地インプレッション」を指します。
> 純粋な広告表示回数が必要な場合は Google Ads / Meta 広告マネージャ側のレポートを併用してください。

---

## 1. 広告URLの UTM 命名規則 (出稿側で必須)

すべての広告リンクは LP (\`${SITE_URL}/lp\`) に対して以下の UTM パラメータを付与してください。
これが無いと GA4 上で広告流入を分離できません。

| パラメータ | 用途 | 例 |
|---|---|---|
| \`utm_source\` | 媒体 | \`google\` / \`meta\` / \`x\` / \`yahoo\` |
| \`utm_medium\` | 種別 | \`cpc\` / \`display\` / \`paid_social\` |
| \`utm_campaign\` | キャンペーン名 | \`2026q2_launch\` |
| \`utm_content\` | クリエイティブ識別 | \`banner_a\` / \`video_b\` |
| \`utm_term\` | キーワード (検索広告) | \`不動産_調査\` |

**URL 例:**

\`\`\`
${SITE_URL}/lp?utm_source=google&utm_medium=cpc&utm_campaign=2026q2_launch&utm_content=banner_a
\`\`\`

---

## 2. GA4 データソースを Looker Studio に接続する手順

1. [Looker Studio](https://lookerstudio.google.com/) を開き **「空のレポートを作成」**。
2. データソース選択で **「Google アナリティクス」** コネクタを選ぶ。
3. アカウント → プロパティ \`${PROPERTY_ID}\` (測定ID \`${MEASUREMENT_ID}\`) を選択して **「追加」**。
4. レポートに GA4 データソースが接続される。以降の表・グラフはこのデータソースを参照する。

> GA4 の標準コネクタは **SQL を書きません**。ディメンション / 指標 / 計算フィールドを
> GUI で組み合わせます (下記 §3, §4)。BigQuery Export を使う場合のみ §6 の SQL 相当クエリを参照。

---

## 3. 使用するディメンション・指標 (GA4 標準フィールド)

### ディメンション

| Looker Studio フィールド | GA4 API 名 | 用途 |
|---|---|---|
| セッションの参照元 | \`sessionSource\` | 媒体別の分解 (google/meta…) |
| セッションのメディア | \`sessionMedium\` | cpc/display… |
| セッションのキャンペーン | \`sessionCampaign\` | キャンペーン別 |
| イベント名 | \`eventName\` | click_lp_cta / sign_up 等の絞り込み |
| ランディングページ | \`landingPagePlusQueryString\` | /lp 着地の確認 |
| 日付 | \`date\` | 時系列 |

### 指標

| Looker Studio フィールド | GA4 API 名 | 用途 |
|---|---|---|
| セッション | \`sessions\` | インプレッション(到達)の母数 |
| イベント数 | \`eventCount\` | 任意イベントの発生数 |
| 主要イベント数(コンバージョン) | \`keyEvents\` | sign_up 等をキーイベント化した数 |
| アクティブユーザー | \`activeUsers\` | 補助指標 |

---

## 4. 計算フィールド (Calculated Fields) の定義案

Looker Studio の「フィールドを追加」で以下を作成します。
イベント別カウントは \`CASE\` でイベント名を判定して合算するのが GA4 コネクタでの定石です。

### 4-1. 広告インプレッション (到達セッション)

媒体が \`cpc\` / \`paid_social\` / \`display\` のセッション数。

\`\`\`
Ad Impressions =
CASE
  WHEN REGEXP_MATCH(sessionMedium, '^(cpc|ppc|paid_social|display)$') THEN sessions
  ELSE 0
END
\`\`\`

### 4-2. LP CTA クリック数

\`\`\`
LP CTA Clicks =
CASE WHEN eventName = 'click_lp_cta' THEN eventCount ELSE 0 END
\`\`\`

### 4-3. サインアップ数 (コンバージョン)

\`\`\`
Sign Ups =
CASE WHEN eventName = 'sign_up' THEN eventCount ELSE 0 END
\`\`\`

### 4-4. 課金開始数 (補助コンバージョン)

\`\`\`
Begin Checkouts =
CASE WHEN eventName = 'begin_checkout' THEN eventCount ELSE 0 END
\`\`\`

### 4-5. CTR (クリック率)

\`\`\`
CTR = LP CTA Clicks / NARY_MAX(Ad Impressions, 1)
\`\`\`

※ \`LP CTA Clicks\` / \`Ad Impressions\` は既に集計済みの指標なので **\`SUM()\` で再集計しない**
   (Looker Studio で「集計の中に集計」エラーになる)。\`NARY_MAX(..., 1)\` でゼロ除算を回避。
   表示形式は「パーセント」。

### 4-6. CVR (コンバージョン率)

\`\`\`
CVR = Sign Ups / NARY_MAX(LP CTA Clicks, 1)
\`\`\`

---

## 5. 推奨レポート構成 (ページ・チャート)

| セクション | チャート種別 | ディメンション | 指標 |
|---|---|---|---|
| 日次トレンド | 時系列グラフ | \`date\` | Ad Impressions / LP CTA Clicks / Sign Ups |
| 媒体別パフォーマンス | 表 (棒グラフ付き) | \`sessionSource\` × \`sessionMedium\` | Ad Impressions, LP CTA Clicks, CTR, CVR |
| キャンペーン別 | 表 | \`sessionCampaign\` | Ad Impressions, Sign Ups, CVR |
| ファネル | スコアカード ×3 | — | Ad Impressions → LP CTA Clicks → Sign Ups |
| クリエイティブ比較 | 表 | \`sessionContent\` (utm_content) | LP CTA Clicks, CTR |

期間コントロール (Date range control) と媒体フィルタ (Drop-down: \`sessionSource\`) を
レポート上部に配置すると運用しやすい。

---

## 6. (任意) BigQuery Export を使う場合の SQL 相当クエリ

GA4 → BigQuery Export を有効化している場合、Looker Studio で「カスタムクエリ」として
以下を貼り付けると同じ指標を取得できます (テーブルは \`analytics_${PROPERTY_ID}.events_*\`)。

\`\`\`sql
SELECT
  PARSE_DATE('%Y%m%d', event_date)                         AS date,
  traffic_source.source                                    AS source,
  traffic_source.medium                                    AS medium,
  COUNTIF(event_name = 'session_start')                    AS impressions,
  COUNTIF(event_name = 'click_lp_cta')                     AS lp_cta_clicks,
  COUNTIF(event_name = 'sign_up')                          AS sign_ups,
  COUNTIF(event_name = 'begin_checkout')                   AS begin_checkouts,
  SAFE_DIVIDE(COUNTIF(event_name = 'click_lp_cta'),
              NULLIF(COUNTIF(event_name = 'session_start'), 0)) AS ctr,
  SAFE_DIVIDE(COUNTIF(event_name = 'sign_up'),
              NULLIF(COUNTIF(event_name = 'click_lp_cta'), 0))  AS cvr
FROM \`analytics_${PROPERTY_ID}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN
  FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY date, source, medium
ORDER BY date DESC;
\`\`\`

---

## 7. 関連ドキュメント・自動化

- **実装編**: 各グラフの具体的な設定値と計算フィールドのコピペ集、GA4「探索」での
  計測確認手順は \`docs/looker_studio_setup_guide.md\` を参照。
- 日次のテキスト要約は \`scripts/summarize_ad_performance.js\` が GA4 Data API から取得し
  Slack / メールに送信します (毎朝定時、Looker Studio を見に行かなくても届く)。
- 不正クリック監視は \`scripts/monitor_traffic_anomalies.js\` が Cloud Run ログを解析します。
`;

// ─── 実装編: Looker Studio 具体設定ガイド ───────────────────────────────────
const GUIDE_PATH = path.resolve(__dirname, "../docs/looker_studio_setup_guide.md");

const guide = `# Looker Studio レポート構築 詳細設定指示書 (実装編)

> このファイルは \`scripts/setup_marketing_dashboard.js\` により自動生成されています。
> 直接編集せず、スクリプト側を更新して再生成してください。
> 生成日時: ${GENERATED_AT}

概念編 (\`docs/marketing_dashboard.md\`) を前提に、Looker Studio の管理画面で
**そのまま設定できる粒度** まで具体化したものです。GA4 プロパティ \`${PROPERTY_ID}\`
(測定ID \`${MEASUREMENT_ID}\`) を接続済みのレポートを対象とします。

> **フィールド名について**: 数式・表中のフィールド名は GA4 コネクタの
> **Looker Studio 表示名** (例: \`Event name\`, \`Event count\`, \`Sessions\`,
> \`Session source\`, \`Session medium\`) を使用しています。概念編の GA4 API 名
> (\`eventName\` 等) とは表記が異なる点に注意してください。
> 文字列リテラルは Looker Studio 数式の仕様に従い **ダブルクォート** で囲みます。

---

## STEP 0. 作成順序 (推奨)

1. §1 で **計算フィールド** をデータソースに6個作成する (グラフより先に作る)。
2. §2〜§3 の表に従って各グラフを配置する。
3. §4 でレポート上部に **期間コントロール** と **媒体フィルタ** を置く。
4. §5 の手順で GA4「探索」を使い、\`click_lp_cta\` / \`sign_up\` が
   実際に計測されているかを確認する。

---

## STEP 1. 計算フィールドの作成 (6個)

**操作手順:**

1. レポート編集画面で **［リソース］→［追加済みのデータソースの管理］** を開く。
2. 対象の GA4 データソースの **［編集］** をクリック。
3. 右上の **［フィールドを追加］→［計算フィールドを追加］** をクリック。
4. 下表の「フィールド名」を入力し、「数式」をコピペして貼り付ける。
5. データタイプ / デフォルトの集計 / 表示形式を表のとおり設定して **［保存］**。

| # | フィールド名 (そのまま入力) | データタイプ | 集計 | 表示形式 |
|---|---|---|---|---|
| 1 | \`Ad Impressions\` | 数値 | 合計 | 数値 |
| 2 | \`LP CTA Clicks\` | 数値 | 合計 | 数値 |
| 3 | \`Sign Ups\` | 数値 | 合計 | 数値 |
| 4 | \`Begin Checkouts\` | 数値 | 合計 | 数値 |
| 5 | \`CTR\` | 数値 | 自動 | パーセント |
| 6 | \`CVR\` | 数値 | 自動 | パーセント |

### 数式 (コピペ用)

**1. Ad Impressions** — 広告 medium のセッション数 (= 着地インプレッション)

\`\`\`
CASE
  WHEN REGEXP_MATCH(Session medium, "^(cpc|ppc|paid_social|paidsearch|display|paid)$") THEN Sessions
  ELSE 0
END
\`\`\`

**2. LP CTA Clicks** — LP「無料で試す」CTA クリック数

\`\`\`
CASE WHEN Event name = "click_lp_cta" THEN Event count ELSE 0 END
\`\`\`

**3. Sign Ups** — サインアップ完了数

\`\`\`
CASE WHEN Event name = "sign_up" THEN Event count ELSE 0 END
\`\`\`

**4. Begin Checkouts** — 課金開始数

\`\`\`
CASE WHEN Event name = "begin_checkout" THEN Event count ELSE 0 END
\`\`\`

**5. CTR** — クリック率 (クリック ÷ インプレッション)

\`\`\`
LP CTA Clicks / NARY_MAX(Ad Impressions, 1)
\`\`\`

**6. CVR** — コンバージョン率 (サインアップ ÷ クリック)

\`\`\`
Sign Ups / NARY_MAX(LP CTA Clicks, 1)
\`\`\`

> ⚠️ \`CTR\` / \`CVR\` は **既に集計済みの計算フィールドを参照**するため、
> 数式内で \`SUM()\` を付けないこと (「集計の中に集計はできません」エラーになる)。
> \`NARY_MAX(x, 1)\` は分母が 0 のときに 1 を採用してゼロ除算を防ぐイディオム。

---

## STEP 2. グラフごとの設定一覧

各グラフを挿入したら、右側の **［設定］** タブで以下をセットします。
(「期間ディメンション」は GA4 接続時は自動で \`Date\` が入ります)

### グラフ① 日次トレンド (時系列グラフ)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 時系列グラフ (Time series) |
| ディメンション | \`Date\` |
| 指標 | \`Ad Impressions\` / \`LP CTA Clicks\` / \`Sign Ups\` |
| 並べ替え | \`Date\` 昇順 |
| 期間 | 過去28日間 など |

### グラフ② 広告媒体別パフォーマンス (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (棒グラフ付き / Table with bars) |
| ディメンション | \`Session source\` , \`Session medium\` |
| 指標 | \`Ad Impressions\` / \`LP CTA Clicks\` / \`CTR\` / \`Sign Ups\` / \`CVR\` |
| 並べ替え | \`Ad Impressions\` 降順 |
| フィルタ(任意) | 「\`Session medium\` を含める / 正規表現一致 \`^(cpc\\|ppc\\|paid_social\\|paidsearch\\|display\\|paid)$\`」 |

### グラフ③ キャンペーン別 (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (Table) |
| ディメンション | \`Session campaign\` |
| 指標 | \`Ad Impressions\` / \`LP CTA Clicks\` / \`Sign Ups\` / \`CVR\` |
| 並べ替え | \`Sign Ups\` 降順 |

### グラフ④ ファネル (スコアカード ×4)

スコアカードを4枚並べ、それぞれ指標を1つだけ設定 (ディメンションなし)。

| スコアカード | 指標 |
|---|---|
| A | \`Ad Impressions\` |
| B | \`LP CTA Clicks\` |
| C | \`Sign Ups\` |
| D | \`CVR\` |

### グラフ⑤ クリエイティブ比較 (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (Table) |
| ディメンション | \`Session manual ad content\` (= utm_content) |
| 指標 | \`LP CTA Clicks\` / \`CTR\` |
| 並べ替え | \`LP CTA Clicks\` 降順 |

### グラフ⑥ 媒体構成 (円グラフ・任意)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 円グラフ (Pie chart) |
| ディメンション | \`Session medium\` |
| 指標 | \`Sessions\` |

---

## STEP 3. レポート上部のコントロール

| コントロール | 設定 | 役割 |
|---|---|---|
| 期間設定 (Date range control) | 既定: 過去28日間 | 全グラフの対象期間を一括変更 |
| プルダウン (Drop-down list) | コントロール対象フィールド: \`Session source\` | 媒体での絞り込み |
| プルダウン (Drop-down list) | コントロール対象フィールド: \`Session campaign\` | キャンペーンでの絞り込み |

---

## STEP 4. 仕上げチェックリスト

- [ ] 計算フィールド6個がデータソースに保存されている
- [ ] グラフ①〜⑤が配置され、指標が正しく出ている
- [ ] CTR / CVR がパーセント表示になっている (0〜100%)
- [ ] 期間コントロールで数値が連動して変わる
- [ ] §5 で \`click_lp_cta\` / \`sign_up\` の計測を確認済み

---

## STEP 5. データ健全性チェック (GA4「探索」でイベント計測を確認)

Looker Studio に出てこない / 数が 0 のときは、まず GA4 側でイベントが
取れているかを切り分けます。

### 5-A. 探索 (Exploration) で件数を確認する

1. GA4 を開き、左メニューの **［探索］** をクリック。
2. **［空白］** (Blank) を選んで新規データ探索を作成。
3. 左「変数」パネルで期間を **過去7日間** などに設定。
4. **ディメンション** の \`+\` →「イベント名 (Event name)」を検索して **インポート**。
5. **指標** の \`+\` →「イベント数 (Event count)」と「総ユーザー数 (Total users)」を **インポート**。
6. 中央「設定」パネルで:
   - **行 (Rows)** に「イベント名」をドラッグ
   - **値 (Values)** に「イベント数」をドラッグ
7. 表に \`click_lp_cta\` と \`sign_up\` の行が現れ、件数が 1 以上なら **計測OK**。

> 絞り込みたい場合は「設定」パネルの **フィルタ** に
> 「\`イベント名\` ＝ 完全一致 \`click_lp_cta\`」(または \`sign_up\`) を追加します。
> パラメータ (\`event_label\` の "heroCta"/"google" 等) まで見たいときは、
> ディメンションに **「イベント名」+ カスタム** を追加するか、後述の DebugView を使います。

### 5-B. リアルタイム / DebugView で即時確認する (任意)

- **リアルタイム**: GA4 →［レポート］→［リアルタイム］。本番 LP を開いて CTA を
  クリックし、「イベント数（イベント名別）」カードに \`click_lp_cta\` が増えるか確認。
- **DebugView**: GA4 →［管理］→［DebugView］。ブラウザ拡張「Google Analytics
  Debugger」を ON にして本番サイトを操作すると、\`click_lp_cta\` / \`sign_up\` が
  パラメータ付きで秒単位に流れる。広告出稿前の動作確認に最適。

### 5-C. 計測されていない場合の確認ポイント

1. 本番 (\`${SITE_URL}\`) で発火しているか — \`docs\` のイベント一覧 (\`click_lp_cta\`
   は LP CTA、\`sign_up\` は新規サインアップ時のみ) と発火条件を再確認。
2. GTM コンテナが公開済みか / GA4 設定タグにイベントが転送されているか。
3. 計測直後は GA4 標準レポートに反映まで時間差がある (探索/リアルタイムは速い)。
4. キーイベント (コンバージョン) 化したい場合は GA4 →［管理］→［イベント］→
   対象イベントを「キーイベントとしてマークを付ける」。
`;

const outputs = [
  { label: "概念編", path: OUT_PATH, body: md },
  { label: "実装編", path: GUIDE_PATH, body: guide },
];

if (STDOUT_ONLY) {
  for (const o of outputs) {
    process.stdout.write(`\n===== ${o.label}: ${path.relative(process.cwd(), o.path)} =====\n`);
    process.stdout.write(o.body);
  }
  process.exit(0);
}

try {
  for (const o of outputs) {
    fs.mkdirSync(path.dirname(o.path), { recursive: true });
    fs.writeFileSync(o.path, o.body, "utf8");
    console.log(`[SUCCESS] ${o.label}を生成しました: ${path.relative(process.cwd(), o.path)}`);
  }
  console.log(`[INFO] GA4 測定ID=${MEASUREMENT_ID} / プロパティ=${PROPERTY_ID}`);
} catch (err) {
  console.error(`[ERROR] 手順書の書き出しに失敗しました: ${err.message}`);
  process.exit(1);
}
