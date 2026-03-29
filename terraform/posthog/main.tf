# ============================================================
# PostHog 分析ダッシュボード — バイラル・集客メトリクス
# ============================================================

resource "posthog_dashboard" "viral_metrics" {
  project_id  = var.posthog_project_id
  name        = "バイラル・集客メトリクス"
  description = "SNSシェアボタンのクリック数・プラットフォーム別分析。share_button_clicked イベントを可視化。"
  pinned      = true
  tags        = ["share", "viral", "acquisition"]
}

# ── インサイト1: プラットフォーム別シェアボタンクリック数（折れ線グラフ） ──

resource "posthog_insight" "share_by_platform_trend" {
  project_id   = var.posthog_project_id
  name         = "プラットフォーム別シェアクリック数（推移）"
  description  = "X / LINE / URLコピー / ネイティブ別の share_button_clicked イベント数の日次推移"
  dashboard_ids = [posthog_dashboard.viral_metrics.id]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind = "TrendsQuery"
      series = [
        {
          kind  = "EventsNode"
          event = "share_button_clicked"
          name  = "シェアボタンクリック"
          math  = "total"
        }
      ]
      breakdownFilter = {
        breakdown      = "platform"
        breakdown_type = "event"
      }
      dateRange = {
        date_from = "-30d"
      }
      interval = "day"
    }
  })
}

# ── インサイト2: プラットフォーム別シェアクリック数（パイチャート） ──

resource "posthog_insight" "share_by_platform_pie" {
  project_id   = var.posthog_project_id
  name         = "プラットフォーム別シェアクリック数（構成比）"
  description  = "直近30日のシェアボタンクリック数をプラットフォーム別に集計"
  dashboard_ids = [posthog_dashboard.viral_metrics.id]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind = "TrendsQuery"
      series = [
        {
          kind  = "EventsNode"
          event = "share_button_clicked"
          name  = "シェアボタンクリック"
          math  = "total"
        }
      ]
      breakdownFilter = {
        breakdown      = "platform"
        breakdown_type = "event"
      }
      dateRange = {
        date_from = "-30d"
      }
      interval      = "month"
      trendsFilter  = { display = "ActionsPie" }
    }
  })
}

# ── インサイト3: 都道府県別シェア元エリアランキング ──

resource "posthog_insight" "share_by_prefecture" {
  project_id   = var.posthog_project_id
  name         = "都道府県別シェア数ランキング"
  description  = "どのエリアの診断結果が最もシェアされているか"
  dashboard_ids = [posthog_dashboard.viral_metrics.id]

  query_json = jsonencode({
    kind = "InsightVizNode"
    source = {
      kind = "TrendsQuery"
      series = [
        {
          kind  = "EventsNode"
          event = "share_button_clicked"
          name  = "シェアボタンクリック"
          math  = "total"
        }
      ]
      breakdownFilter = {
        breakdown      = "prefecture"
        breakdown_type = "event"
      }
      dateRange = {
        date_from = "-30d"
      }
      interval     = "month"
      trendsFilter = { display = "ActionsBarValue" }
    }
  })
}
