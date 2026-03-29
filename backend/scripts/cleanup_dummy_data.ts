/**
 * cleanup_dummy_data.ts
 *
 * Playwrightによるダミートラフィック生成後に実行するクリーンアップスクリプト。
 * PostHog 側のイベントデータ（分析用）は削除しない。
 *
 * 削除対象:
 *   1. Firestore `waitlist` コレクション内の dummy_test_ 含むメールドキュメント
 *   2. Firestore `users/{uid}/search_history` 内のダミーユーザー履歴（対象なし想定）
 *   3. GCS キャッシュ: 過去 N 時間以内に作成されたキャッシュファイル（オプション）
 *
 * 実行コマンド（backend ディレクトリから）:
 *   npx tsx scripts/cleanup_dummy_data.ts
 *   GCS_CLEANUP=true npx tsx scripts/cleanup_dummy_data.ts  # GCSも削除
 */

import * as path from "path";
import * as dotenv from "dotenv";

// .env をルートから読み込む
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";

// ──────────────────────────────────────────────
// 設定
// ──────────────────────────────────────────────

/** ダミーメールアドレスの識別子プレフィックス */
const DUMMY_EMAIL_PATTERN = "dummy_test_";

/** GCS クリーンアップを行うかどうか（明示的に有効化が必要） */
const GCS_CLEANUP_ENABLED = process.env.GCS_CLEANUP === "true";

/**
 * GCS クリーンアップ対象: 現在から何時間前までに作成されたファイルを削除するか
 * デフォルト 2 時間
 */
const GCS_CLEANUP_HOURS = parseInt(process.env.GCS_CLEANUP_HOURS ?? "2", 10);

const GCS_BUCKET = process.env.GCS_CACHE_BUCKET ?? "";
const GCP_PROJECT = process.env.GCP_PROJECT_ID ?? "";
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID ?? GCP_PROJECT;

// ──────────────────────────────────────────────
// Firebase Admin 初期化
// ──────────────────────────────────────────────

function initFirebase() {
  if (getApps().length > 0) return;
  // Application Default Credentials を使用（gcloud auth application-default login 済みであること）
  initializeApp({ projectId: FIREBASE_PROJECT });
}

// ──────────────────────────────────────────────
// 1. Firestore waitlist クリーンアップ
// ──────────────────────────────────────────────

async function cleanupWaitlist(): Promise<number> {
  const db = getFirestore();
  const snapshot = await db.collection("waitlist").get();

  const targets: string[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email: string = data.email ?? doc.id;
    if (email.includes(DUMMY_EMAIL_PATTERN) || doc.id.includes(DUMMY_EMAIL_PATTERN.replace(/_/g, "_"))) {
      targets.push(doc.id);
    }
  }

  if (targets.length === 0) {
    console.log("  waitlist: 削除対象なし");
    return 0;
  }

  // バッチ削除（Firestore は 1バッチ最大 500 件）
  const BATCH_SIZE = 400;
  let deleted = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + BATCH_SIZE);
    for (const docId of chunk) {
      batch.delete(db.collection("waitlist").doc(docId));
      console.log(`  → 削除: waitlist/${docId}`);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

// ──────────────────────────────────────────────
// 2. GCS キャッシュクリーンアップ（オプション）
// ──────────────────────────────────────────────

async function cleanupGcsCache(): Promise<number> {
  if (!GCS_BUCKET) {
    console.log("  GCS: GCS_CACHE_BUCKET が未設定のためスキップ");
    return 0;
  }

  const storage = new Storage({ projectId: GCP_PROJECT });
  const bucket = storage.bucket(GCS_BUCKET);

  const cutoff = new Date(Date.now() - GCS_CLEANUP_HOURS * 60 * 60 * 1000);
  console.log(`  GCS: ${cutoff.toISOString()} 以降に作成されたキャッシュを削除対象にします`);

  // cache/ プレフィックスのファイル一覧を取得
  const [files] = await bucket.getFiles({ prefix: "cache/" });

  const targets: string[] = [];
  for (const file of files) {
    const metadata = file.metadata;
    const created = metadata.timeCreated
      ? new Date(metadata.timeCreated)
      : metadata.updated
      ? new Date(metadata.updated)
      : null;

    if (created && created >= cutoff) {
      targets.push(file.name);
    }
  }

  if (targets.length === 0) {
    console.log(`  GCS: 削除対象なし（${files.length} ファイル確認済み）`);
    return 0;
  }

  console.log(`  GCS: ${targets.length} ファイルを削除します`);
  for (const name of targets) {
    await bucket.file(name).delete();
    console.log(`  → 削除: gs://${GCS_BUCKET}/${name}`);
  }

  return targets.length;
}

// ──────────────────────────────────────────────
// エントリポイント
// ──────────────────────────────────────────────

async function main() {
  console.log("===========================================");
  console.log("🧹 ダミーデータ クリーンアップ開始");
  console.log("===========================================");
  console.log(`Firebase プロジェクト : ${FIREBASE_PROJECT}`);
  console.log(`GCS クリーンアップ   : ${GCS_CLEANUP_ENABLED ? `有効 (過去${GCS_CLEANUP_HOURS}時間)` : "無効"}`);
  console.log();

  initFirebase();

  // ── 1. Firestore waitlist ──
  console.log("📋 [1/2] Firestore waitlist のクリーンアップ...");
  const waitlistDeleted = await cleanupWaitlist();
  console.log(`  完了: ${waitlistDeleted} 件削除`);
  console.log();

  // ── 2. GCS キャッシュ（オプション） ──
  let gcsDeleted = 0;
  if (GCS_CLEANUP_ENABLED) {
    console.log(`☁️  [2/2] GCS キャッシュのクリーンアップ (gs://${GCS_BUCKET}/cache/)...`);
    gcsDeleted = await cleanupGcsCache();
    console.log(`  完了: ${gcsDeleted} ファイル削除`);
  } else {
    console.log("☁️  [2/2] GCS クリーンアップ: スキップ（GCS_CLEANUP=true で有効化）");
  }

  console.log();
  console.log("===========================================");
  console.log("✅ クリーンアップ完了");
  console.log(`   waitlist 削除: ${waitlistDeleted} 件`);
  console.log(`   GCS 削除     : ${gcsDeleted} ファイル`);
  console.log("===========================================");
}

main().catch((err) => {
  console.error("❌ クリーンアップ失敗:", err);
  process.exit(1);
});
