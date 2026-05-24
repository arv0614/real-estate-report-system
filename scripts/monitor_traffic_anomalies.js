#!/usr/bin/env node
/**
 * monitor_traffic_anomalies.js
 *
 * Cloud Run のリクエストログを解析し、同一 IP アドレスから短時間に異常なクリック
 * (リクエスト) が集中していないかを監視する。広告出稿時の Bot による不正クリック検知用。
 *
 * 判定: 直近 WINDOW 分のログを 1 分バケットに割り、ある IP の 1 分あたりリクエスト数が
 *       THRESHOLD 以上なら「異常」とみなして console.error を出す。
 *       異常が1件以上あれば終了コード 1 で終了する → GitHub Actions のジョブ失敗通知
 *       (リポジトリ宛メール) がそのままアラートになる。SLACK_WEBHOOK_URL があれば Slack 通知も送る。
 *
 * 使い方:
 *   node scripts/monitor_traffic_anomalies.js                      # gcloud から取得して解析
 *   node scripts/monitor_traffic_anomalies.js --window-minutes 30  # 直近30分
 *   node scripts/monitor_traffic_anomalies.js --threshold 10       # 1分10回以上を異常とする
 *   node scripts/monitor_traffic_anomalies.js --input logs.json    # gcloud を使わずファイルを解析 (テスト用)
 *   node scripts/monitor_traffic_anomalies.js --no-fail            # 異常検知でも終了コード0 (警告のみ)
 *   node scripts/monitor_traffic_anomalies.js --dry-run            # Slack 送信せず内容を表示
 *
 * 環境変数:
 *   GCP_PROJECT_ID                  — 必須 (gcloud 取得時)
 *   FRONTEND_CLOUD_RUN_SERVICE_NAME — 監視対象サービス名 (既定: realestate-frontend)
 *   SLACK_WEBHOOK_URL               — 任意。設定時は異常を Slack Incoming Webhook へ通知
 *   ANOMALY_THRESHOLD_PER_MIN       — 任意。閾値 (既定 10)。--threshold が優先
 *   ANOMALY_WINDOW_MINUTES          — 任意。監視窓 (既定 60)。--window-minutes が優先
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

// ─── 引数 ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const NO_FAIL = args.includes("--no-fail");
const INPUT_FILE = flagValue("--input", null);
const THRESHOLD = parseInt(
  flagValue("--threshold", process.env.ANOMALY_THRESHOLD_PER_MIN || "10"),
  10
);
const WINDOW_MINUTES = parseInt(
  flagValue("--window-minutes", process.env.ANOMALY_WINDOW_MINUTES || "60"),
  10
);
const SERVICE = process.env.FRONTEND_CLOUD_RUN_SERVICE_NAME || "realestate-frontend";
const PROJECT = process.env.GCP_PROJECT_ID;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// 静的アセットへのリクエストは「クリック」とみなさない (除外)
const STATIC_RE = /(\/_next\/|\/favicon|\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?|map|txt|xml)(?:\?|$))/i;

// ─── ログ取得 ───────────────────────────────────────────────────────────────
function fetchLogsFromGcloud() {
  if (!PROJECT) {
    console.error("[ERROR] GCP_PROJECT_ID が未設定です (gcloud からのログ取得に必須)");
    process.exit(1);
  }
  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const filter = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${SERVICE}"`,
    'httpRequest.requestMethod="GET"',
    `timestamp>="${sinceIso}"`,
  ].join(" AND ");

  console.log(`[INFO] gcloud logging read (service=${SERVICE}, since=${sinceIso})`);
  let raw;
  try {
    raw = execFileSync(
      "gcloud",
      [
        "logging", "read", filter,
        "--project", PROJECT,
        "--format", "json",
        "--limit", "10000",
        "--freshness", `${WINDOW_MINUTES}m`,
      ],
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
    );
  } catch (err) {
    console.error(`[ERROR] gcloud によるログ取得に失敗しました: ${err.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error(`[ERROR] gcloud 出力の JSON パースに失敗しました: ${err.message}`);
    process.exit(1);
  }
}

function loadLogs() {
  if (INPUT_FILE) {
    console.log(`[INFO] ファイルからログを読み込みます: ${INPUT_FILE}`);
    return JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  }
  return fetchLogsFromGcloud();
}

// ─── 解析 (純粋関数: テスト・--input 共用) ──────────────────────────────────
/**
 * @param {Array} entries Cloud Logging のログエントリ配列
 * @param {number} threshold 1分あたりの異常閾値
 * @returns {{anomalies: Array, totalRequests: number, distinctIps: number}}
 */
