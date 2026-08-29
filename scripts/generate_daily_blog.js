#!/usr/bin/env node
/**
 * generate_daily_blog.js — Gemini API で日本語の不動産ブログ記事を1件生成し、
 * 英語(en) / 繁体字(zh-TW) / 簡体字(zh-CN) に翻訳して frontend/content/blog/ に
 * `YYYY-MM-DD-<slug>.{lang}.md` 形式で保存する (lang は 空 / en / zh-TW / zh-CN)。
 *
 * 設計メモ:
 *   メタデータ (JSON) と本文 Markdown は別々の API 呼び出しで生成する。
 *   本文を JSON 文字列に詰め込むと制御文字エスケープが破綻しがちで、
 *   実際に動かして JSON.parse 失敗を確認したため分離した。
 *
 * AI編集長（企画会議）:
 *   本文執筆の前に、Gemini に「今日のテーマ・切り口・対象エリア」を自律的に
 *   決定させる企画会議ステップを挟む。過去のテーマ・連載状況は
 *   data/blog_context.json にローカル記録し、季節ネタの優先判定や
 *   連載（3〜5回目安）の継続/切り替え判断の入力として使う。
 *
 * データドリブンな自己進化ループ（SEO・CVR改善ガイドライン）:
 *   scripts/analyze_blog_performance.js が GA4 実績を分析して生成する
 *   data/blog_seo_guidelines.json（無ければスキップ）を読み込み、
 *   - 企画会議プロンプトに「推奨テーマ/エリア」を渡してテーマ選定に反映
 *   - 本文執筆プロンプトに「SEO・CVR改善ガイドライン（構成/画像/トーン）」を渡して反映
 *   することで、過去の反響データに基づいて記事の質を継続的に改善する。
 *
 * 図表の自動生成・挿入:
 *   本文生成前に、(1) 実取得データ（transactionStats/samples）から QuickChart の
 *   取引価格グラフ URL を組み立て、(2) Gemini（軽量モデルで英語プロンプト生成 →
 *   gemini-3.1-flash-image で画像生成）でエリア・テーマに合わせたアイキャッチ画像を
 *   生成して frontend/public/images/blog/ に保存する。どちらも失敗時は null を返し、
 *   本文プロンプトから該当の挿入指示を省略するだけで記事生成自体は止めない。
 *
 * 必須環境変数:
 *   GEMINI_API_KEY        — Gemini API キー
 *
 * 任意環境変数:
 *   GEMINI_MODEL               — 本文執筆用モデル。既定: gemini-3.1-pro-preview
 *   GEMINI_PLANNING_MODEL      — 企画会議・画像プロンプト生成用の軽量モデル。既定: gemini-3.6-flash
 *   GEMINI_IMAGE_MODEL         — アイキャッチ画像生成モデル。既定: gemini-3.1-flash-image
 *   GEMINI_IMAGE_FALLBACK_MODEL — 画像生成の第一候補失敗時のフォールバック。既定: gemini-2.5-flash-image
 *   BLOG_DATE             — 上書き YYYY-MM-DD (既定: JST の本日)
 *   BLOG_DRY_RUN          — "1" の場合、ファイル書き込み・コンテキスト保存・
 *                            翻訳をスキップし、企画会議〜日本語本文生成のみ確認
 *                            (実データ取得・画像生成は行い、実URLが本文に入るか確認可能)
 *   BLOG_API_BASE_URL     — 実データ取得用バックエンド URL
 *                            既定: https://realestate-api-2hctlfcy6a-an.a.run.app
 *   BLOG_SITE_BASE_URL    — 末尾CTAリンクの本番トップページ URL
 *                            既定: https://mekiki-research.com
 *   GCP_PROJECT_ID / FIREBASE_PROJECT_ID — Firestore への X 投稿テンプレート
 *                            書き込みを有効化するための GCP プロジェクト ID。
 *                            未設定 / Admin SDK 初期化失敗時は Firestore 書き込みを
 *                            スキップしてブログ生成自体は成功させる。
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
const PLANNING_MODEL = process.env.GEMINI_PLANNING_MODEL || "gemini-3.6-flash";
const DRY_RUN = process.env.BLOG_DRY_RUN === "1";

// 実データ取得先: 既定は Cloud Run の本番バックエンド。
// BLOG_API_BASE_URL で上書き可能（ステージング検証や mekiki-research.com 経由の API ルート増設時など）。
const API_BASE_URL = (process.env.BLOG_API_BASE_URL || "https://realestate-api-2hctlfcy6a-an.a.run.app").replace(/\/$/, "");
const SITE_BASE_URL = (process.env.BLOG_SITE_BASE_URL || "https://mekiki-research.com").replace(/\/$/, "");

// アイキャッチ画像生成（Gemini 画像モデル、フォールバック順）。
// backend/src/services/imagenApi.ts の「暮らしイメージ」生成と同じフォールバック方針
// （Nano Banana 2 → 旧世代 Flash Image）を踏襲する。
const IMAGE_MODEL_PRIMARY = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const IMAGE_MODEL_FALLBACK = process.env.GEMINI_IMAGE_FALLBACK_MODEL || "gemini-2.5-flash-image";
const IMAGE_OUTPUT_DIR = path.resolve(__dirname, "../frontend/public/images/blog");

// ─── AI編集長コンテキスト（連載・過去テーマの記録） ────────────────────────
// 「今日のテーマ・エリア」を毎回ランダムに選ぶのではなく、AI編集長 (Gemini) が
// 過去の掲載履歴・進行中の連載を踏まえて自律的に決定する。その判断材料として
// ローカル JSON に「直近テーマ」「現在の連載と継続回数」を記録・引き継ぐ。
const CONTEXT_PATH = path.resolve(__dirname, "../data/blog_context.json");
const MAX_RECENT_THEMES = 30;

function loadContext() {
  const defaults = { recentThemes: [], currentSeries: null };
  if (!fs.existsSync(CONTEXT_PATH)) return defaults;
  try {
    const raw = JSON.parse(fs.readFileSync(CONTEXT_PATH, "utf8"));
    return {
      recentThemes: Array.isArray(raw.recentThemes) ? raw.recentThemes : [],
      currentSeries: raw.currentSeries || null,
    };
  } catch (err) {
    console.warn(`[WARN] blog_context.json の読み込みに失敗したため初期状態を使用します: ${err.message}`);
    return defaults;
  }
}

function saveContext(context) {
  fs.mkdirSync(path.dirname(CONTEXT_PATH), { recursive: true });
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(context, null, 2) + "\n", "utf8");
}

// ─── SEO・CVR改善ガイドライン（scripts/analyze_blog_performance.js が生成） ──
// GA4 実績分析の結果。週次ワークフローで更新される想定。無い/壊れている場合は
// null を返し、企画会議・本文執筆は従来どおりガイドライン無しで進行する
// （このスクリプトは常にブログ生成自体を成立させることを優先する）。
const GUIDELINES_PATH = path.resolve(__dirname, "../data/blog_seo_guidelines.json");

function loadGuidelines() {
  if (!fs.existsSync(GUIDELINES_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(GUIDELINES_PATH, "utf8"));
    return raw && typeof raw === "object" ? raw : null;
  } catch (err) {
    console.warn(`[WARN] blog_seo_guidelines.json の読み込みに失敗したため無視します: ${err.message}`);
    return null;
  }
}

// 企画会議の決定結果を反映してコンテキストを更新する。
// isSeriesContinuation は AI の判断をそのまま信頼するが、テーマ名の完全一致では
// 判定しない（「○○（完結編）」のような表記揺れで継続と誤認されなくなるのを防ぐため）。
// 継続時は連載タイトルを currentSeries.theme のまま固定し、切り口(angle)のみ更新する。
function updateContext(context, plan, today) {
  const continuing = Boolean(plan.isSeriesContinuation) && Boolean(context.currentSeries);
  const currentSeries = continuing
    ? { ...context.currentSeries, angle: plan.angle, count: context.currentSeries.count + 1, lastDate: today }
    : { theme: plan.theme, angle: plan.angle, count: 1, startedAt: today, lastDate: today };

  const recentThemes = [
    { date: today, theme: currentSeries.theme, angle: plan.angle, targetArea: plan.targetArea, isSeriesContinuation: continuing },
    ...context.recentThemes,
  ].slice(0, MAX_RECENT_THEMES);

  return { recentThemes, currentSeries };
}

if (!DRY_RUN && !process.env.GEMINI_API_KEY) {
  console.error("[ERROR] 必須環境変数 GEMINI_API_KEY が未設定です");
  process.exit(1);
}

function jstToday() {
  if (process.env.BLOG_DATE) return process.env.BLOG_DATE;
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60_000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function existingSlugs() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const slugs = new Set();
  for (const f of fs.readdirSync(BLOG_DIR)) {
    if (!f.endsWith(".md")) continue;
    const base = f.replace(/\.(en|zh-CN|zh-TW)\.md$/, "").replace(/\.md$/, "");
    slugs.add(base);
  }
  return Array.from(slugs).sort().reverse();
}

function buildFrontmatter({ title, description, publishedAt, tags, primaryLocation }) {
  const escape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const tagLine = (tags || []).map((t) => `"${escape(t)}"`).join(", ");
  return [
    "---",
    `title: "${escape(title)}"`,
    `description: "${escape(description)}"`,
    `publishedAt: "${publishedAt}"`,
    `tags: [${tagLine}]`,
    "primaryLocation:",
    `  lat: ${Number(primaryLocation.lat)}`,
    `  lng: ${Number(primaryLocation.lng)}`,
    `  name: "${escape(primaryLocation.name)}"`,
    "---",
    "",
  ].join("\n");
}

function sanitizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function parseJson(text) {
  let cleaned = String(text || "").trim();
  // コードフェンス (```json ... ``` / ``` ... ```) を除去
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // 前後に余計な説明文が混ざっている場合、最初の '{' から最後の '}' までを抽出
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

function stripFences(text) {
  let cleaned = String(text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return cleaned;
}

// ─── Gemini 呼び出しラッパー ───────────────────────────────────────────────────
const JSON_CALL_MAX_ATTEMPTS = 3;

// Gemini API の一時的な高負荷 (503 UNAVAILABLE) やレート制限 (429)、内部エラー (500) は
// リトライで回復することが多いため、generateContent の呼び出し自体を指数バックオフで叩き直す。
const API_CALL_MAX_ATTEMPTS = 5;
const API_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 例外オブジェクトから HTTP ステータスコードを可能な限り抽出する。
// @google/genai の ApiError は `status` / `code` に数値を持つが、
// バージョンによっては message に埋め込まれた JSON のみのこともある。
function extractApiErrorStatus(err) {
  if (!err) return null;
  for (const key of ["status", "code", "statusCode"]) {
    const v = err[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d{3}$/.test(v.trim())) return Number(v.trim());
  }
  const msg = String(err?.message || err || "");
  const m = msg.match(/"code"\s*:\s*(\d{3})/) || msg.match(/\b(429|500|502|503|504)\b/);
  return m ? Number(m[1]) : null;
}

// generateContent を指数バックオフ付きでリトライするラッパー。
// リトライ不能なエラー (400 系の入力不正など) は即座に再スローする。
async function generateContentWithRetry(ai, params) {
  let lastErr;
  for (let attempt = 1; attempt <= API_CALL_MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      const status = extractApiErrorStatus(err);
      const retryable = status === null || API_RETRYABLE_STATUS.has(status);
      if (!retryable || attempt >= API_CALL_MAX_ATTEMPTS) {
        break;
      }
      const waitSec = 2 ** attempt; // 2, 4, 8, 16 秒
      console.warn(
        `[WARN] Gemini API エラー発生 (${status ?? "unknown"}). ` +
          `${waitSec}秒後にリトライします... (attempt ${attempt}/${API_CALL_MAX_ATTEMPTS})`,
      );
      await sleep(waitSec * 1000);
    }
  }
  const status = extractApiErrorStatus(lastErr);
  throw new Error(
    `Gemini API 呼び出しに ${API_CALL_MAX_ATTEMPTS} 回失敗しました (status: ${status ?? "unknown"}): ${lastErr?.message || lastErr}`,
  );
}

// JSON モードを明示指定してもごく稀にフォーマットが崩れて返ってくることがあるため、
// パース失敗時は生の応答をログに残した上で最大 JSON_CALL_MAX_ATTEMPTS 回まで叩き直す。
async function callJson(ai, prompt, model = MODEL) {
  let lastErr;
  for (let attempt = 1; attempt <= JSON_CALL_MAX_ATTEMPTS; attempt++) {
    const response = await generateContentWithRetry(ai, {
      model,
      contents: prompt,
      config: {
        responseModalities: ["TEXT"],
        responseMimeType: "application/json",
        temperature: 0.8,
      },
    });
    const text = response?.text;
    if (!text) {
      lastErr = new Error("Gemini からの応答が空でした (JSON)");
      console.warn(`[WARN] callJson attempt ${attempt}/${JSON_CALL_MAX_ATTEMPTS}: 応答が空`);
    } else {
      try {
        return parseJson(text);
      } catch (err) {
        lastErr = err;
        console.warn(
          `[WARN] callJson attempt ${attempt}/${JSON_CALL_MAX_ATTEMPTS}: JSON.parse 失敗 (${err.message})`,
        );
        console.warn(`[WARN] パースに失敗した生の応答文字列:\n${text}`);
      }
    }
    if (attempt < JSON_CALL_MAX_ATTEMPTS) {
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`Gemini JSON 応答の取得に ${JSON_CALL_MAX_ATTEMPTS} 回失敗しました: ${lastErr?.message}`);
}

async function callText(ai, prompt) {
  const response = await generateContentWithRetry(ai, {
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.85 },
  });
  const text = response?.text;
  if (!text) throw new Error("Gemini からの応答が空でした (text)");
  return stripFences(text);
}

// ─── プロンプト ───────────────────────────────────────────────────────────────

// AI編集長による企画会議: 本文執筆に先立ち「今日のテーマ・切り口・対象エリア」を決定させる。
// 季節ネタの優先判定、連載の継続/切り替え判断、地域の多様性確保 (首都圏偏重回避) を
// 過去コンテキストに基づいて自律的に行わせる。
function editorialPlanPrompt({ today, context, guidelines }) {
  const recentList =
    context.recentThemes
      .slice(0, 15)
      .map((t) => `- ${t.date} | テーマ: ${t.theme} | エリア: ${t.targetArea}${t.isSeriesContinuation ? " (連載継続)" : ""}`)
      .join("\n") || "(まだ記事がありません)";

  const series = context.currentSeries;
  const seriesBlock = series
    ? `現在進行中の連載: 「${series.theme}」(切り口: ${series.angle}) — これまで ${series.count} 回掲載 (開始日: ${series.startedAt})。
連載は3〜5回程度で完結させるのが目安。${series.count >= 4 ? "そろそろ完結、または新テーマへの切り替えを検討すること。" : ""}`
    : "現在進行中の連載はありません。";

  const perfBlock =
    guidelines && !guidelines.insufficientData
      ? `
# GA4実績分析による推奨（scripts/analyze_blog_performance.js、直近${guidelines.period?.days ?? "N"}日間・分析記事数${guidelines.sampleSize ?? "?"}件）
- 反響が良い傾向のテーマ: ${(guidelines.recommendedThemes || []).join(" / ") || "(なし)"}
- 反響が良い傾向のエリア系統: ${(guidelines.recommendedAreas || []).join(" / ") || "(なし)"}
- 反響が薄い傾向（避けるべき切り口）: ${(guidelines.avoidThemes || []).join(" / ") || "(なし)"}
- 傾向分析: ${guidelines.highPerformingPatterns?.insight || "(なし)"}
`
      : "";

  return `あなたは日本の不動産オウンドメディア「物件目利きリサーチ」(https://mekiki-research.com) の編集長です。
本日 ${today} 付のブログ記事の企画会議を行い、「今日書くべきテーマ・切り口・対象エリア」を決定してください。

# 直近の掲載履歴（重複・偏り回避のため）
${recentList}

# 連載の状況
${seriesBlock}
${perfBlock}
# 決定方針（優先順位順）
1. **季節ネタの最優先**: 本日 ${today} が日本の季節行事・記念日（正月、成人の日、節分、ひな祭り、お花見・入学式、ゴールデンウィーク、夏至、七夕、お盆、防災の日(9/1)、十五夜、ハロウィン、紅葉シーズン、年末、クリスマス、大晦日 など）に該当する、またはその直前の時期であれば、それにちなんだテーマを最優先で選ぶこと。該当しない場合はこのルールを無視してよい。
2. **連載の継続判断**: 季節ネタが無い場合、上記「連載の状況」を踏まえ、連載を継続するか（3〜5回程度を目安に）、飽きが来る前に新しい連載テーマ（例: 伊能忠敬の足跡、新幹線の新駅周辺 など）に切り替えるかを自律的に判断すること。
3. **地域の多様性**: 直近の掲載履歴にあるエリアとの重複や偏り（特に東京23区中心部・横浜駅周辺など首都圏中心部への偏り）を避け、全国の多様な市区町村からテーマに最もふさわしい具体的エリアを選ぶこと。
4. **GA4実績分析の反映**: 上記「GA4実績分析による推奨」がある場合、季節ネタ・連載継続のルールを優先しつつ、新テーマ選定時や連載の切り替え先を検討する際の参考材料として活用すること（推奨テーマ・エリアをそのまま採用してもよいし、そこから着想を広げてもよい。ただし直近の掲載履歴との重複は避けること）。

# 出力要件
- targetArea: 日本の具体的な市区町村・地区名（例:「福岡市博多区」「金沢市」）
- lat / lng: targetArea の代表地点（駅・市役所等）の **実在する正確な緯度経度**（架空の座標や近似しすぎる丸めは禁止）
- isSeriesContinuation: 上記「現在進行中の連載」のテーマを継続する場合のみ true。季節ネタ・新テーマの場合は false

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "theme": "今日のテーマ（連載名 or 季節ネタ名、20字程度）",
  "angle": "具体的な切り口・分析視点（40字程度）",
  "targetArea": "具体的な市区町村・地区名",
  "lat": 0.0,
  "lng": 0.0,
  "isSeriesContinuation": false
}`;
}

function jaMetaPrompt({ today, recentSlugs, plan }) {
  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストで、B2B SaaS「物件目利きリサーチ」(https://mekiki-research.com) のオウンドメディアを執筆しています。
本日 ${today} 付の不動産ブログ記事1件のメタデータを日本語で生成してください。

# 本日の企画（編集長決定済み・厳守）
- テーマ: ${plan.theme}
- 切り口: ${plan.angle}
- 対象エリア: ${plan.targetArea}（lat=${plan.lat}, lng=${plan.lng}）

上記テーマ・切り口・エリアに厳密に従ってメタデータを生成すること。他テーマ・他地域への逸脱は禁止。

# その他要件
- 過去の slug と重複させない: ${recentSlugs.slice(0, 30).join(", ") || "(なし)"}
- 地名や政策名を具体的に絞った切り口にすること

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "slug": "lowercase-hyphenated-kebab (英数字とハイフンのみ、40字以内、地名+テーマ)",
  "title": "60〜80文字、SEOを意識し具体的な数字や年号・地名を含む",
  "description": "メタディスクリプション 140〜180文字、結論を端的に",
  "tags": ["タグ1", "タグ2", "..."],
  "outline": ["## 1. ...", "## 2. ...", "...", "## 8. まとめ"]
}`;
}

function jaBodyPrompt({ today, meta, areaData, plan, guidelines, heroImage, chart }) {
  const lat = Number(meta.primaryLocation?.lat);
  const lng = Number(meta.primaryLocation?.lng);
  const locName = meta.primaryLocation?.name || "対象エリア";
  const ctaUrl = `${SITE_BASE_URL}/?lat=${lat}&lng=${lng}&zoom=15&ref=blog_cta`;
  const themeBlock = plan
    ? `
# 本日の企画（編集長決定済み・厳守）
- テーマ: ${plan.theme}
- 切り口: ${plan.angle}
本文全体を通して、上記テーマ・切り口を軸に据えて執筆すること。`
    : "";

  const cg = guidelines && !guidelines.insufficientData ? guidelines.contentGuidelines : null;
  const guidelinesBlock = cg
    ? `
# SEO・CVR改善ガイドライン（GA4実績分析ベース、scripts/analyze_blog_performance.js が生成・週次更新）
過去の記事実績分析から得られた、以下の構成・表現方針を今回の本文に反映すること:
- 構成: ${(cg.structure || []).map((s) => `\n  - ${s}`).join("") || "(なし)"}
- 画像・グラフの配置方針（参考。実際に挿入する画像・グラフの実体は下記「実画像・グラフの挿入」を参照）: ${(cg.visuals || []).map((s) => `\n  - ${s}`).join("") || "(なし)"}
- トーン: ${cg.tone || "(指定なし)"}
- SEO留意点: ${cg.seoNotes || "(指定なし)"}`
    : "";

  // 本文生成前に実データ・AI画像生成から用意済みの実アセット（QuickChartグラフURL /
  // Gemini生成アイキャッチ画像パス）。プレースホルダーではなく実体のあるURLを
  // そのまま Markdown 画像記法で挿入させる。どちらか/両方が欠けている場合は
  // 該当行のみ省略する（画像生成失敗時などに記事生成自体を止めないため）。
  const assetLines = [];
  if (heroImage) {
    assetLines.push(
      `- アイキャッチ・挿絵画像（生成済み、記事冒頭のリード段落の直後に1回だけ挿入）:\n    \`![${locName}のイメージ](${heroImage.path})\``,
    );
  }
  if (chart) {
    assetLines.push(
      `- 取引価格グラフ（QuickChartで生成済みの実データグラフ、実データの説明箇所付近に1回だけ挿入）:\n    \`![${chart.alt}](${chart.url})\``,
    );
  }
  const assetBlock =
    assetLines.length > 0
      ? `
# 実画像・グラフの挿入（厳守）
以下は本記事のために実際に生成済みの画像・グラフである。説明文やプレースホルダーへの言い換えは禁止。
指定された Markdown 画像記法をURLを一切改変せずそのまま本文中に挿入すること（各1回ずつ、合計${assetLines.length}箇所）:
${assetLines.join("\n")}`
      : "";

  const evidenceBlock = areaData
    ? `
# 実取得データ（エビデンス・必ず本文中で複数箇所引用すること）
以下は、本日「物件目利きリサーチ」のトップページ ${SITE_BASE_URL}/?lat=${lat}&lng=${lng} で実際に lat=${lat}, lng=${lng} を検索した際にバックエンド (Cloud Run / MLIT 国交省 API + 国土地理院ハザード) から取得された **実データ** です。

\`\`\`json
${JSON.stringify(areaData, null, 2)}
\`\`\`

## 本文への引用ルール（厳守）
- 上記実データの数値・固有名詞を **複数セクションで具体的に引用** すること（取引件数、平均/中央値の取引価格、平均単価、対象期間、用途地域、容積率/建蔽率、最寄駅、駅乗降客数、医療機関数、学区、洪水深ランク、土砂災害現象 など）。
- 推測や一般論ではなく、**この実データを「裏付け」として明示的に引用しながら** 専門的・説得的に分析すること。
- 取引価格は \`tradePrice\`（円）から「○,○○○万円」形式に変換（四捨五入）。例: 45,320,000 → 約4,500万円。
- 単価は \`unitPrice\`（円/㎡）から「○○万円/㎡」形式に変換。例: 612,300 → 約61万円/㎡。
- ハザード情報がリスクありの場合、購入前に必ず確認すべき点として読者に注意喚起する文脈で引用すること。
- データ件数が少ない/0件の場合や、特定フィールドが null の場合は、その事実自体を率直に記述（「公開取引データが薄いエリアであり、近隣相場との比較が不可欠」等）し、決して捏造しないこと。
`
    : `
# 実取得データ
今回はバックエンドAPIからの実データ取得に失敗したため、一般公開情報・国交省統計・地価公示の傾向に基づいて執筆してください。
特定の取引価格や駅乗降客数など具体的な数値を断定的に提示することは避け、「○○程度と見られる」「公示地価は…の傾向」など、出典の確実性に応じた表現を用いること。
`;

  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストです。「物件目利きリサーチ」(${SITE_BASE_URL}) のオウンドメディア向けに、本日 ${today} 付の以下の記事の本文を Markdown で執筆してください。
${themeBlock}
${evidenceBlock}
${guidelinesBlock}
${assetBlock}
# 記事メタデータ
- タイトル: ${meta.title}
- description: ${meta.description}
- 主要地点: ${locName}（lat=${lat}, lng=${lng}）
- 想定アウトライン: ${(meta.outline || []).join(" / ")}

# 執筆指針
- 構成: Markdown 見出し \`## 1. 〜 ## 8. まとめ\` (合計8セクション程度) を使う
- 表 (\`| ~ |\`) と箇条書きを適宜活用し、上記実データの数値を表で整理する箇所を最低1つ含めること
- 本文文字数: **必ず 4,500〜6,000 文字** に収めること (これより長くしない)
- トーン: 専門的で分析的、ただし読みやすい解説調
- 記事冒頭にリード段落を 2〜3 段落入れる (h1 や frontmatter は出力しない、いきなり Markdown 本文から)

# 末尾CTA（厳守）
- 記事最終セクション（## 8. まとめ）の末尾に、以下の Markdown リンクを **改変せず** 必ず挿入すること:
  \`[${locName}の最新の地価・ハザード情報を Mekiki Research で確認する 👉](${ctaUrl})\`
- このリンクの URL（クエリ \`?lat=${lat}&lng=${lng}&zoom=15&ref=blog_cta\` を含む）は省略・改変・分割しないこと。
- ベータ版（/research）など他のパスへのリンクは禁止。本番トップページ + 位置情報クエリのみを使用する。
- 上記リンクの直前または直後に、無料会員登録を促す一文を **記事の文脈に合わせて自然に** 織り込むこと。次の訴求を必ず含める（言い回しは記事のトーンに合わせて調整してよい）:
  「無料会員登録すると、このブログで使われている国土交通省のデータを、あなたの Claude や ChatGPT から直接引き出せるようになります（MCP連携）」
- MCP連携の説明は1〜2文にとどめ、宣伝くささを避けて「調査を自分のAIで続けられる」というメリットとして提示すること。

# 出力 (厳守)
- frontmatter (\`---\` で囲まれた領域) は付けない
- コードフェンス (\`\`\`) で全体を囲まない
- いきなり本文 Markdown から始める`;
}

function transMetaPrompt({ lang, jaMeta }) {
  const langLabel = {
    en: "English (en)",
    "zh-TW": "Traditional Chinese (zh-TW, 台湾繁体)",
    "zh-CN": "Simplified Chinese (zh-CN, 中国大陆简体)",
  }[lang];
  return `あなたはプロの翻訳者です。以下の日本語不動産記事のメタデータを ${langLabel} に翻訳してください。

# 翻訳指針
- 日本の固有名詞 (地名・駅名・企業名・政策名) は対象言語の慣用表記に置き換え、必要なら ( ) 内に英字または日本語原文を併記
- ターゲット言語のネイティブが読んで自然になるようリライト

# 入力 (日本語)
${JSON.stringify(
  {
    title: jaMeta.title,
    description: jaMeta.description,
    tags: jaMeta.tags,
    primaryLocation: jaMeta.primaryLocation,
  },
  null,
  2,
)}

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "title": "(翻訳後)",
  "description": "(翻訳後)",
  "tags": ["..."],
  "primaryLocation": { "lat": ${jaMeta.primaryLocation.lat}, "lng": ${jaMeta.primaryLocation.lng}, "name": "(翻訳後の地点名)" }
}`;
}

function transBodyPrompt({ lang, jaBody }) {
  const langLabel = {
    en: "English (en)",
    "zh-TW": "Traditional Chinese (zh-TW, 台湾繁体)",
    "zh-CN": "Simplified Chinese (zh-CN, 中国大陆简体)",
  }[lang];
  return `あなたはプロの翻訳者です。以下の日本語不動産記事本文 (Markdown) を ${langLabel} に翻訳してください。

# 翻訳指針
- 日本の固有名詞は対象言語の慣用表記に置き換え、初出時は ( ) 内に英字または日本語原文を併記
- Markdown 構造 (見出し、表、箇条書き、リンク、画像 \`![alt](url)\`) を完全に保つ
- URL (https://mekiki-research.com 等、および画像記法内の URL) は変更しない。画像の alt テキストのみ翻訳してよい
- 翻訳調にせず、ターゲット言語のネイティブが読んで自然になるようリライト

# 出力 (厳守)
- frontmatter は付けない
- コードフェンス (\`\`\`) で全体を囲まない
- いきなり翻訳後の Markdown 本文から始める

# 入力 (日本語 Markdown)
${jaBody}`;
}

// ─── 実データ取得（トップページが叩くのと同じバックエンドAPI） ─────────────
async function fetchAreaData({ lat, lng }) {
  const url = `${API_BASE_URL}/api/property/transactions?lat=${Number(lat)}&lng=${Number(lng)}&zoom=15&locale=ja`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    console.log(`[INFO] 実データ取得中: ${url}`);
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function summarizeAreaData(raw) {
  if (!raw || typeof raw !== "object") return null;
  const records = Array.isArray(raw.data?.data) ? raw.data.data : [];
  const prices = records.map((r) => r.tradePrice).filter((p) => typeof p === "number" && p > 0);
  const unitPrices = records
    .map((r) => r.unitPrice)
    .filter((v) => typeof v === "number" && v > 0);

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : null;

  const samples = records.slice(0, 6).map((r) => ({
    type: r.type,
    use: r.use,
    districtName: r.districtName,
    tradePrice: r.tradePrice,
    unitPrice: r.unitPrice,
    pricePerUnit: r.pricePerUnit,
    floorPlan: r.floorPlan,
    area: r.area,
    buildingYear: r.buildingYear,
    period: r.period,
    structure: r.structure,
    cityPlanning: r.cityPlanning,
    coverageRatio: r.coverageRatio,
    floorAreaRatio: r.floorAreaRatio,
  }));

  const env = raw.environment || null;
  const compactEnv = env
    ? {
        zoning: env.zoning,
        schools: env.schools,
        station: env.station,
        medicalCount: env.medical?.count ?? 0,
        medicalSample: (env.medical?.facilities || []).slice(0, 3),
      }
    : null;

  return {
    location: {
      prefecture: records[0]?.prefecture ?? null,
      municipality: records[0]?.municipality ?? raw.data?.geocodedDistrict ?? null,
      cityCode: raw.data?.cityCode ?? null,
    },
    transactionStats: {
      sampleCount: records.length,
      yearRange:
        Array.isArray(raw.data?.years) && raw.data.years.length
          ? `${raw.data.years[0]}〜${raw.data.years[raw.data.years.length - 1]}`
          : null,
      avgTradePrice: avg(prices),
      medianTradePrice: median,
      minTradePrice: prices.length ? Math.min(...prices) : null,
      maxTradePrice: prices.length ? Math.max(...prices) : null,
      avgUnitPrice: avg(unitPrices),
    },
    samples,
    hazard: raw.hazard ?? null,
    environment: compactEnv,
    source: raw.source ?? null,
  };
}

// 実データ取得の失敗を吸収するラッパー。失敗しても記事生成自体は止めない
// （一般情報ベースのフォールバック執筆に切り替わるだけ）。
async function fetchAreaDataSafe(primaryLocation) {
  try {
    const raw = await fetchAreaData(primaryLocation);
    const areaData = summarizeAreaData(raw);
    console.log(
      `[INFO] 実データ取得 OK: source=${areaData?.source} count=${areaData?.transactionStats?.sampleCount} years=${areaData?.transactionStats?.yearRange}`,
    );
    return areaData;
  } catch (apiErr) {
    console.warn(`[WARN] 実データ取得に失敗: ${apiErr.message}. 一般情報ベースで本文を生成します。`);
    return null;
  }
}

// ─── 取引価格グラフ（QuickChart） ────────────────────────────────────────────
// summarizeAreaData() が返した実データから QuickChart の画像 URL を組み立てる純粋関数。
// AI 呼び出しを伴わないため areaData が取得できていれば同期的に即座に得られる。
// 優先順位: ① samples（個別取引、期別）> ② transactionStats（平均/中央値/最小/最大の要約）。
// どちらも使えるだけのデータが無ければ null を返し、呼び出し側は本文プロンプトへの
// グラフ挿入指示を省略する（実データが薄いエリアでグラフを捏造しないため）。
function buildAreaChartUrl(areaData, locName) {
  if (!areaData) return null;
  const samples = Array.isArray(areaData.samples) ? areaData.samples : [];
  const priced = samples.filter((s) => typeof s.tradePrice === "number" && s.tradePrice > 0);
  const label = locName || "対象エリア";

  let chart;
  let alt;
  if (priced.length >= 2) {
    const sorted = [...priced].sort((a, b) => String(a.period || "").localeCompare(String(b.period || "")));
    chart = {
      type: "bar",
      data: {
        labels: sorted.map((s) => s.period || s.districtName || "—"),
        datasets: [
          {
            label: "取引価格（万円）",
            data: sorted.map((s) => Math.round(s.tradePrice / 10000)),
            backgroundColor: "#3b82f6",
          },
        ],
      },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: `${label}の実取引価格` } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "万円" } } },
      },
    };
    alt = `${label}の実取引価格推移グラフ`;
  } else {
    const stats = areaData.transactionStats;
    const entries = [
      ["最低", stats?.minTradePrice],
      ["中央値", stats?.medianTradePrice],
      ["平均", stats?.avgTradePrice],
      ["最高", stats?.maxTradePrice],
    ].filter(([, v]) => typeof v === "number" && v > 0);
    if (entries.length < 2) return null;
    chart = {
      type: "bar",
      data: {
        labels: entries.map(([l]) => l),
        datasets: [
          {
            label: "取引価格（万円）",
            data: entries.map(([, v]) => Math.round(v / 10000)),
            backgroundColor: ["#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
          },
        ],
      },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: `${label}の取引価格統計` } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "万円" } } },
      },
    };
    alt = `${label}の取引価格統計グラフ`;
  }

  const url = `https://quickchart.io/chart?w=600&h=350&bkg=white&c=${encodeURIComponent(JSON.stringify(chart))}`;
  return { url, alt };
}

// AI が意図せず混入させる強調記号 (** / __) を除去する。
// 画像 ![alt](url) やリンク [text](url) は * / _ を構造に使わないので副作用なし。
function stripBoldMarkdown(text) {
  return String(text || "").replace(/\*\*/g, "").replace(/__/g, "");
}

