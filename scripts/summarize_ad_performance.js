#!/usr/bin/env node
/**
 * summarize_ad_performance.js
 *
 * GA4 Data API から前日の広告運用指標を取得し、テキスト要約を Slack (または標準出力) に送る。
 * Looker Studio を毎日見に行かなくても、日次サマリーが届くようにするための自動化。
 *
 * 取得指標: インプレッション(広告経由の到達セッション) / LP CTA クリック / サインアップ /
 *           課金開始 / 購入、および CTR・CVR。媒体別の内訳も付与する。
 *
 * 認証: GA4 Data API はアクセストークンが必要。優先順位は
 *   1) 環境変数 GA4_ACCESS_TOKEN
 *   2) `gcloud auth print-access-token` (CI では google-github-actions/auth 後に利用可)
 *   サービスアカウントには対象 GA4 プロパティの「閲覧者」権限と Analytics Data API の有効化が必要。
 *
 * 使い方:
 *   node scripts/summarize_ad_performance.js                 # 前日分を取得して Slack 送信
 *   node scripts/summarize_ad_performance.js --date 2026-05-23
 *   node scripts/summarize_ad_performance.js --dry-run       # 送信せず要約を表示
 *   node scripts/summarize_ad_performance.js --input fix.json # GA4 を叩かずフィクスチャで要約 (テスト用)
 *
 * 環境変数:
 *   GA4_PROPERTY_ID   — 必須 (gcloud 取得時)。GA4 プロパティ番号
 *   GA4_ACCESS_TOKEN  — 任意。OAuth アクセストークン (未設定時 gcloud から取得)
 *   SLACK_WEBHOOK_URL — 任意。設定時は要約を Slack Incoming Webhook に送信
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

const args = process.argv.slice(2);
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const INPUT_FILE = flagValue("--input", null);
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// 広告流入とみなす medium
const AD_MEDIUMS = new Set(["cpc", "ppc", "paid_social", "display", "paidsearch", "paid"]);

// ─── 日付ユーティリティ (JST) ───────────────────────────────────────────────
function jstDateString(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA ロケールは YYYY-MM-DD 形式
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
const TARGET_DATE = flagValue("--date", jstDateString(-1)); // 既定: 前日(JST)

// ─── アクセストークン ───────────────────────────────────────────────────────
function getAccessToken() {
  if (process.env.GA4_ACCESS_TOKEN) return process.env.GA4_ACCESS_TOKEN;
  // GA4 Data API は analytics.readonly スコープが必要。SA 認証では --scopes でスコープ付き
  // トークンを発行できる。ユーザー認証等で --scopes が拒否される場合は素のトークンに退避する。
  const scope = "https://www.googleapis.com/auth/analytics.readonly";
  try {
    return execFileSync("gcloud", ["auth", "print-access-token", `--scopes=${scope}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (_) {
    try {
      return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
    } catch (err) {
      console.error(`[ERROR] アクセストークン取得に失敗しました (gcloud auth print-access-token): ${err.message}`);
      process.exit(1);
    }
  }
}

// ─── GA4 Data API ───────────────────────────────────────────────────────────
async function runReport(token, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GA4 runReport HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
  return res.json();
}

async function fetchReports() {
  if (!PROPERTY_ID) {
    console.error("[ERROR] GA4_PROPERTY_ID が未設定です");
    process.exit(1);
  }
  const token = getAccessToken();
  const dateRanges = [{ startDate: TARGET_DATE, endDate: TARGET_DATE }];

  const eventReport = await runReport(token, {
    dateRanges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
  });
  const sourceReport = await runReport(token, {
    dateRanges,
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 50,
  });
  return { eventReport, sourceReport };
}

// ─── パース (純粋関数) ──────────────────────────────────────────────────────
function parseEventCounts(report) {
  const out = {};
  for (const row of report.rows || []) {
    const name = row.dimensionValues?.[0]?.value;
    const count = Number(row.metricValues?.[0]?.value || 0);
    if (name) out[name] = count;
  }
  return out;
}

function parseSourceSessions(report) {
  return (report.rows || []).map((row) => ({
    source: row.dimensionValues?.[0]?.value || "(not set)",
    medium: row.dimensionValues?.[1]?.value || "(not set)",
    sessions: Number(row.metricValues?.[0]?.value || 0),
  }));
}

function pct(n, d) {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

// ─── 要約生成 ───────────────────────────────────────────────────────────────
function buildSummary({ eventReport, sourceReport }, date) {
  const events = parseEventCounts(eventReport);
  const sources = parseSourceSessions(sourceReport);

  const clicks = events["click_lp_cta"] || 0;
  const signups = events["sign_up"] || 0;
  const beginCheckout = events["begin_checkout"] || 0;
  const purchases = events["purchase"] || 0;

  const adSessions = sources
    .filter((s) => AD_MEDIUMS.has(s.medium.toLowerCase()))
    .reduce((sum, s) => sum + s.sessions, 0);
  const totalSessions = sources.reduce((sum, s) => sum + s.sessions, 0);
  // インプレッション(到達): 広告 medium のセッション。広告流入が無ければ全セッションで代替表示。
  const impressions = adSessions || totalSessions;
  const impressionLabel = adSessions ? "広告到達(セッション)" : "全到達(セッション/広告流入なし)";

  const topAd = sources
    .filter((s) => AD_MEDIUMS.has(s.medium.toLowerCase()))
    .slice(0, 5)
    .map((s) => `   - ${s.source} / ${s.medium}: ${s.sessions}`)
    .join("\n");

  const lines = [
    `📊 広告運用 日次レポート (${date} JST)`,
    ``,
    `■ ファネル`,
    `  ${impressionLabel}: ${impressions}`,
    `  LP CTA クリック (click_lp_cta): ${clicks}`,
    `  サインアップ (sign_up): ${signups}`,
    `  課金開始 (begin_checkout): ${beginCheckout}`,
    `  購入 (purchase): ${purchases}`,
    ``,
    `■ 効率`,
    `  CTR (クリック / 到達): ${pct(clicks, impressions)}`,
    `  CVR (サインアップ / クリック): ${pct(signups, clicks)}`,
    `  購入転換 (購入 / クリック): ${pct(purchases, clicks)}`,
  ];
  if (topAd) {
    lines.push(``, `■ 広告媒体別 到達 (上位)`, topAd);
  }
  return lines.join("\n");
}

// ─── Slack 送信 ─────────────────────────────────────────────────────────────
async function sendSlack(text) {
  if (!SLACK_WEBHOOK_URL) {
    console.log("[INFO] SLACK_WEBHOOK_URL 未設定のため標準出力にのみ表示します");
    console.log("\n" + text + "\n");
    return;
  }
  if (DRY_RUN) {
    console.log("[DRY] Slack 送信内容:\n" + text);
    return;
  }
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`[ERROR] Slack 送信に失敗 (HTTP ${res.status})`);
    process.exit(1);
  }
  console.log("[SUCCESS] Slack に日次レポートを送信しました");
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  try {
    let reports;
    if (INPUT_FILE) {
      console.log(`[INFO] フィクスチャから読み込みます: ${INPUT_FILE}`);
      reports = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    } else {
      console.log(`[INFO] GA4 プロパティ ${PROPERTY_ID} から ${TARGET_DATE} の指標を取得します`);
      reports = await fetchReports();
    }
    const summary = buildSummary(reports, TARGET_DATE);
    if (DRY_RUN && !SLACK_WEBHOOK_URL) {
      console.log("\n" + summary + "\n");
      return;
    }
    await sendSlack(summary);
  } catch (err) {
    console.error(`[ERROR] 日次レポート生成に失敗しました: ${err.message}`);
    process.exit(1);
  }
}

// テスト用にエクスポート。直接実行時のみ main を走らせる (require では副作用なし)。
module.exports = { buildSummary, parseEventCounts, parseSourceSessions };
if (require.main === module) main();
