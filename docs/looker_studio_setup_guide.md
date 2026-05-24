# Looker Studio レポート構築 詳細設定指示書 (実装編)

> このファイルは `scripts/setup_marketing_dashboard.js` により自動生成されています。
> 直接編集せず、スクリプト側を更新して再生成してください。
> 生成日時: 2026-05-24T11:34:18.543Z

概念編 (`docs/marketing_dashboard.md`) を前提に、Looker Studio の管理画面で
**そのまま設定できる粒度** まで具体化したものです。GA4 プロパティ `<GA4_PROPERTY_ID>`
(測定ID `G-MF8SLJ81D2`) を接続済みのレポートを対象とします。

> **フィールド名について**: 数式・表中のフィールド名は GA4 コネクタの
> **Looker Studio 表示名** (例: `Event name`, `Event count`, `Sessions`,
> `Session source`, `Session medium`) を使用しています。概念編の GA4 API 名
> (`eventName` 等) とは表記が異なる点に注意してください。
> 文字列リテラルは Looker Studio 数式の仕様に従い **ダブルクォート** で囲みます。

---

## STEP 0. 作成順序 (推奨)

1. §1 で **計算フィールド** をデータソースに6個作成する (グラフより先に作る)。
2. §2〜§3 の表に従って各グラフを配置する。
3. §4 でレポート上部に **期間コントロール** と **媒体フィルタ** を置く。
4. §5 の手順で GA4「探索」を使い、`click_lp_cta` / `sign_up` が
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
| 1 | `Ad Impressions` | 数値 | 合計 | 数値 |
| 2 | `LP CTA Clicks` | 数値 | 合計 | 数値 |
| 3 | `Sign Ups` | 数値 | 合計 | 数値 |
| 4 | `Begin Checkouts` | 数値 | 合計 | 数値 |
| 5 | `CTR` | 数値 | 自動 | パーセント |
| 6 | `CVR` | 数値 | 自動 | パーセント |

### 数式 (コピペ用)

**1. Ad Impressions** — 広告 medium のセッション数 (= 着地インプレッション)

```
CASE
  WHEN REGEXP_MATCH(Session medium, "^(cpc|ppc|paid_social|paidsearch|display|paid)$") THEN Sessions
  ELSE 0
END
```

**2. LP CTA Clicks** — LP「無料で試す」CTA クリック数

```
CASE WHEN Event name = "click_lp_cta" THEN Event count ELSE 0 END
```

**3. Sign Ups** — サインアップ完了数

```
CASE WHEN Event name = "sign_up" THEN Event count ELSE 0 END
```

**4. Begin Checkouts** — 課金開始数

```
CASE WHEN Event name = "begin_checkout" THEN Event count ELSE 0 END
```

**5. CTR** — クリック率 (クリック ÷ インプレッション)

```
LP CTA Clicks / NARY_MAX(Ad Impressions, 1)
```

**6. CVR** — コンバージョン率 (サインアップ ÷ クリック)

```
Sign Ups / NARY_MAX(LP CTA Clicks, 1)
```

> ⚠️ `CTR` / `CVR` は **既に集計済みの計算フィールドを参照**するため、
> 数式内で `SUM()` を付けないこと (「集計の中に集計はできません」エラーになる)。
> `NARY_MAX(x, 1)` は分母が 0 のときに 1 を採用してゼロ除算を防ぐイディオム。

---

## STEP 2. グラフごとの設定一覧

各グラフを挿入したら、右側の **［設定］** タブで以下をセットします。
(「期間ディメンション」は GA4 接続時は自動で `Date` が入ります)

### グラフ① 日次トレンド (時系列グラフ)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 時系列グラフ (Time series) |
| ディメンション | `Date` |
| 指標 | `Ad Impressions` / `LP CTA Clicks` / `Sign Ups` |
| 並べ替え | `Date` 昇順 |
| 期間 | 過去28日間 など |

### グラフ② 広告媒体別パフォーマンス (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (棒グラフ付き / Table with bars) |
| ディメンション | `Session source` , `Session medium` |
| 指標 | `Ad Impressions` / `LP CTA Clicks` / `CTR` / `Sign Ups` / `CVR` |
| 並べ替え | `Ad Impressions` 降順 |
| フィルタ(任意) | 「`Session medium` を含める / 正規表現一致 `^(cpc\|ppc\|paid_social\|paidsearch\|display\|paid)$`」 |

