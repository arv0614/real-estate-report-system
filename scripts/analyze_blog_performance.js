#!/usr/bin/env node
/**
 * analyze_blog_performance.js
 *
 * GA4 Data API から過去N日間のブログ記事（pagePath に /blog/ を含むページ）の
 * PV・エンゲージメント率・CTA クリック(click_lp_cta)・サインアップ(sign_up) を取得し、
 * frontend/content/blog/ の frontmatter（テーマ・タグ・対象エリア）と突き合わせたうえで
 * Gemini API に渡し、「成績の良い/悪い記事の傾向」と『SEO・CVR改善ガイドライン』を
 * JSON で生成する。結果は data/blog_seo_guidelines.json に保存し、
 * scripts/generate_daily_blog.js が次回実行時に読み込んで企画会議・本文執筆の
 * プロンプトに反映する（自己進化ループ）。
 *
 * 認証: GA4 Data API はアクセストークンが必要。優先順位は
 *   1) 環境変数 GA4_ACCESS_TOKEN
 *   2) `gcloud auth print-access-token` (CI では google-github-actions/auth 後に利用可)
 *
 * 使い方:
 *   node scripts/analyze_blog_performance.js                  # 過去28日分を分析→保存
 *   node scripts/analyze_blog_performance.js --days 14
 *   node scripts/analyze_blog_performance.js --dry-run         # 保存せず結果を表示
 *   node scripts/analyze_blog_performance.js --input fix.json  # GA4 を叩かずフィクスチャで分析 (テスト用)
 *
 * 環境変数:
 *   GA4_PROPERTY_ID        — 必須 (gcloud 取得時)。GA4 プロパティ番号
 *   GA4_ACCESS_TOKEN       — 任意。OAuth アクセストークン (未設定時 gcloud から取得)
 *   GEMINI_API_KEY         — 必須（--input フィクスチャ利用時を除く）
 *   GEMINI_ANALYSIS_MODEL  — 任意。既定: gemini-3.1-pro-preview
 *   BLOG_ANALYSIS_DAYS     — 任意。既定: 28（--days で上書き可）
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const INPUT_FILE = flagValue("--input", null);
const DAYS = Number(flagValue("--days", process.env.BLOG_ANALYSIS_DAYS || 28));
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const MODEL = process.env.GEMINI_ANALYSIS_MODEL || "gemini-3.1-pro-preview";

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const OUTPUT_PATH = path.resolve(__dirname, "../data/blog_seo_guidelines.json");
const MIN_SAMPLE_ARTICLES = 3; // これ未満の実績記事数では Gemini に統計分析させず既定ガイドラインを返す

const AD_EVENT_NAMES = ["click_lp_cta", "sign_up"];

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
const END_DATE = jstDateString(-1); // 前日(JST)まで
const START_DATE = jstDateString(-DAYS);

// ─── アクセストークン ───────────────────────────────────────────────────────
function getAccessToken() {
  if (process.env.GA4_ACCESS_TOKEN) return process.env.GA4_ACCESS_TOKEN;
  const { execFileSync } = require("child_process");
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  const dateRanges = [{ startDate: START_DATE, endDate: END_DATE }];

  const pageReport = await runReport(token, {
    dateRanges,
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "engagementRate" },
      { name: "userEngagementDuration" },
      { name: "sessions" },
    ],
    dimensionFilter: {
      filter: { fieldName: "pagePath", stringFilter: { matchType: "CONTAINS", value: "/blog/" } },
    },
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 500,
  });

  const eventReport = await runReport(token, {
    dateRanges,
    dimensions: [{ name: "pagePath" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: "pagePath", stringFilter: { matchType: "CONTAINS", value: "/blog/" } } },
          { filter: { fieldName: "eventName", inListFilter: { values: AD_EVENT_NAMES } } },
        ],
      },
    },
    limit: 1000,
  });

  return { pageReport, eventReport };
}

// ─── pagePath パース (純粋関数) ────────────────────────────────────────────
// URL 形式: /blog/<slug> (ja) / /en/blog/<slug> / /zh-TW/blog/<slug> / /zh-CN/blog/<slug>
// (frontend/i18n/routing.ts の localePrefix: "as-needed" によりデフォルトロケール(ja)はプレフィックス無し)
function parsePagePath(pagePath) {
  const m = String(pagePath || "").match(/^\/(?:(en|zh-TW|zh-CN)\/)?blog\/([^/?#]+)\/?$/);
  if (!m) return null;
  return { locale: m[1] || "ja", slug: m[2] };
}

// ─── frontmatter 読み込み (テーマ・エリア・タグの突き合わせ用) ─────────────
// generate_daily_blog.js の buildFrontmatter() が出力する固定フォーマットを前提にした
// 軽量パーサ (YAML ライブラリ非依存)。
function isJaBlogFile(filename) {
  return filename.endsWith(".md") && !/\.(en|zh-TW|zh-CN)\.md$/.test(filename);
}

function parseFrontmatter(raw) {
  const m = String(raw || "").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const block = m[1];
  const strField = (name) => {
    const fm = block.match(new RegExp(`^${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"));
    return fm ? fm[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : null;
  };
  const tagsField = () => {
    const fm = block.match(/^tags:\s*\[(.*)]/m);
    if (!fm) return [];
    return fm[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  };
  const locationName = () => {
    const fm = block.match(/primaryLocation:\s*\n(?:.*\n)*?\s*name:\s*"((?:[^"\\]|\\.)*)"/);
    return fm ? fm[1].replace(/\\"/g, '"') : null;
  };
  return {
    title: strField("title"),
    description: strField("description"),
    tags: tagsField(),
    targetArea: locationName(),
  };
}

function loadArticleMeta() {
  const meta = {};
  if (!fs.existsSync(BLOG_DIR)) return meta;
  for (const f of fs.readdirSync(BLOG_DIR)) {
    if (!isJaBlogFile(f)) continue;
    const slug = f.replace(/\.md$/, "");
    try {
      const raw = fs.readFileSync(path.join(BLOG_DIR, f), "utf8");
      meta[slug] = parseFrontmatter(raw);
    } catch (err) {
      console.warn(`[WARN] frontmatter 読み込み失敗 (${f}): ${err.message}`);
    }
  }
  return meta;
}

// ─── 指標集計 (純粋関数) ─────────────────────────────────────────────────────
// 4言語のページ (ja/en/zh-TW/zh-CN) を記事 (slug) 単位で合算する。
function aggregateArticles({ pageReport, eventReport }, articleMeta) {
  const bySlug = {};

  for (const row of pageReport.rows || []) {
    const parsed = parsePagePath(row.dimensionValues?.[0]?.value);
    if (!parsed) continue;
    const pv = Number(row.metricValues?.[0]?.value || 0);
    const engagementRate = Number(row.metricValues?.[1]?.value || 0);
    const engagementDuration = Number(row.metricValues?.[2]?.value || 0);
    const sessions = Number(row.metricValues?.[3]?.value || 0);

    const a = (bySlug[parsed.slug] ||= {
      slug: parsed.slug,
      pageViews: 0,
      sessions: 0,
      engagementDurationTotal: 0,
      engagementRateWeightedSum: 0,
      clickCtaCount: 0,
      signUpCount: 0,
    });
    a.pageViews += pv;
    a.sessions += sessions;
    a.engagementDurationTotal += engagementDuration;
    a.engagementRateWeightedSum += engagementRate * sessions;
  }

  for (const row of eventReport.rows || []) {
    const parsed = parsePagePath(row.dimensionValues?.[0]?.value);
    if (!parsed) continue;
    const eventName = row.dimensionValues?.[1]?.value;
    const count = Number(row.metricValues?.[0]?.value || 0);
    const a = bySlug[parsed.slug];
    if (!a) continue; // イベントはあるが PV 行が無い(稀) → 集計対象外
    if (eventName === "click_lp_cta") a.clickCtaCount += count;
    if (eventName === "sign_up") a.signUpCount += count;
  }

  const ratio = (n, d) => (d ? Number((n / d).toFixed(4)) : 0);

  return Object.values(bySlug)
    .map((a) => {
      const meta = articleMeta[a.slug] || {};
      return {
        slug: a.slug,
        title: meta.title || null,
        targetArea: meta.targetArea || null,
        tags: meta.tags || [],
        pageViews: a.pageViews,
        engagementRate: a.sessions ? Number((a.engagementRateWeightedSum / a.sessions).toFixed(4)) : 0,
        avgEngagementTimeSec: a.pageViews ? Number((a.engagementDurationTotal / a.pageViews).toFixed(1)) : 0,
        clickCtaCount: a.clickCtaCount,
        signUpCount: a.signUpCount,
        ctr: ratio(a.clickCtaCount, a.pageViews),
        cvr: ratio(a.signUpCount, a.clickCtaCount),
      };
    })
    .sort((x, y) => y.pageViews - x.pageViews);
}

// ─── Gemini 呼び出し ────────────────────────────────────────────────────────
function parseJson(text) {
  let cleaned = String(text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const JSON_CALL_MAX_ATTEMPTS = 3;
async function callJson(ai, prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= JSON_CALL_MAX_ATTEMPTS; attempt++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseModalities: ["TEXT"], responseMimeType: "application/json", temperature: 0.4 },
    });
    const text = response?.text;
    if (!text) {
      lastErr = new Error("Gemini からの応答が空でした");
      console.warn(`[WARN] callJson attempt ${attempt}/${JSON_CALL_MAX_ATTEMPTS}: 応答が空`);
    } else {
      try {
        return parseJson(text);
      } catch (err) {
        lastErr = err;
        console.warn(`[WARN] callJson attempt ${attempt}/${JSON_CALL_MAX_ATTEMPTS}: JSON.parse 失敗 (${err.message})`);
        console.warn(`[WARN] パースに失敗した生の応答文字列:\n${text}`);
      }
    }
    if (attempt < JSON_CALL_MAX_ATTEMPTS) await sleep(1000 * attempt);
  }
  throw new Error(`Gemini JSON 応答の取得に ${JSON_CALL_MAX_ATTEMPTS} 回失敗しました: ${lastErr?.message}`);
}

function analysisPrompt({ topArticles, bottomArticles, days }) {
  return `あなたは日本の不動産オウンドメディア「物件目利きリサーチ」のグロース担当アナリストです。
過去 ${days} 日間の GA4 実績データ（ブログ記事ごとの PV・エンゲージメント率・LP CTA クリック数・サインアップ数）を分析し、
今後の記事企画・執筆に活かす『SEO・CVR改善ガイドライン』を作成してください。

# 成績上位の記事 (PV降順)
${JSON.stringify(topArticles, null, 2)}

# 成績下位の記事
${JSON.stringify(bottomArticles, null, 2)}

# 分析観点
- テーマ・切り口・対象エリアと PV / エンゲージメント率 / CTR (clickCtaCount÷pageViews) / CVR (signUpCount÷clickCtaCount) の相関傾向
- 上位記事に共通するテーマ・エリアの特徴、下位記事に共通する弱点
- 記事構成面での改善余地（実データの見せ方、グラフ・画像の要否、読者層に合わせたトーン等）

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "recommendedThemes": ["次回以降に優先すべきテーマ案（3〜6件、具体的に）"],
  "recommendedAreas": ["反響が良い傾向のエリア系統（3〜6件、具体的な市区町村名や地域特性）"],
  "avoidThemes": ["反響が薄い傾向のテーマ・切り口（0〜4件）"],
  "highPerformingPatterns": { "themes": ["..."], "areas": ["..."], "insight": "上位記事に共通する傾向の分析（150字程度）" },
  "lowPerformingPatterns": { "themes": ["..."], "areas": ["..."], "insight": "下位記事に共通する弱点の分析（150字程度）" },
  "contentGuidelines": {
    "structure": ["本文構成に関する改善指示（例: 実データの表を冒頭近くに配置する 等）を3〜5件"],
    "visuals": ["画像・グラフに関する改善指示（例: 価格推移グラフのプレースホルダーを挿入する提案を含める 等）を2〜4件"],
    "tone": "対象読者層に響くトーン・文体の指示（80字程度）",
    "seoNotes": "タイトル・見出し・メタディスクリプションで意識すべき点（80字程度）"
  },
  "summary": "今回の分析の要約（150字程度）"
}`;
}

function fallbackGuidelines({ sampleSize, reason }) {
  return {
    insufficientData: true,
    reason,
    recommendedThemes: [],
    recommendedAreas: [],
    avoidThemes: [],
    highPerformingPatterns: { themes: [], areas: [], insight: null },
    lowPerformingPatterns: { themes: [], areas: [], insight: null },
    contentGuidelines: {
      structure: [
        "実データ（取引価格・単価・ハザード情報）を表形式で整理し、本文中盤までに配置する",
        "本文冒頭のリード段落で読者の悩み・検索意図に直接答える",
      ],
      visuals: ["価格推移や取引件数を示すグラフのプレースホルダー・提案を1箇所以上含める", "アイキャッチ画像の構図・被写体の提案を含める"],
      tone: "専門的だが平易で、初めて不動産を調べる読者にも分かりやすいトーン",
      seoNotes: "タイトルに具体的な地名・年号・数字を含め、検索意図に即した見出し構成にする",
    },
    summary: `実績データ不足（分析対象記事数=${sampleSize}）のため、統計分析ではなく既定のベストプラクティスに基づくガイドラインを使用しています。`,
  };
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  try {
    let reports;
    if (INPUT_FILE) {
      console.log(`[INFO] フィクスチャから読み込みます: ${INPUT_FILE}`);
      reports = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    } else {
      console.log(`[INFO] GA4 プロパティ ${PROPERTY_ID} から ${START_DATE}〜${END_DATE} の記事実績を取得します`);
      reports = await fetchReports();
    }

    const articleMeta = loadArticleMeta();
    const articles = aggregateArticles(reports, articleMeta);
    console.log(`[INFO] 実績のあるブログ記事数: ${articles.length}`);

    const TOP_N = 10;
    const topArticles = articles.slice(0, TOP_N);
    const bottomArticles = articles.length > TOP_N ? articles.slice(-TOP_N).reverse() : [];

    let analysis;
    if (articles.length < MIN_SAMPLE_ARTICLES) {
      console.log(
        `[INFO] 実績記事数 (${articles.length}) が閾値 (${MIN_SAMPLE_ARTICLES}) 未満のため、Gemini 分析をスキップし既定ガイドラインを使用します`,
      );
      analysis = fallbackGuidelines({ sampleSize: articles.length, reason: "insufficient_sample_size" });
    } else {
      if (!process.env.GEMINI_API_KEY) {
        console.error("[ERROR] 必須環境変数 GEMINI_API_KEY が未設定です");
        process.exit(1);
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      console.log(`[INFO] Gemini (${MODEL}) でパフォーマンス傾向を分析中...`);
      analysis = await callJson(ai, analysisPrompt({ topArticles, bottomArticles, days: DAYS }));
      analysis.insufficientData = false;
    }

    const guidelines = {
      generatedAt: new Date().toISOString(),
      period: { days: DAYS, startDate: START_DATE, endDate: END_DATE },
      sampleSize: articles.length,
      topArticles,
      bottomArticles,
      ...analysis,
    };

    console.log("\n" + JSON.stringify(guidelines, null, 2) + "\n");

    if (DRY_RUN) {
      console.log("[DRY] dry-run のため data/blog_seo_guidelines.json への保存はスキップしました");
      return;
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(guidelines, null, 2) + "\n", "utf8");
    console.log(`[SUCCESS] ${path.relative(process.cwd(), OUTPUT_PATH)} に保存しました`);
  } catch (err) {
    console.error(`[ERROR] ブログパフォーマンス分析に失敗しました: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

module.exports = { parsePagePath, aggregateArticles, parseFrontmatter, isJaBlogFile, fallbackGuidelines };
if (require.main === module) main();
