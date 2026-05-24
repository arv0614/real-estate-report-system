# 広告運用モニターダッシュボード セットアップ手順 (Looker Studio + GA4)

> このファイルは `scripts/setup_marketing_dashboard.js` により自動生成されています。
> 直接編集せず、スクリプト側を更新して再生成してください。
> 生成日時: 2026-05-24T05:09:10.062Z

Web 広告の出稿効果を **無料** (Looker Studio + GA4 標準) で可視化するためのテンプレート構成です。
GA4 の測定ID `G-MF8SLJ81D2` / プロパティ `<GA4_PROPERTY_ID>` を前提とします。

---

## 0. 全体像

```
[広告 (Google/Meta/X)] --UTM付きURL--> [LP https://mekiki-research.com/lp]
        │ impression(到達)             │ click_lp_cta
        ▼                              ▼
  GA4 session_start / page_view    GA4 click_lp_cta イベント
        │                              │
        └──────────────┬───────────────┘
                       ▼
              [GA4 プロパティ <GA4_PROPERTY_ID>]
                       │ (標準データソースコネクタ)
                       ▼
              [Looker Studio レポート]  ← 本手順で構築
```

広告計測の3指標は次のファネルで定義します。

| 指標 | 定義 | 元になる GA4 イベント |
|---|---|---|
| **インプレッション (到達)** | 広告URLパラメータ付きで LP に着地したセッション数 | `session_start` (utm 付き) |
| **クリック (CTA)** | LP の「無料で試す」CTA クリック数 | `click_lp_cta` |
| **コンバージョン** | サインアップ / 課金開始 | `sign_up` / `begin_checkout` / `purchase` |
| **CTR** | クリック ÷ インプレッション | 計算フィールド |
| **CVR** | コンバージョン ÷ クリック | 計算フィールド |

> 注: GA4 は「広告表示回数 (ad impression)」そのものは計測しません。ここでの
> インプレッションは「広告経由で LP に到達したセッション = 着地インプレッション」を指します。
> 純粋な広告表示回数が必要な場合は Google Ads / Meta 広告マネージャ側のレポートを併用してください。

---

## 1. 広告URLの UTM 命名規則 (出稿側で必須)

すべての広告リンクは LP (`https://mekiki-research.com/lp`) に対して以下の UTM パラメータを付与してください。
これが無いと GA4 上で広告流入を分離できません。

| パラメータ | 用途 | 例 |
|---|---|---|
| `utm_source` | 媒体 | `google` / `meta` / `x` / `yahoo` |
| `utm_medium` | 種別 | `cpc` / `display` / `paid_social` |
| `utm_campaign` | キャンペーン名 | `2026q2_launch` |
| `utm_content` | クリエイティブ識別 | `banner_a` / `video_b` |
| `utm_term` | キーワード (検索広告) | `不動産_調査` |

**URL 例:**

```
https://mekiki-research.com/lp?utm_source=google&utm_medium=cpc&utm_campaign=2026q2_launch&utm_content=banner_a
```

---

## 2. GA4 データソースを Looker Studio に接続する手順