### グラフ③ キャンペーン別 (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (Table) |
| ディメンション | `Session campaign` |
| 指標 | `Ad Impressions` / `LP CTA Clicks` / `Sign Ups` / `CVR` |
| 並べ替え | `Sign Ups` 降順 |

### グラフ④ ファネル (スコアカード ×4)

スコアカードを4枚並べ、それぞれ指標を1つだけ設定 (ディメンションなし)。

| スコアカード | 指標 |
|---|---|
| A | `Ad Impressions` |
| B | `LP CTA Clicks` |
| C | `Sign Ups` |
| D | `CVR` |

### グラフ⑤ クリエイティブ比較 (表)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 表 (Table) |
| ディメンション | `Session manual ad content` (= utm_content) |
| 指標 | `LP CTA Clicks` / `CTR` |
| 並べ替え | `LP CTA Clicks` 降順 |

### グラフ⑥ 媒体構成 (円グラフ・任意)

| 設定項目 | 値 |
|---|---|
| グラフ種別 | 円グラフ (Pie chart) |
| ディメンション | `Session medium` |
| 指標 | `Sessions` |

---

## STEP 3. レポート上部のコントロール

| コントロール | 設定 | 役割 |
|---|---|---|
| 期間設定 (Date range control) | 既定: 過去28日間 | 全グラフの対象期間を一括変更 |
| プルダウン (Drop-down list) | コントロール対象フィールド: `Session source` | 媒体での絞り込み |
| プルダウン (Drop-down list) | コントロール対象フィールド: `Session campaign` | キャンペーンでの絞り込み |

---

## STEP 4. 仕上げチェックリスト

- [ ] 計算フィールド6個がデータソースに保存されている
- [ ] グラフ①〜⑤が配置され、指標が正しく出ている
- [ ] CTR / CVR がパーセント表示になっている (0〜100%)
- [ ] 期間コントロールで数値が連動して変わる
- [ ] §5 で `click_lp_cta` / `sign_up` の計測を確認済み

---

## STEP 5. データ健全性チェック (GA4「探索」でイベント計測を確認)

Looker Studio に出てこない / 数が 0 のときは、まず GA4 側でイベントが
取れているかを切り分けます。

### 5-A. 探索 (Exploration) で件数を確認する

1. GA4 を開き、左メニューの **［探索］** をクリック。
2. **［空白］** (Blank) を選んで新規データ探索を作成。
3. 左「変数」パネルで期間を **過去7日間** などに設定。
4. **ディメンション** の `+` →「イベント名 (Event name)」を検索して **インポート**。
5. **指標** の `+` →「イベント数 (Event count)」と「総ユーザー数 (Total users)」を **インポート**。
6. 中央「設定」パネルで:
   - **行 (Rows)** に「イベント名」をドラッグ
   - **値 (Values)** に「イベント数」をドラッグ
7. 表に `click_lp_cta` と `sign_up` の行が現れ、件数が 1 以上なら **計測OK**。

> 絞り込みたい場合は「設定」パネルの **フィルタ** に
> 「`イベント名` ＝ 完全一致 `click_lp_cta`」(または `sign_up`) を追加します。
> パラメータ (`event_label` の "heroCta"/"google" 等) まで見たいときは、
> ディメンションに **「イベント名」+ カスタム** を追加するか、後述の DebugView を使います。

### 5-B. リアルタイム / DebugView で即時確認する (任意)

- **リアルタイム**: GA4 →［レポート］→［リアルタイム］。本番 LP を開いて CTA を
  クリックし、「イベント数（イベント名別）」カードに `click_lp_cta` が増えるか確認。
- **DebugView**: GA4 →［管理］→［DebugView］。ブラウザ拡張「Google Analytics
  Debugger」を ON にして本番サイトを操作すると、`click_lp_cta` / `sign_up` が
  パラメータ付きで秒単位に流れる。広告出稿前の動作確認に最適。

### 5-C. 計測されていない場合の確認ポイント

1. 本番 (`https://mekiki-research.com`) で発火しているか — `docs` のイベント一覧 (`click_lp_cta`
   は LP CTA、`sign_up` は新規サインアップ時のみ) と発火条件を再確認。
2. GTM コンテナが公開済みか / GA4 設定タグにイベントが転送されているか。
3. 計測直後は GA4 標準レポートに反映まで時間差がある (探索/リアルタイムは速い)。
4. キーイベント (コンバージョン) 化したい場合は GA4 →［管理］→［イベント］→
   対象イベントを「キーイベントとしてマークを付ける」。