// ─── アイキャッチ画像の自動生成（Gemini 画像モデル） ────────────────────────
// Stage1: 軽量モデル (PLANNING_MODEL) でエリア・テーマに合わせた英語の画像生成
//         プロンプトを動的生成する（backend/src/services/imagenApi.ts の
//         「暮らしイメージ」生成と同じ二段階方式）。
// Stage2: IMAGE_MODEL_PRIMARY → 失敗時 IMAGE_MODEL_FALLBACK の順で画像を生成し、
//         frontend/public/images/blog/ に保存する。
// 失敗しても記事生成自体は止めない（tryGenerateHeroImage が null を返すのみ）。
const IMAGE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert at writing prompts for photorealistic image generation AI.
Given a Japanese real-estate blog article's theme and target area, write a single English image generation
prompt for a photorealistic hero image (townscape / landscape / architecture) that matches the article.

Rules:
- Output ONLY the image generation prompt string. No explanation, no markdown, no prefix like "Prompt:".
- The prompt must be comma-separated keywords and short phrases.
- Reflect the REAL visual character of the specific area (urban core vs. suburban vs. rural, coastal vs.
  mountainous, notable landmarks/architecture style). Do NOT produce generic stock imagery.
- Choose season/weather appropriate to the area and theme (e.g. snow for Hokkaido/Tohoku in winter contexts).
- Do NOT include any text, logos, watermarks, or people's faces close-up.
- Always end with: photorealistic, high-quality photography, 16:9 landscape format, natural lighting.`;

async function generateHeroImagePrompt(ai, { plan, jaMeta }) {
  const userMessage = `Article theme (Japanese): ${plan.theme}
