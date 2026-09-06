#!/usr/bin/env node
/**
 * summarize_user_conversion.js
 *
 * GA4 Data API から前日の「ゲスト→無料会員」転換ファネル指標を取得し、
 * (1) Firestore `conversion_reports` に保存し、(2) テキスト要約＋QuickChart グラフを
 * Slack (または標準出力) に送る。Firestore 保存分は管理画面 /admin の
 * 「無料転換レポート」タブから閲覧できる。
 *
 * 取得指標: 検索利用 (generate_report) / 上限到達 (reach_limit) / 無料登録 (sign_up)、
 *           および CVR (検索利用→上限到達、上限到達→無料登録)。
 * 備考: reach_limit は guest/free 両方のプラン上限到達を含む（event_label でのプラン別
 *       内訳は GA4 側にカスタムディメンション未登録のため、summarize_ad_performance.js
 *       と同様に集計は eventName 単位に留める）。
 *
 * 認証: summarize_ad_performance.js と同じ方式（優先順位: GA4_ACCESS_TOKEN → gcloud）。
 *
 * 使い方:
 *   node scripts/summarize_user_conversion.js                 # 前日分を取得→Firestore保存→Slack送信
 *   node scripts/summarize_user_conversion.js --date 2026-05-23
 *   node scripts/summarize_user_conversion.js --dry-run       # 保存・送信せず要約を表示
 *   node scripts/summarize_user_conversion.js --no-save       # Firestore 保存だけスキップ
 *   node scripts/summarize_user_conversion.js --input fix.json # GA4 を叩かずフィクスチャで要約 (テスト用)
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

// ─── 日付ユーティリティ (JST) ───────────────────────────────────────────────
function jstDateString(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
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
  return { eventReport };
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

function pct(n, d) {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function ratio(n, d) {
  return d ? Number((n / d).toFixed(4)) : 0;
}

// ─── 指標算出 (純粋関数) ─────────────────────────────────────────────────────
/**
 * GA4 の eventReport から機械可読な指標オブジェクトを作る。
 * cvrLimitReached / cvrSignUp は 0〜1 の比率で保持する（UI 側で % 整形）。
 */
function computeMetrics({ eventReport }) {
  const events = parseEventCounts(eventReport);

  const searches = events["generate_report"] || 0;
  const limitReached = events["reach_limit"] || 0;
  const signups = events["sign_up"] || 0;

  return {
    searches,
    limitReached,
    signups,
    // 検索利用 → 上限到達
    cvrLimitReached: ratio(limitReached, searches),
    // 上限到達 → 無料登録
    cvrSignUp: ratio(signups, limitReached),
  };
}

// ─── テキスト要約 ────────────────────────────────────────────────────────────
function buildSummaryText(m, date) {
  const lines = [
    `🚪 ゲスト→無料転換 日次レポート (${date} JST)`,
    ``,
    `■ ファネル`,
    `  検索利用 (generate_report): ${m.searches}`,
    `  上限到達 (reach_limit): ${m.limitReached}`,
    `  無料登録 (sign_up): ${m.signups}`,
    ``,
    `■ 転換率`,
    `  検索利用 → 上限到達: ${pct(m.limitReached, m.searches)}`,
    `  上限到達 → 無料登録: ${pct(m.signups, m.limitReached)}`,
  ];
  return lines.join("\n");
}

/** 後方互換: 生レポートからテキスト要約を返す薄いラッパー */
function buildSummary(reports, date) {
  return buildSummaryText(computeMetrics(reports), date);
}

// ─── QuickChart グラフ URL ───────────────────────────────────────────────────
/**
 * 転換ファネル棒グラフを QuickChart (無料) の画像 URL として生成する。
 * 返り値は <img src> や Slack image block にそのまま使える GET URL。
 */
function buildChartUrl(m, date) {
  const chart = {
    type: "bar",
    data: {
      labels: ["検索利用", "上限到達", "無料登録"],
      datasets: [
        {
          label: `転換ファネル (${date})`,
          data: [m.searches, m.limitReached, m.signups],
          backgroundColor: ["#6366f1", "#f59e0b", "#10b981"],
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: `ゲスト→無料転換ファネル ${date}` } },
      scales: { y: { beginAtZero: true } },
    },
  };
  const c = encodeURIComponent(JSON.stringify(chart));
  return `https://quickchart.io/chart?w=600&h=300&bkg=white&c=${c}`;
}

// ─── Firestore 保存 (conversion_reports/{date}) ──────────────────────────────
async function saveConversionReport(date, summary, chartUrl, metrics) {
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
    await db.collection("conversion_reports").doc(date).set(
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
    console.log(`[SUCCESS] Firestore conversion_reports/${date} に保存しました (project=${projectId})`);
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
      ...(chartUrl ? [{ type: "image", image_url: chartUrl, alt_text: "guest to free conversion funnel" }] : []),
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

    // Firestore へ保存 (/admin の無料転換レポートタブが参照)。dry-run / --no-save 時はスキップ。
    if (DRY_RUN || NO_SAVE) {
      console.log(`[INFO] Firestore 保存はスキップ (${DRY_RUN ? "--dry-run" : "--no-save"})`);
    } else {
      await saveConversionReport(TARGET_DATE, summary, chartUrl, metrics);
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
module.exports = { buildSummary, buildSummaryText, computeMetrics, buildChartUrl, parseEventCounts };
if (require.main === module) main();
