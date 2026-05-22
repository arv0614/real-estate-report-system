#!/usr/bin/env node
/**
 * seed_social_templates.js
 *   `backend/data/x_promotions.json` の tweets を Firestore `social_templates`
 *   コレクションへ一括投入する一時スクリプト。/admin ダッシュボードを
 *   Firestore ベースに切り替えた際の初期データ移行用。
 *
 *   - 重複防止: legacyId を doc id の代わりに保存し、未投入のものだけ追加
 *   - createdAt は元の id 順に降順となるよう、JSON 内 id を使って擬似タイムスタンプ化
 *
 * 使い方:
 *   GCP_PROJECT_ID=realestate-report-2026 node scripts/seed_social_templates.js
 *   (もしくは --dry-run で件数のみ確認)
 */
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error("[ERROR] GCP_PROJECT_ID / FIREBASE_PROJECT_ID が未設定です。");
    process.exit(1);
  }

  const jsonPath = path.resolve(__dirname, "../backend/data/x_promotions.json");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const tweets = Array.isArray(data.tweets) ? data.tweets : [];
  if (!tweets.length) {
    console.error("[ERROR] x_promotions.json に tweets が見つかりません。");
    process.exit(1);
  }
  console.log(`[INFO] 読み込んだテンプレート件数: ${tweets.length}`);

  if (DRY_RUN) {
    console.log("[DRY] --dry-run のため Firestore への書き込みは行いません。");
    return;
  }

  const admin = require("firebase-admin");
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();
  const col = db.collection("social_templates");

  // 既存の legacyId を取得して重複を避ける
  const existingSnap = await col.get();
  const existingLegacyIds = new Set(
    existingSnap.docs.map((d) => d.data().legacyId).filter((v) => v != null),
  );
  console.log(`[INFO] 既存ドキュメント: ${existingSnap.size} (うち legacyId 付き ${existingLegacyIds.size})`);

  // createdAt は元 id を擬似タイムスタンプにする (id 大きいほど新しい)
  // 1970-01-01 + id*1000ms。これにより /admin の createdAt 降順ソートで
  // 元 JSON の id 降順 (新しいもの順) と一致する。
  let added = 0;
  const batch = db.batch();
  for (const tw of tweets) {
    const legacyId = tw.id;
    if (typeof legacyId !== "number") continue;
    if (existingLegacyIds.has(legacyId)) continue;
    const ref = col.doc();
    batch.set(ref, {
      text: String(tw.text || ""),
      type: tw.type ?? null,
      target: tw.target ?? null,
      lang: tw.lang ?? null,
      legacyId,
      source: "seed_x_promotions_json",
      createdAt: admin.firestore.Timestamp.fromMillis(legacyId * 1000),
    });
    added += 1;
  }

  if (added === 0) {
    console.log("[INFO] 追加対象 0 件 (全て既存)。");
    return;
  }

  await batch.commit();
  console.log(`[SUCCESS] ${added} 件を social_templates に追加しました。`);
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