Angle (Japanese): ${plan.angle}
Target area (Japanese): ${plan.targetArea}
Article title (Japanese): ${jaMeta.title}`;
  const response = await generateContentWithRetry(ai, {
    model: PLANNING_MODEL,
    contents: `${IMAGE_PROMPT_SYSTEM_INSTRUCTION}\n\n${userMessage}`,
    config: { temperature: 0.9 },
  });
  const text = response?.text?.trim();
  if (!text) throw new Error("画像プロンプト生成の応答が空でした");
  return text;
}

async function generateImageViaGemini(ai, modelId, prompt) {
  const response = await generateContentWithRetry(ai, {
    model: modelId,
    contents: prompt,
    config: { responseModalities: ["IMAGE"] },
  });
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/jpeg" };
    }
  }
  throw new Error(`${modelId} の応答に画像データが含まれていません`);
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function tryGenerateHeroImage(ai, { plan, jaMeta, baseName }) {
  try {
    const imagePrompt = await generateHeroImagePrompt(ai, { plan, jaMeta });
    console.log(`[INFO] [画像生成] プロンプト: ${imagePrompt}`);

    let result;
    try {
      result = await generateImageViaGemini(ai, IMAGE_MODEL_PRIMARY, imagePrompt);
    } catch (err1) {
      console.warn(`[WARN] [画像生成] ${IMAGE_MODEL_PRIMARY} 失敗、${IMAGE_MODEL_FALLBACK} にフォールバック: ${err1.message}`);
      result = await generateImageViaGemini(ai, IMAGE_MODEL_FALLBACK, imagePrompt);
    }

    const ext = extensionForMimeType(result.mimeType);
    const filename = `${baseName}-image.${ext}`;
    fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMAGE_OUTPUT_DIR, filename), Buffer.from(result.data, "base64"));
    console.log(`[INFO] [画像生成] 保存完了: frontend/public/images/blog/${filename} (${result.mimeType})`);
    return { path: `/images/blog/${filename}`, prompt: imagePrompt };
  } catch (err) {
    console.warn(`[WARN] アイキャッチ画像生成に失敗したためスキップします: ${err.message}`);
    return null;
  }
}

// ─── Firestore への X 投稿テンプレート書き込み ──────────────────────────────
// admin ダッシュボード（/admin → X投稿管理タブ）が `social_templates` を参照する。
// ブログ記事が増えるたびに「記事紹介ツイート」テンプレートを自動で蓄積する。
//
// 初期化に失敗した場合（GCP 認証情報なし等）は警告ログのみ吐いて Skip する。
// ブログ生成は他経路のためのアーティファクトなので、Firestore 書き込みで失敗
// させたくない。
async function tryWriteSocialTemplate({ jaMeta, baseName }) {
  // Firestore は通常 Firebase プロジェクト ID で動いている（GCP プロジェクト ID と
  // 別物の場合あり）。FIREBASE_PROJECT_ID を優先して参照する。
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.warn("[WARN] GCP_PROJECT_ID 未設定のため social_templates への書き込みをスキップします。");
    return;
  }

  let adminMod;
  try {
    adminMod = require("firebase-admin");
  } catch (err) {
    console.warn(`[WARN] firebase-admin ロード失敗のため social_templates への書き込みをスキップ: ${err.message}`);
    return;
  }

  try {
    if (!adminMod.apps.length) {
      adminMod.initializeApp({ projectId });
    }
    const db = adminMod.firestore();

    const url = `${SITE_BASE_URL}/blog/${baseName}`;
    const description = String(jaMeta.description || jaMeta.title || "").trim();
    // 280 字以内に収める: 説明 + 改行 + URL + 改行 + ハッシュタグ
    const hashtags = (Array.isArray(jaMeta.tags) ? jaMeta.tags : [])
      .slice(0, 3)
      .map((tag) => "#" + String(tag).replace(/[\s#]/g, ""))
      .join(" ");
    const tail = `👇\n${url}${hashtags ? "\n" + hashtags : ""}`;
    const tailLen = Array.from(tail).length;
    const MAX = 280;
    const allowedDesc = Math.max(0, MAX - tailLen);
    const descChars = Array.from(description);
    const trimmedDesc =
      descChars.length <= allowedDesc
        ? description
        : descChars.slice(0, Math.max(0, allowedDesc - 1)).join("") + "…";
    const text = trimmedDesc + tail;

    await db.collection("social_templates").add({
      text,
      type: `ブログ記事紹介 — ${jaMeta.title || baseName}`,
      target: "不動産ブログ読者",
      lang: "ja",
      slug: baseName,
      url,
      createdAt: adminMod.firestore.FieldValue.serverTimestamp(),
      source: "generate_daily_blog",
    });
    console.log(`[INFO] social_templates に X 投稿テンプレートを追加しました (slug=${baseName}, ${Array.from(text).length} chars)`);
  } catch (err) {
    console.warn(`[WARN] social_templates 書き込み失敗 (継続): ${err.message}`);
  }
}

// ─── ファイル書き出し ─────────────────────────────────────────────────────────
function writeArticle(filename, meta, body, publishedAt) {
  const fm = buildFrontmatter({
    title: meta.title,
    description: meta.description,
    publishedAt,
    tags: meta.tags,
    primaryLocation: meta.primaryLocation,
  });
  const trimmedBody = stripBoldMarkdown(body).trim();
  const content = `${fm}\n${trimmedBody}\n`;
  const target = path.join(BLOG_DIR, filename);
  fs.writeFileSync(target, content, "utf8");
  console.log(`[INFO] 書き込み完了: ${filename} (${content.length} chars)`);
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    throw new Error(`ブログディレクトリが存在しません: ${BLOG_DIR}`);
  }

  const today = jstToday();
  const recentSlugs = existingSlugs();
  const context = loadContext();
  const guidelines = loadGuidelines();
  console.log(`[INFO] 対象日 (JST): ${today}`);
  console.log(`[INFO] 既存記事 base 数: ${recentSlugs.length}`);
  console.log(`[INFO] 過去テーマ記録数: ${context.recentThemes.length}, 進行中の連載: ${context.currentSeries?.theme || "(なし)"}`);
  console.log(
    guidelines
      ? `[INFO] SEO・CVR改善ガイドライン読み込み済み (生成日時=${guidelines.generatedAt || "?"}, insufficientData=${Boolean(guidelines.insufficientData)})`
      : "[INFO] SEO・CVR改善ガイドラインなし（data/blog_seo_guidelines.json 未生成のためスキップ）",
  );
  console.log(`[INFO] 企画モデル: ${PLANNING_MODEL} / 執筆モデル: ${MODEL}${DRY_RUN ? " (DRY RUN)" : ""}`);

  if (DRY_RUN && !process.env.GEMINI_API_KEY) {
    console.log("[DRY] GEMINI_API_KEY 未設定のため企画会議プロンプトのプレビューのみ表示します");
    console.log(editorialPlanPrompt({ today, context, guidelines }));
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log("[INFO] [編集長] 企画会議中...");
  const plan = await callJson(ai, editorialPlanPrompt({ today, context, guidelines }), PLANNING_MODEL);
  for (const k of ["theme", "angle", "targetArea"]) {
    if (!plan[k]) throw new Error(`企画会議の必須フィールド '${k}' が欠けています`);
  }
  if (
    typeof plan.lat !== "number" ||
    typeof plan.lng !== "number" ||
    !isFinite(plan.lat) ||
    !isFinite(plan.lng)
  ) {
    throw new Error(`企画会議の lat/lng が不正です: ${JSON.stringify(plan)}`);
  }
  console.log(`[INFO] 企画会議の決定: theme=${plan.theme} / area=${plan.targetArea} / series継続=${Boolean(plan.isSeriesContinuation)}`);

  if (DRY_RUN) {
    console.log("[DRY] [JA] メタデータ生成中...");
    const jaMeta = await callJson(ai, jaMetaPrompt({ today, recentSlugs, plan }));
    console.log("[DRY] メタデータ:", JSON.stringify(jaMeta, null, 2));
    jaMeta.primaryLocation = { lat: plan.lat, lng: plan.lng, name: plan.targetArea };
    jaMeta.slug = sanitizeSlug(jaMeta.slug) || "dry-run-preview";
    const dryBaseName = `${today}-${jaMeta.slug}`;

    // dry-run でも実データ取得・画像生成は実行する（本文に実URLが埋め込まれるかを
    // 確認できるようにするため）。.md ファイル書き込み・コンテキスト保存・翻訳・
    // Firestore 書き込みのみスキップする。画像は IMAGE_OUTPUT_DIR に実際に保存される
    // （プレビュー用の副作用として許容。commit 対象は frontend/content/blog/*.md と
    // data/blog_context.json のみなので生成された画像が誤って自動コミットされることはない）。
    console.log("[DRY] 実データ取得中...");
    const areaData = await fetchAreaDataSafe(jaMeta.primaryLocation);
    console.log("[DRY] アイキャッチ画像生成中...");
    const heroImage = await tryGenerateHeroImage(ai, { plan, jaMeta, baseName: dryBaseName });
    const chart = buildAreaChartUrl(areaData, jaMeta.primaryLocation.name);
    console.log(`[DRY] chart=${chart ? chart.url : "(なし)"}`);
    console.log(`[DRY] heroImage=${heroImage ? heroImage.path : "(なし)"}`);

    console.log("[DRY] [JA] 本文 Markdown 生成中...");
    const jaBody = await callText(ai, jaBodyPrompt({ today, meta: jaMeta, areaData, plan, guidelines, heroImage, chart }));
    console.log("[DRY] 本文 Markdown:\n" + jaBody);
    console.log("[DRY] (dry-run のため .md ファイル書き込み・コンテキスト保存・翻訳・Firestore書き込みはスキップしました)");
    return;
  }

  const primaryLocation = { lat: plan.lat, lng: plan.lng, name: plan.targetArea };

  console.log("[INFO] [JA] メタデータ生成中...");
  const jaMeta = await callJson(ai, jaMetaPrompt({ today, recentSlugs, plan }));
  for (const k of ["slug", "title", "description", "tags"]) {
    if (!jaMeta[k]) throw new Error(`日本語メタの必須フィールド '${k}' が欠けています`);
  }
  jaMeta.primaryLocation = primaryLocation;
  jaMeta.slug = sanitizeSlug(jaMeta.slug);
  if (!jaMeta.slug) throw new Error("生成された slug が無効です");

  const baseName = `${today}-${jaMeta.slug}`;
  console.log(`[INFO] base name: ${baseName}`);
  if (fs.existsSync(path.join(BLOG_DIR, `${baseName}.md`))) {
    throw new Error(`${baseName}.md は既に存在します。生成を中止します。`);
  }

  // 実データ取得（トップページが叩くのと同じ Cloud Run バックエンドAPI）と
  // アイキャッチ画像生成は互いに独立しているため並行実行する。どちらも失敗時は
  // null を返すだけで記事生成自体は止めない。
  const [areaData, heroImage] = await Promise.all([
    fetchAreaDataSafe(jaMeta.primaryLocation),
    tryGenerateHeroImage(ai, { plan, jaMeta, baseName }),
  ]);
  const chart = buildAreaChartUrl(areaData, jaMeta.primaryLocation.name);

  console.log("[INFO] [JA] 本文 Markdown 生成中...");
  const jaBody = await callText(ai, jaBodyPrompt({ today, meta: jaMeta, areaData, plan, guidelines, heroImage, chart }));
  if (jaBody.length < 1500) {
    throw new Error(`日本語本文が短すぎます: ${jaBody.length} chars`);
  }
  writeArticle(`${baseName}.md`, jaMeta, jaBody, today);

  for (const lang of ["en", "zh-TW", "zh-CN"]) {
    console.log(`[INFO] [${lang}] メタデータ翻訳中...`);
    const tMeta = await callJson(ai, transMetaPrompt({ lang, jaMeta }));
    if (!tMeta.title || !tMeta.description) {
      throw new Error(`${lang} メタ翻訳が不完全です`);
    }
    tMeta.tags = tMeta.tags && tMeta.tags.length ? tMeta.tags : jaMeta.tags;
    tMeta.primaryLocation = tMeta.primaryLocation || jaMeta.primaryLocation;

    console.log(`[INFO] [${lang}] 本文翻訳中...`);
    const tBody = await callText(ai, transBodyPrompt({ lang, jaBody }));
    if (tBody.length < 800) {
      throw new Error(`${lang} 翻訳本文が短すぎます: ${tBody.length} chars`);
    }
    writeArticle(`${baseName}.${lang}.md`, tMeta, tBody, today);
  }

  console.log(`\n[SUCCESS] 4 言語のブログ記事を生成しました: ${baseName}`);

  // 企画会議の決定結果 (連載継続回数・直近テーマ) を記録し、翌日以降の
  // 企画会議の判断材料として引き継ぐ。
  saveContext(updateContext(context, plan, today));

  // Firestore (social_templates) への X 投稿テンプレート保存。
  // 失敗してもブログ生成自体は成功扱いのため await のみ（throw しない）。
  await tryWriteSocialTemplate({ jaMeta, baseName });
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
