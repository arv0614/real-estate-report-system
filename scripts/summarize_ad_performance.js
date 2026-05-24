#!/usr/bin/env node
/**
 * summarize_ad_performance.js
 *
 * GA4 Data API から前日の広告運用指標を取得し、(1) Firestore `ad_reports` に保存し、
 * (2) テキスト要約＋QuickChart グラフを Slack (または標準出力) に送る。
 * Firestore 保存分は管理画面 /admin の「広告レポート」タブから閲覧できる。
 *
 * 取得指標: インプレッション(広告経由の到達セッション) / LP CTA クリック / サインアップ /
 *           課金開始 / 購入、および CTR・CVR。媒体別の内訳も付与する。
 *
 * 認証: GA4 Data API はアクセストークンが必要。優先順位は
 *   1) 環境変数 GA4_ACCESS_TOKEN
 *   2) `gcloud auth print-access-token` (CI では google-github-actions/auth 後に利用可)
 *   サービスアカウントには対象 GA4 プロパティの「閲覧者」権限と Analytics Data API の有効化が必要。
 *   Firestore 保存には firebase-admin と FIREBASE_PROJECT_ID (なければ GCP_PROJECT_ID) を使う。
 *
 * 使い方:
 *   node scripts/summarize_ad_performance.js                 # 前日分を取得→Firestore保存→Slack送信
 *   node scripts/summarize_ad_performance.js --date 2026-05-23
 *   node scripts/summarize_ad_performance.js --dry-run       # 保存・送信せず要約を表示
 *   node scripts/summarize_ad_performance.js --no-save       # Firestore 保存だけスキップ
 *   node scripts/summarize_ad_performance.js --input fix.json # GA4 を叩かずフィクスチャで要約 (テスト用)
 *
 * 環境変数:
 *   GA4_PROPERTY_ID     — 必須 (gcloud 取得時)。GA4 プロパティ番号
 *   GA4_ACCESS_TOKEN    — 任意。OAuth アクセストークン (未設定時 gcloud から取得)
 *   SLACK_WEBHOOK_URL   — 任意。設定時は要約を Slack Incoming Webhook に送信
 *   FIREBASE_PROJECT_ID — 任意。Firestore 保存先プロジェクト (なければ GCP_PROJECT_ID)
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

const args = process.argv.slice(2);
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const NO_SAVE = args.includes("--no-save");
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

function ratio(n, d) {
  return d ? Number((n / d).toFixed(4)) : 0;
}

// ─── 指標算出 (純粋関数) ─────────────────────────────────────────────────────
/**
 * GA4 の2レポートから機械可読な指標オブジェクトを作る。
 * ctr / cvr / purchaseRate は 0〜1 の比率で保持する（UI 側で % 整形）。
 */
function computeMetrics({ eventReport, sourceReport }) {
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
  // インプレッション(到達): 広告 medium のセッション。広告流入が無ければ全セッションで代替。
  const impressions = adSessions || totalSessions;

  const adSources = sources
    .filter((s) => AD_MEDIUMS.has(s.medium.toLowerCase()))
    .slice(0, 5)
    .map((s) => ({ source: s.source, medium: s.medium, sessions: s.sessions }));

  return {
    impressions,
    impressionsBasis: adSessions ? "ad" : "all", // 広告流入の有無
    clicks,
    signups,
    beginCheckout,
    purchases,
    totalSessions,
    ctr: ratio(clicks, impressions),
    cvr: ratio(signups, clicks),
    purchaseRate: ratio(purchases, clicks),
    adSources,
  };
}

// ─── テキスト要約 ────────────────────────────────────────────────────────────
function buildSummaryText(m, date) {
  const impressionLabel = m.impressionsBasis === "ad" ? "広告到達(セッション)" : "全到達(セッション/広告流入なし)";
  const lines = [
    `📊 広告運用 日次レポート (${date} JST)`,
    ``,
    `■ ファネル`,
    `  ${impressionLabel}: ${m.impressions}`,
    `  LP CTA クリック (click_lp_cta): ${m.clicks}`,
    `  サインアップ (sign_up): ${m.signups}`,
    `  課金開始 (begin_checkout): ${m.beginCheckout}`,
    `  購入 (purchase): ${m.purchases}`,
    ``,
    `■ 効率`,
    `  CTR (クリック / 到達): ${pct(m.clicks, m.impressions)}`,
    `  CVR (サインアップ / クリック): ${pct(m.signups, m.clicks)}`,
    `  購入転換 (購入 / クリック): ${pct(m.purchases, m.clicks)}`,
  ];
  if (m.adSources.length > 0) {
    lines.push(``, `■ 広告媒体別 到達 (上位)`);
    for (const s of m.adSources) lines.push(`   - ${s.source} / ${s.medium}: ${s.sessions}`);
  }
  return lines.join("\n");
}

