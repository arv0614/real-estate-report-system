import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { config } from "../config";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

/**
 * MCP 接続を許可するプラン。
 * ミッション要件により Free / Pro のみ許可し、それ以外（未知プラン・停止中など）は 403。
 */
export const MCP_ALLOWED_PLANS = new Set<string>(["free", "pro"]);

/** 発行する APIキーの接頭辞（Mekiki Research live key） */
const API_KEY_PREFIX = "mkr_live_";

/**
 * 開発環境専用のモックユーザー uid（MCP_TEST_API_KEY 経由でのみ発生）。
 * Firestore を持たないため、利用回数チェック等ではこの uid をスキップする。
 */
export const MCP_TEST_UID = "mcp-test-uid";

export interface McpUser {
  uid: string;
  email: string | null;
  plan: string;
}

/** SHA-256 でキーをハッシュ化（Firestore には平文を保存しない） */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** 新しい APIキーを生成する。戻り値の key は一度きりの平文。 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const secret = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const key = `${API_KEY_PREFIX}${secret}`;
  return {
    key,
    hash: hashApiKey(key),
    // 表示・識別用の短い接頭辞（例: mkr_live_ab12cd）。平文の復元には使えない。
    prefix: key.slice(0, API_KEY_PREFIX.length + 6),
  };
}

type IssueResult =
  | { ok: true; apiKey: string; prefix: string }
  | { ok: false; status: 403 | 404; message: string };

/**
 * users/{uid} に MCP APIキーを発行（ローテーション）して保存する。
 * 保存するのはハッシュと接頭辞のみ。平文キーは戻り値でのみ返す。
 */
export async function issueApiKeyForUid(uid: string): Promise<IssueResult> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, message: "User not found" };

  const plan = (snap.data()?.plan as string | undefined) ?? "free";
  if (!MCP_ALLOWED_PLANS.has(plan)) {
    return { ok: false, status: 403, message: `Plan "${plan}" is not eligible for MCP access` };
  }

  const { key, hash, prefix } = generateApiKey();
  await ref.update({
    mcpApiKeyHash: hash,
    mcpApiKeyPrefix: prefix,
    mcpApiKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, apiKey: key, prefix };
}

/** users/{uid} の MCP APIキーを失効させる */
export async function revokeApiKeyForUid(uid: string): Promise<void> {
  await db.collection("users").doc(uid).update({
    mcpApiKeyHash: admin.firestore.FieldValue.delete(),
    mcpApiKeyPrefix: admin.firestore.FieldValue.delete(),
    mcpApiKeyCreatedAt: admin.firestore.FieldValue.delete(),
  });
}

export type McpAuthResult =
  | { ok: true; user: McpUser }
  | { ok: false; status: 401 | 403; message: string };

/**
 * `Authorization: Bearer <API_KEY>` を検証し、Firestore 上のユーザーと照合する。
 *
 * - ヘッダ欠落・不正形式・未知キー → 401
 * - プランが Free / Pro 以外 → 403
 * - 開発環境では MCP_TEST_API_KEY と一致した場合のみ Free ユーザーとして扱う（本番では無効）
 */
export async function authenticateMcpRequest(
  authHeader: string | undefined
): Promise<McpAuthResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: API key required (Authorization: Bearer <API_KEY>)",
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    return { ok: false, status: 401, message: "Unauthorized: malformed API key" };
  }

  // ── テスト用モックキー（本番環境では常に無効） ──────────────
  const testKey = process.env.MCP_TEST_API_KEY;
  if (config.nodeEnv !== "production" && testKey && token === testKey) {
    return { ok: true, user: { uid: MCP_TEST_UID, email: "mcp-test@example.com", plan: "free" } };
  }

  const hash = hashApiKey(token);
  let snap: admin.firestore.QuerySnapshot;
  try {
    snap = await db
      .collection("users")
      .where("mcpApiKeyHash", "==", hash)
      .limit(1)
      .get();
  } catch (err) {
    console.error("[MCP] Firestore key lookup failed:", err instanceof Error ? err.message : err);
    return { ok: false, status: 401, message: "Unauthorized: key verification failed" };
  }

  if (snap.empty) {
    return { ok: false, status: 401, message: "Unauthorized: invalid API key" };
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const plan = (data.plan as string | undefined) ?? "free";
  if (!MCP_ALLOWED_PLANS.has(plan)) {
    return {
      ok: false,
      status: 403,
      message: `Forbidden: plan "${plan}" is not eligible for MCP access`,
    };
  }

  return {
    ok: true,
    user: { uid: doc.id, email: (data.email as string | undefined) ?? null, plan },
  };
}

export type FirebaseUidResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401; message: string };

/**
 * `Authorization: Bearer <Firebase ID Token>` を検証して uid を返す。
 * APIキー発行エンドポイント（ログイン済みユーザー向け）で使用する。
 */
export async function verifyFirebaseUid(authHeader: string | undefined): Promise<FirebaseUidResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Unauthorized: Firebase auth required" };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    return { ok: true, uid: decoded.uid };
  } catch (err) {
    console.warn("[MCP] ID token verification failed:", err instanceof Error ? err.message : err);
    return { ok: false, status: 401, message: "Unauthorized: Invalid or expired token" };
  }
}
