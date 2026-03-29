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

# ============================================================
# PostHog Survey — 無料枠到達時 先行案内登録
# posthog_survey リソースはプロバイダー未実装のため
# terraform_data + local-exec (Python) で冪等に作成する
# ============================================================

resource "terraform_data" "survey_limit_reached" {
  # survey設定が変わった場合のみ再実行
  triggers_replace = sha256(jsonencode({
    name    = "無料枠到達時_先行案内登録"
    version = "1"
  }))

  provisioner "local-exec" {
    command = "python3 ${path.module}/scripts/create_survey.py"
    environment = {
      POSTHOG_API_KEY    = var.posthog_api_key
      POSTHOG_PROJECT_ID = var.posthog_project_id
      POSTHOG_HOST       = var.posthog_host
    }
  }
}

# ============================================================
# PostHog HogFunction — Survey回答をバックエンドへ Webhook 転送
# survey sent イベントを受信し、メールアドレスをFirestoreに保存
# ============================================================

# ============================================================
# PostHog HogFunction — Survey回答 Webhook
# posthog_hog_function リソースは inputs_json の読み返しにプロバイダーバグ(v1.0.x)があるため
# terraform_data + local-exec (Python) で冪等に作成する
# ============================================================

resource "terraform_data" "hog_function_survey_webhook" {
  triggers_replace = sha256(jsonencode({
    name           = "Survey Response → Waitlist Webhook"
    backend_url    = var.backend_api_url
    webhook_secret = var.posthog_webhook_secret
    version        = "1"
  }))

  provisioner "local-exec" {
    command = "python3 ${path.module}/scripts/create_hog_function.py"
    environment = {
      POSTHOG_API_KEY        = var.posthog_api_key
      POSTHOG_PROJECT_ID     = var.posthog_project_id
      POSTHOG_HOST           = var.posthog_host
      BACKEND_API_URL        = var.backend_api_url
      POSTHOG_WEBHOOK_SECRET = var.posthog_webhook_secret
    }
  }
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