function detectAnomalies(entries, threshold) {
  // ip -> minuteBucket(epoch分) -> count
  const counts = new Map();
  let totalRequests = 0;

  for (const e of entries) {
    const hr = e.httpRequest || {};
    const ip = hr.remoteIp || hr.remote_ip;
    const url = hr.requestUrl || hr.request_url || "";
    const ts = e.timestamp || e.receiveTimestamp;
    if (!ip || !ts) continue;

    // パス抽出 (絶対URL/相対どちらでも)
    let path = url;
    try {
      path = new URL(url).pathname + (new URL(url).search || "");
    } catch (_) {
      /* 相対パスはそのまま */
    }
    if (STATIC_RE.test(path)) continue; // 静的アセットは除外

    const minute = Math.floor(new Date(ts).getTime() / 60_000);
    if (Number.isNaN(minute)) continue;

    totalRequests++;
    if (!counts.has(ip)) counts.set(ip, new Map());
    const buckets = counts.get(ip);
    buckets.set(minute, (buckets.get(minute) || 0) + 1);
  }

  const anomalies = [];
  for (const [ip, buckets] of counts) {
    let peak = 0;
    let peakMinute = null;
    let total = 0;
    for (const [minute, c] of buckets) {
      total += c;
      if (c > peak) {
        peak = c;
        peakMinute = minute;
      }
    }
    if (peak >= threshold) {
      anomalies.push({
        ip,
        peakPerMinute: peak,
        peakAt: peakMinute !== null ? new Date(peakMinute * 60_000).toISOString() : null,
        totalInWindow: total,
      });
    }
  }
  anomalies.sort((a, b) => b.peakPerMinute - a.peakPerMinute);
  return { anomalies, totalRequests, distinctIps: counts.size };
}

// ─── Slack 通知 ─────────────────────────────────────────────────────────────
async function notifySlack(anomalies) {
  if (!SLACK_WEBHOOK_URL) {
    console.log("[INFO] SLACK_WEBHOOK_URL 未設定のため Slack 通知はスキップします");
    return;
  }
  const lines = anomalies
    .map((a) => `• \`${a.ip}\` — ピーク *${a.peakPerMinute} req/分* (${a.peakAt}), 窓内合計 ${a.totalInWindow}`)
    .join("\n");
  const text =
    `:rotating_light: *不正クリックの疑い* (service: ${SERVICE})\n` +
    `直近 ${WINDOW_MINUTES} 分で 1分あたり ${THRESHOLD} 回以上のIPを検知:\n${lines}`;

  if (DRY_RUN) {
    console.log("[DRY] Slack 送信内容:\n" + text);
    return;
  }
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[ERROR] Slack 通知に失敗 (HTTP ${res.status})`);
    } else {
      console.log("[INFO] Slack 通知を送信しました");
    }
  } catch (err) {
    console.error(`[ERROR] Slack 通知中に例外: ${err.message}`);
  }
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  const entries = loadLogs();
  const { anomalies, totalRequests, distinctIps } = detectAnomalies(entries, THRESHOLD);

  console.log(
    `[INFO] 解析完了: 対象リクエスト ${totalRequests} 件 / ユニークIP ${distinctIps} / 閾値 ${THRESHOLD}回/分`
  );

  if (anomalies.length === 0) {
    console.log("[OK] 異常なアクセスは検知されませんでした");
    process.exit(0);
  }

  for (const a of anomalies) {
    console.error(
      `[ANOMALY] IP=${a.ip} peak=${a.peakPerMinute}/min at=${a.peakAt} totalInWindow=${a.totalInWindow}`
    );
  }
  await notifySlack(anomalies);

  console.error(`[ALERT] ${anomalies.length} 件の異常IPを検知しました`);
  process.exit(NO_FAIL ? 0 : 1);
}

// テスト用にエクスポート。直接実行時のみ main を走らせる (require では副作用なし)。
module.exports = { detectAnomalies };
if (require.main === module) main();
