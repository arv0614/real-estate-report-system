#!/usr/bin/env node
/**
 * post_to_x.js — marketing/x_promotions.json からランダムに1ツイート選んでXに投稿する
 *
 * 必須環境変数:
 *   X_API_KEY             — API Key (Consumer Key)
 *   X_API_SECRET          — API Key Secret (Consumer Secret)
 *   X_ACCESS_TOKEN        — Access Token
 *   X_ACCESS_TOKEN_SECRET — Access Token Secret
 */

const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

// ─── 環境変数チェック ──────────────────────────────────────────────────────────
if (!DRY_RUN) {
  const required = [
    "X_API_KEY",
    "X_API_SECRET",
    "X_ACCESS_TOKEN",
    "X_ACCESS_TOKEN_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[ERROR] 必須環境変数が未設定です: ${missing.join(", ")}`);
    process.exit(1);
  }
}

// ─── ツイート候補を読み込む ────────────────────────────────────────────────────
const promotionsPath = path.resolve(__dirname, "../backend/data/x_promotions.json");
let promotions;
try {
  promotions = JSON.parse(fs.readFileSync(promotionsPath, "utf8"));
} catch (err) {
  console.error(`[ERROR] x_promotions.json の読み込みに失敗しました: ${err.message}`);
  process.exit(1);
}

const tweets = promotions.tweets;
if (!Array.isArray(tweets) || tweets.length === 0) {
  console.error("[ERROR] ツイート候補が空です");
  process.exit(1);
}

// ─── ランダムに1件選択 ────────────────────────────────────────────────────────
const selected = tweets[Math.floor(Math.random() * tweets.length)];
console.log(`[INFO] 選択されたツイート: id=${selected.id} type="${selected.type}"`);

// ─── 重複投稿対策 (X API は同一テキスト連投で 403 Forbidden) ─────────────────
// 末尾に JST タイムスタンプ ` [YYYY/MM/DD HH:MM]` を付与する。
// 280 字制限を超える場合は本文を末尾省略 (…) して必ずスタンプを残す。
function jstTimestampSuffix() {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60_000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return ` [${y}/${m}/${d} ${hh}:${mm}]`;
}

function appendTimestamp(text) {
  const suffix = jstTimestampSuffix();
  const MAX = 280; // X / Twitter v2 の最大文字数
  const chars = Array.from(text);
  if (chars.length + Array.from(suffix).length <= MAX) {
    return text + suffix;
  }
  const allowed = MAX - Array.from(suffix).length - 1; // 1 = 省略記号
  return chars.slice(0, allowed).join("") + "…" + suffix;
}

const finalText = appendTimestamp(selected.text);
console.log(`[INFO] 投稿テキスト:\n${finalText}\n`);

if (DRY_RUN) {
  console.log("[DRY] --dry-run 指定のため投稿はスキップします");
  process.exit(0);
}

// ─── X API クライアント初期化 ─────────────────────────────────────────────────
const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

// ─── 投稿実行 ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    const response = await client.v2.tweet(finalText);
    console.log(`[SUCCESS] ツイートを投稿しました。tweet_id=${response.data.id}`);
  } catch (err) {
    console.error(`[ERROR] 投稿に失敗しました: ${err.message}`);
    if (err.data) {
      console.error("[ERROR] API レスポンス:", JSON.stringify(err.data, null, 2));
    }
    process.exit(1);
  }
})();
