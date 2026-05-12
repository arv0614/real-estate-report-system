#!/usr/bin/env node
/**
 * strip_markdown_bold.js — frontend/content/blog/ 配下の全 .md ファイルから
 * 強調記号 `**` と `__` を完全に削除（空文字に置換）して上書き保存する。
 *
 * 設計メモ:
 *   - AI 生成のブログ記事に意図しない強調記号が混入する問題への対応。
 *   - `**` と `__` の文字列出現を単純に全置換する。
 *   - frontmatter（--- で囲まれた YAML 部分）にこれらの記号が構造として
 *     使われることはないので、ファイル全体に対して安全に grep 置換可能。
 *   - 画像 `![alt](url)` やリンク `[text](url)` は `*` や `_` を構造として
 *     使わないため、副作用なく置換できる。
 *
 * 使い方:
 *   node scripts/strip_markdown_bold.js
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");

function stripBold(text) {
  return String(text).replace(/\*\*/g, "").replace(/__/g, "");
}

function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`[ERROR] ブログディレクトリが存在しません: ${BLOG_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  console.log(`[INFO] 対象ディレクトリ: ${BLOG_DIR}`);
  console.log(`[INFO] 対象 .md ファイル数: ${files.length}`);

  let modified = 0;
  let skipped = 0;
  let totalStarStar = 0;
  let totalUnderscore = 0;

  for (const file of files) {
    const target = path.join(BLOG_DIR, file);
    const original = fs.readFileSync(target, "utf8");
    const starStarCount = (original.match(/\*\*/g) || []).length;
    const underscoreCount = (original.match(/__/g) || []).length;
    if (starStarCount === 0 && underscoreCount === 0) {
      skipped += 1;
      continue;
    }
    const stripped = stripBold(original);
    if (stripped === original) {
      skipped += 1;
      continue;
    }
    fs.writeFileSync(target, stripped, "utf8");
    modified += 1;
    totalStarStar += starStarCount;
    totalUnderscore += underscoreCount;
    console.log(
      `[FIX] ${file}  ** x${starStarCount}, __ x${underscoreCount}`,
    );
  }

  console.log("");
  console.log(`[DONE] 修正済み: ${modified} ファイル / 変更なし: ${skipped} ファイル`);
  console.log(`[DONE] 除去した ** の累計: ${totalStarStar}`);
  console.log(`[DONE] 除去した __ の累計: ${totalUnderscore}`);
}

main();
