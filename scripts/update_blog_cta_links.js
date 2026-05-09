#!/usr/bin/env node
/**
 * update_blog_cta_links.js — 既存ブログ記事の本文中CTAリンクを
 * 動的ルーティング形式 (https://mekiki-research.com/?lat=&lng=) に一括置換する
 * 一回限りのメンテナンススクリプト。
 *
 * 仕様:
 *   1. frontend/content/blog/ 配下の *.md (ja/en/zh-TW/zh-CN 全て) を走査
 *   2. 各ファイルの frontmatter から primaryLocation.lat / lng を抽出
 *   3. 本文中 (frontmatter 外) の "bare" な https://mekiki-research.com URL を
 *      `https://mekiki-research.com/?lat=<lat>&lng=<lng>` に置換
 *      - bare とは: URL 直後が path 文字 / クエリ / 英数字でないもの
 *        例) (https://mekiki-research.com)        → 置換対象
 *            https://mekiki-research.com](...     → 置換対象
 *            https://mekiki-research.com/blog     → 置換しない (path 続く)
 *            https://mekiki-research.com?foo=bar  → 置換しない (query 続く)
 *            https://mekiki-research.com/?lat=... → 置換しない (二重付与防止)
 *   4. 置換が発生したファイルのみ書き戻し
 *   5. サマリー (走査・置換・skip 件数) を stdout に出力
 *
 * 使い方:
 *   node scripts/update_blog_cta_links.js          # 実行
 *   node scripts/update_blog_cta_links.js --dry    # ドライラン (書き込まない)
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const DRY_RUN = process.argv.includes("--dry");

// "bare" な mekiki-research.com URL を抽出するパターン
// 末尾の / は任意。直後が [a-zA-Z0-9/?] なら除外 (path/query が続く)。
const BARE_URL_RE = /https:\/\/mekiki-research\.com\/?(?![a-zA-Z0-9?/])/g;

function parseFrontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { frontmatter: "", body: text, end: 0 };
  }
  // 終端の "---" を探す (frontmatter の外側)
  const lines = text.split(/\r?\n/);
  let endLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) {
    return { frontmatter: "", body: text, end: 0 };
  }
  const frontmatter = lines.slice(1, endLine).join("\n");
  const body = lines.slice(endLine + 1).join("\n");
  return { frontmatter, body, end: endLine };
}

function extractPrimaryLocation(frontmatter) {
  // primaryLocation:
  //   lat: 42.8225
  //   lng: 141.6522
  //   name: "..."
  const block = frontmatter.match(/^primaryLocation:\s*\n((?: {2,}.+\n?)+)/m);
  if (!block) return null;
  const inner = block[1];
  const latM = inner.match(/^\s+lat:\s*(-?\d+(?:\.\d+)?)/m);
  const lngM = inner.match(/^\s+lng:\s*(-?\d+(?:\.\d+)?)/m);
  if (!latM || !lngM) return null;
  const lat = Number(latM[1]);
  const lng = Number(lngM[1]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

function processFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(text);

  if (!frontmatter) {
    return { status: "skip", reason: "no-frontmatter", replacements: 0 };
  }
  const loc = extractPrimaryLocation(frontmatter);
  if (!loc) {
    return { status: "skip", reason: "no-primaryLocation", replacements: 0 };
  }

  const newUrl = `https://mekiki-research.com/?lat=${loc.lat}&lng=${loc.lng}`;

  let replacements = 0;
  const newBody = body.replace(BARE_URL_RE, () => {
    replacements += 1;
    return newUrl;
  });

  if (replacements === 0) {
    return { status: "no-match", replacements: 0 };
  }

  // 再構築: 元の "---\n<frontmatter>\n---\n" を保持
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const rebuilt = `---${eol}${frontmatter}${eol}---${eol}${newBody}`;

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, rebuilt, "utf8");
  }

  return { status: "updated", replacements, newUrl };
}

function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`[ERROR] ブログディレクトリが存在しません: ${BLOG_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(BLOG_DIR, f))
    .sort();

  console.log(`[INFO] 対象ディレクトリ: ${BLOG_DIR}`);
  console.log(`[INFO] 走査ファイル数: ${files.length}`);
  if (DRY_RUN) console.log(`[INFO] DRY RUN モード — ファイルは書き戻しません`);

  let totalUpdated = 0;
  let totalReplacements = 0;
  let totalNoMatch = 0;
  const skipped = [];

  for (const file of files) {
    const r = processFile(file);
    const name = path.basename(file);
    if (r.status === "updated") {
      totalUpdated += 1;
      totalReplacements += r.replacements;
      console.log(`  [OK] ${name}: ${r.replacements} 箇所 → ${r.newUrl}`);
    } else if (r.status === "no-match") {
      totalNoMatch += 1;
    } else if (r.status === "skip") {
      skipped.push({ name, reason: r.reason });
    }
  }

  console.log("\n========================================");
  console.log(`走査:           ${files.length} ファイル`);
  console.log(`置換実施:       ${totalUpdated} ファイル / ${totalReplacements} リンク`);
  console.log(`置換対象なし:   ${totalNoMatch} ファイル`);
  console.log(`スキップ:       ${skipped.length} ファイル`);
  for (const s of skipped) {
    console.log(`  - ${s.name} (${s.reason})`);
  }
  if (DRY_RUN) console.log("\n※ DRY RUN のためファイルは変更されていません");
}

main();