/** 後方互換: 生レポートからテキスト要約を返す薄いラッパー */
function buildSummary(reports, date) {
  return buildSummaryText(computeMetrics(reports), date);
}

// ─── QuickChart グラフ URL ───────────────────────────────────────────────────
/**
 * ファネル棒グラフを QuickChart (無料) の画像 URL として生成する。
 * 返り値は <img src> や Slack image block にそのまま使える GET URL。
 */
function buildChartUrl(m, date) {
  const chart = {
    type: "bar",
    data: {
      labels: ["到達", "クリック", "サインアップ", "課金開始", "購入"],
      datasets: [
        {
          label: `広告ファネル (${date})`,
          data: [m.impressions, m.clicks, m.signups, m.beginCheckout, m.purchases],
          backgroundColor: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: `広告ファネル ${date}` } },
      scales: { y: { beginAtZero: true } },
    },
  };
  const c = encodeURIComponent(JSON.stringify(chart));
  return `https://quickchart.io/chart?w=600&h=300&bkg=white&c=${c}`;
}

// ─── Firestore 保存 (ad_reports/{date}) ──────────────────────────────────────
async function saveAdReport(date, summary, chartUrl, metrics) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.warn("[WARN] FIREBASE_PROJECT_ID / GCP_PROJECT_ID 未設定のため Firestore 保存をスキップ");
    return;
  }
  let admin;
  try {
    admin = require("firebase-admin");
  } catch (err) {
    console.warn(`[WARN] firebase-admin ロード失敗のため Firestore 保存をスキップ: ${err.message}`);
    return;
  }
  try {
    if (!admin.apps.length) admin.initializeApp({ projectId });
    const db = admin.firestore();
    // doc id = 日付。再実行時は同日を上書き (merge) して冪等にする。
    await db.collection("ad_reports").doc(date).set(
      {
        date,
        summary,
        chartUrl,
        metrics,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`[SUCCESS] Firestore ad_reports/${date} に保存しました (project=${projectId})`);
  } catch (err) {
    console.error(`[ERROR] Firestore 保存に失敗: ${err.message}`);
    // 保存失敗は致命的ではない（Slack 通知は別途行う）ので throw しない
  }
}

// ─── Slack 送信 ─────────────────────────────────────────────────────────────
async function sendSlack(text, chartUrl) {
  if (!SLACK_WEBHOOK_URL) {
    console.log("[INFO] SLACK_WEBHOOK_URL 未設定のため標準出力にのみ表示します");
    console.log("\n" + text + (chartUrl ? `\n📈 ${chartUrl}` : "") + "\n");
    return;
  }
  if (DRY_RUN) {
    console.log("[DRY] Slack 送信内容:\n" + text + (chartUrl ? `\n📈 ${chartUrl}` : ""));
    return;
  }
  const payload = {
    text: text + (chartUrl ? `\n📈 ${chartUrl}` : ""), // 通知/フォールバック用
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      ...(chartUrl ? [{ type: "image", image_url: chartUrl, alt_text: "ad performance funnel" }] : []),
    ],
  };
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
    const metrics = computeMetrics(reports);
    const summary = buildSummaryText(metrics, TARGET_DATE);
    const chartUrl = buildChartUrl(metrics, TARGET_DATE);

    // Firestore へ保存 (/admin の広告レポートタブが参照)。dry-run / --no-save 時はスキップ。
    if (DRY_RUN || NO_SAVE) {
      console.log(`[INFO] Firestore 保存はスキップ (${DRY_RUN ? "--dry-run" : "--no-save"})`);
    } else {
      await saveAdReport(TARGET_DATE, summary, chartUrl, metrics);
    }

    if (DRY_RUN && !SLACK_WEBHOOK_URL) {
      console.log("\n" + summary + `\n📈 ${chartUrl}\n`);
      return;
    }
    await sendSlack(summary, chartUrl);
  } catch (err) {
    console.error(`[ERROR] 日次レポート生成に失敗しました: ${err.message}`);
    process.exit(1);
  }
}

// テスト用にエクスポート。直接実行時のみ main を走らせる (require では副作用なし)。
module.exports = { buildSummary, buildSummaryText, computeMetrics, buildChartUrl, parseEventCounts, parseSourceSessions };
if (require.main === module) main();