1. [Looker Studio](https://lookerstudio.google.com/) を開き **「空のレポートを作成」**。
2. データソース選択で **「Google アナリティクス」** コネクタを選ぶ。
3. アカウント → プロパティ `<GA4_PROPERTY_ID>` (測定ID `G-MF8SLJ81D2`) を選択して **「追加」**。
4. レポートに GA4 データソースが接続される。以降の表・グラフはこのデータソースを参照する。

> GA4 の標準コネクタは **SQL を書きません**。ディメンション / 指標 / 計算フィールドを
> GUI で組み合わせます (下記 §3, §4)。BigQuery Export を使う場合のみ §6 の SQL 相当クエリを参照。

---

## 3. 使用するディメンション・指標 (GA4 標準フィールド)

### ディメンション

| Looker Studio フィールド | GA4 API 名 | 用途 |
|---|---|---|
| セッションの参照元 | `sessionSource` | 媒体別の分解 (google/meta…) |
| セッションのメディア | `sessionMedium` | cpc/display… |
| セッションのキャンペーン | `sessionCampaign` | キャンペーン別 |
| イベント名 | `eventName` | click_lp_cta / sign_up 等の絞り込み |
| ランディングページ | `landingPagePlusQueryString` | /lp 着地の確認 |
| 日付 | `date` | 時系列 |

### 指標

| Looker Studio フィールド | GA4 API 名 | 用途 |
|---|---|---|
| セッション | `sessions` | インプレッション(到達)の母数 |
| イベント数 | `eventCount` | 任意イベントの発生数 |
| 主要イベント数(コンバージョン) | `keyEvents` | sign_up 等をキーイベント化した数 |
| アクティブユーザー | `activeUsers` | 補助指標 |

---

## 4. 計算フィールド (Calculated Fields) の定義案

Looker Studio の「フィールドを追加」で以下を作成します。
イベント別カウントは `CASE` でイベント名を判定して合算するのが GA4 コネクタでの定石です。

### 4-1. 広告インプレッション (到達セッション)

媒体が `cpc` / `paid_social` / `display` のセッション数。

```
Ad Impressions =
CASE
  WHEN REGEXP_MATCH(sessionMedium, '^(cpc|ppc|paid_social|display)$') THEN sessions
  ELSE 0
END
```

### 4-2. LP CTA クリック数

```
LP CTA Clicks =
CASE WHEN eventName = 'click_lp_cta' THEN eventCount ELSE 0 END
```

### 4-3. サインアップ数 (コンバージョン)

```
Sign Ups =
CASE WHEN eventName = 'sign_up' THEN eventCount ELSE 0 END
```

### 4-4. 課金開始数 (補助コンバージョン)

```
Begin Checkouts =
CASE WHEN eventName = 'begin_checkout' THEN eventCount ELSE 0 END
```

### 4-5. CTR (クリック率)

```
CTR = SUM(LP CTA Clicks) / NARY_MAX(SUM(Ad Impressions), 1)
```

※ `NARY_MAX(..., 1)` でゼロ除算を回避。表示形式は「パーセント」。

### 4-6. CVR (コンバージョン率)

```
CVR = SUM(Sign Ups) / NARY_MAX(SUM(LP CTA Clicks), 1)
```

---

## 5. 推奨レポート構成 (ページ・チャート)

| セクション | チャート種別 | ディメンション | 指標 |
|---|---|---|---|
| 日次トレンド | 時系列グラフ | `date` | Ad Impressions / LP CTA Clicks / Sign Ups |
| 媒体別パフォーマンス | 表 (棒グラフ付き) | `sessionSource` × `sessionMedium` | Ad Impressions, LP CTA Clicks, CTR, CVR |
| キャンペーン別 | 表 | `sessionCampaign` | Ad Impressions, Sign Ups, CVR |
| ファネル | スコアカード ×3 | — | Ad Impressions → LP CTA Clicks → Sign Ups |
| クリエイティブ比較 | 表 | `sessionContent` (utm_content) | LP CTA Clicks, CTR |

期間コントロール (Date range control) と媒体フィルタ (Drop-down: `sessionSource`) を
レポート上部に配置すると運用しやすい。

---

## 6. (任意) BigQuery Export を使う場合の SQL 相当クエリ

GA4 → BigQuery Export を有効化している場合、Looker Studio で「カスタムクエリ」として
以下を貼り付けると同じ指標を取得できます (テーブルは `analytics_<GA4_PROPERTY_ID>.events_*`)。

```sql
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
FROM `analytics_<GA4_PROPERTY_ID>.events_*`
WHERE _TABLE_SUFFIX BETWEEN
  FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY date, source, medium
ORDER BY date DESC;
```

---

## 7. 関連自動化

- 日次のテキスト要約は `scripts/summarize_ad_performance.js` が GA4 Data API から取得し
  Slack / メールに送信します (毎朝定時、Looker Studio を見に行かなくても届く)。
- 不正クリック監視は `scripts/monitor_traffic_anomalies.js` が Cloud Run ログを解析します。
