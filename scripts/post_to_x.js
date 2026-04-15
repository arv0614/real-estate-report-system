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

// ─── 環境変数チェック ──────────────────────────────────────────────────────────
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

// ─── ツイート候補を読み込む ────────────────────────────────────────────────────
const promotionsPath = path.resolve(__dirname, "../marketing/x_promotions.json");
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
console.log(`[INFO] 投稿テキスト:\n${selected.text}\n`);

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
    const response = await client.v2.tweet(selected.text);
    console.log(`[SUCCESS] ツイートを投稿しました。tweet_id=${response.data.id}`);
  } catch (err) {
    console.error(`[ERROR] 投稿に失敗しました: ${err.message}`);
    if (err.data) {
      console.error("[ERROR] API レスポンス:", JSON.stringify(err.data, null, 2));
    }
    process.exit(1);
  }
})();
