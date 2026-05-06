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
 * 必須環境変数:
 *   GEMINI_API_KEY      — Gemini API キー
 *
 * 任意環境変数:
 *   GEMINI_MODEL        — 既定: gemini-2.5-pro
 *   BLOG_DATE           — 上書き YYYY-MM-DD (既定: JST の本日)
 *   BLOG_DRY_RUN        — "1" の場合 API を呼ばず構成のみ確認
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const DRY_RUN = process.env.BLOG_DRY_RUN === "1";

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
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
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
async function callJson(ai, prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.8,
    },
  });
  const text = response?.text;
  if (!text) throw new Error("Gemini からの応答が空でした (JSON)");
  return parseJson(text);
}

async function callText(ai, prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.85 },
  });
  const text = response?.text;
  if (!text) throw new Error("Gemini からの応答が空でした (text)");
  return stripFences(text);
}

// ─── プロンプト ───────────────────────────────────────────────────────────────
function jaMetaPrompt({ today, recentSlugs }) {
  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストで、B2B SaaS「物件目利きリサーチ」(https://mekiki-research.com) のオウンドメディアを執筆しています。
本日 ${today} 付の不動産ブログ記事1件のメタデータを日本語で生成してください。

# テーマ要件
- 日本の不動産 (相場、再開発、ハザード、人口動態、地価、投資、住宅市場、政策動向 など)
- 地名や政策名を具体的に絞った切り口にすること
- 過去の slug と重複させない: ${recentSlugs.slice(0, 30).join(", ") || "(なし)"}

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "slug": "lowercase-hyphenated-kebab (英数字とハイフンのみ、40字以内、地名+テーマ)",
  "title": "60〜80文字、SEOを意識し具体的な数字や年号・地名を含む",
  "description": "メタディスクリプション 140〜180文字、結論を端的に",
  "tags": ["タグ1", "タグ2", "..."],
  "primaryLocation": { "lat": 35.6580, "lng": 139.7016, "name": "渋谷駅" },
  "outline": ["## 1. ...", "## 2. ...", "...", "## 8. まとめ"]
}`;
}

function jaBodyPrompt({ today, meta }) {
  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストです。「物件目利きリサーチ」(https://mekiki-research.com) のオウンドメディア向けに、本日 ${today} 付の以下の記事の本文を Markdown で執筆してください。

# 記事メタデータ
- タイトル: ${meta.title}
- description: ${meta.description}
- 主要地点: ${meta.primaryLocation?.name || ""}
- 想定アウトライン: ${(meta.outline || []).join(" / ")}

# 執筆指針
- 構成: Markdown 見出し \`## 1. 〜 ## 8. まとめ\` (合計8セクション程度) を使う
- 表 (\`| ~ |\`) と箇条書きを適宜活用
- 本文文字数: **必ず 4,500〜6,000 文字** に収めること (これより長くしない)
- トーン: 専門的で分析的、ただし読みやすい解説調
- 末尾に「物件目利きリサーチで〇〇を調べる →」 (https://mekiki-research.com) へのリンクを自然に挿入する
- 記事冒頭にリード段落を 2〜3 段落入れる (h1 や frontmatter は出力しない、いきなり Markdown 本文から)

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
- Markdown 構造 (見出し、表、箇条書き、リンク) を完全に保つ
- URL (https://mekiki-research.com 等) は変更しない
- 翻訳調にせず、ターゲット言語のネイティブが読んで自然になるようリライト

# 出力 (厳守)
- frontmatter は付けない
- コードフェンス (\`\`\`) で全体を囲まない
- いきなり翻訳後の Markdown 本文から始める

# 入力 (日本語 Markdown)
${jaBody}`;
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
  const trimmedBody = String(body || "").trim();
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
  console.log(`[INFO] 対象日 (JST): ${today}`);
  console.log(`[INFO] 既存記事 base 数: ${recentSlugs.length}`);
  console.log(`[INFO] モデル: ${MODEL}${DRY_RUN ? " (DRY RUN)" : ""}`);

  if (DRY_RUN) {
    console.log("[DRY] meta prompt の長さ:", jaMetaPrompt({ today, recentSlugs }).length);
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log("[INFO] [JA] メタデータ生成中...");
  const jaMeta = await callJson(ai, jaMetaPrompt({ today, recentSlugs }));
  for (const k of ["slug", "title", "description", "tags", "primaryLocation"]) {
    if (!jaMeta[k]) throw new Error(`日本語メタの必須フィールド '${k}' が欠けています`);
  }
  jaMeta.slug = sanitizeSlug(jaMeta.slug);
  if (!jaMeta.slug) throw new Error("生成された slug が無効です");

  const baseName = `${today}-${jaMeta.slug}`;
  console.log(`[INFO] base name: ${baseName}`);
  if (fs.existsSync(path.join(BLOG_DIR, `${baseName}.md`))) {
    throw new Error(`${baseName}.md は既に存在します。生成を中止します。`);
  }

  console.log("[INFO] [JA] 本文 Markdown 生成中...");
  const jaBody = await callText(ai, jaBodyPrompt({ today, meta: jaMeta }));
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
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
