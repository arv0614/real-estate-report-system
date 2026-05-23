#!/usr/bin/env node
/**
 * sync_blog_social_templates.js
 *   `frontend/content/blog/<YYYY-MM-DD>-<slug>.md` (ja のみ) を走査し、
 *   各記事に対応する X 投稿テンプレートが Firestore `social_templates`
 *   に存在しなければ追加する。
 *
 *   毎日のブログ生成ワークフローから呼び出されるので、過去に書き込みに
 *   失敗した記事もここで追従して補填される ("self-healing" 設計)。
 *
 * 必須環境変数:
 *   GCP_PROJECT_ID / FIREBASE_PROJECT_ID — 書き込み先 Firebase プロジェクト
 *                                          (Firestore は Firebase 側に存在)
 *
 * 任意環境変数:
 *   BLOG_SITE_BASE_URL — テンプレート内 URL のベース。既定: https://mekiki-research.com
 *   BLOG_SYNC_DRY_RUN  — "1" の場合 Firestore への書き込みは行わず計画のみ表示
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const SITE_BASE_URL = (process.env.BLOG_SITE_BASE_URL || "https://mekiki-research.com").replace(/\/$/, "");
const DRY_RUN = process.env.BLOG_SYNC_DRY_RUN === "1";

// frontmatter (--- で囲まれた YAML 風ヘッダ) を素朴にパースする。
// 投稿テンプレート生成に必要なフィールドは title / description / tags のみで、
// すべて1行スカラーまたはフラットな配列 (["a","b"]) なので yaml 依存は不要。
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const fm = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!fm) continue;
    const key = fm[1];
    let val = fm[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((x) => x.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    data[key] = val;
  }
  return data;
}

function listJaBlogPosts() {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(f))
    .sort();
}

// 280 字以内に収める: 説明 + 改行 + URL + 改行 + ハッシュタグ
function buildTweetText({ description, tags, url }) {
  const hashtags = (Array.isArray(tags) ? tags : [])
    .slice(0, 3)
    .map((tag) => "#" + String(tag).replace(/[\s#]/g, ""))
    .join(" ");
  const tail = `👇\n${url}${hashtags ? "\n" + hashtags : ""}`;
  const tailLen = Array.from(tail).length;
  const MAX = 280;
  const allowedDesc = Math.max(0, MAX - tailLen);
  const descChars = Array.from(description || "");
  const trimmedDesc =
    descChars.length <= allowedDesc
      ? description
      : descChars.slice(0, Math.max(0, allowedDesc - 1)).join("") + "…";
  return trimmedDesc + tail;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID / GCP_PROJECT_ID が未設定です。Firestore 書き込みには必須です。");
  }

  const files = listJaBlogPosts();
  if (files.length === 0) {
    console.log("[INFO] frontend/content/blog/ に対象記事が見つかりません。");
    return;
  }
  console.log(`[INFO] ja blog 記事数: ${files.length} (project=${projectId}${DRY_RUN ? ", DRY-RUN" : ""})`);

  const admin = require("firebase-admin");
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();

  // 既存の slug 一覧を一度に取得 (1コレクションスキャン)。
  // 重複挿入は slug をキーに前段で弾く。
  const existingSlugs = new Set();
  const existingSnap = await db.collection("social_templates").get();
  existingSnap.forEach((d) => {
    const slug = d.data().slug;
    if (slug) existingSlugs.add(slug);
  });
  console.log(`[INFO] 既存 social_templates 件数: ${existingSnap.size} (slug ありで管理されている: ${existingSlugs.size})`);

  let inserted = 0;
  let skipped = 0;
  let parseFailed = 0;

  for (const file of files) {
    const baseName = file.replace(/\.md$/, "");
    if (existingSlugs.has(baseName)) {
      skipped++;
      continue;
    }
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
    const meta = parseFrontmatter(raw);
    if (!meta.title || !meta.description) {
      console.warn(`[WARN] frontmatter 不足のためスキップ: ${file}`);
      parseFailed++;
      continue;
    }
    const url = `${SITE_BASE_URL}/blog/${baseName}`;
    const text = buildTweetText({
      description: meta.description,
      tags: meta.tags,
      url,
    });
    if (DRY_RUN) {
      console.log(`[DRY] would insert slug=${baseName} (${Array.from(text).length} chars)`);
      inserted++;
      continue;
    }
    await db.collection("social_templates").add({
      text,
      type: `ブログ記事紹介 — ${meta.title}`,
      target: "不動産ブログ読者",
      lang: "ja",
      slug: baseName,
      url,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "sync_blog_social_templates",
    });
    inserted++;
    console.log(`[INFO] 追加: ${baseName}`);
  }

  console.log(
    `[SUMMARY] inserted=${inserted}, skipped(existing)=${skipped}, parseFailed=${parseFailed}, totalJa=${files.length}`,
  );
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
