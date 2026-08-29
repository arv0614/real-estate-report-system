import * as admin from "firebase-admin";
import { config } from "../config";
import { MCP_TEST_UID, type McpUser } from "./mcpAuth";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

/** "YYYY-MM-DD"（UTC）。Web版 frontend/lib/userPlan.ts の getTodayString と同形式。 */
function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface McpUsageResult {
  /** ツール実行を許可してよいか */
  allowed: boolean;
  /** 本日の消費回数（インクリメント後。ブロック時は現在値） */
  used: number;
  /** 適用された上限（Pro は Infinity） */
  limit: number;
  plan: string;
}

export interface McpQuotaDecision {
  allowed: boolean;
  /** Firestore に書き込むべき新カウント（ブロック時は current のまま） */
  nextCount: number;
  /** 適用上限（Pro は Infinity） */
  limit: number;
}

/**
 * 現在の消費数・プラン・上限から実行可否を判定する純粋関数（Firestore 非依存＝単体テスト可能）。
 * - Pro: 常に許可・無制限
 * - Free: current < limit のときのみ許可し +1、到達済みならブロック（カウント据え置き）
 */
export function decideMcpQuota(
  current: number,
  plan: string,
  limit: number
): McpQuotaDecision {
  if (plan === "pro") {
    return { allowed: true, nextCount: current + 1, limit: Infinity };
  }
  if (current >= limit) {
    return { allowed: false, nextCount: current, limit };
  }
  return { allowed: true, nextCount: current + 1, limit };
}

/**
 * MCP 経由のツール呼び出し回数を Firestore（users/{uid}）で日次カウントし、上限を判定する。
 *
 * - Pro プラン: 無制限。カウントは記録するがブロックしない。
 * - Free プラン: `limit`（= Web版無料上限 × 10、呼び出し側で計算）に達したら allowed=false。
 * - Firestore エラー時は fail-open（allowed=true）。障害で外部連携が全断するのを避ける。
 * - 開発用モックユーザー（MCP_TEST_UID）は Firestore を持たないため常に許可。
 *
 * users/{uid}.mcpDailyCount / mcpLastCallDate を日付境界でリセットしながらトランザクション更新する。
 * バックエンド（firebase-admin）からの書き込みのため Firestore セキュリティルールはバイパスされる。
 */
export async function checkAndIncrementMcpUsage(
  user: McpUser,
  limit: number
): Promise<McpUsageResult> {
  if (user.uid === MCP_TEST_UID) {
    return { allowed: true, used: 0, limit, plan: user.plan };
  }

  const today = todayString();
  const ref = db.collection("users").doc(user.uid);

  try {
    return await db.runTransaction<McpUsageResult>(async (tx) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as {
        mcpDailyCount?: number;
        mcpLastCallDate?: string;
      };
      const current =
        data.mcpLastCallDate === today ? data.mcpDailyCount ?? 0 : 0;

      const decision = decideMcpQuota(current, user.plan, limit);
      if (decision.allowed) {
        tx.set(
          ref,
          {
            mcpDailyCount: decision.nextCount,
            mcpLastCallDate: today,
            // 登録以来の累積カウント（Pro / Free 問わず加算）
            mcpTotalCount: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        );
      }
      return {
        allowed: decision.allowed,
        used: decision.nextCount,
        limit: decision.limit,
        plan: user.plan,
      };
    });
  } catch (err) {
    console.error(
      "[MCP] usage transaction failed — allowing call (fail-open):",
      err instanceof Error ? err.message : err
    );
    return { allowed: true, used: 0, limit, plan: user.plan };
  }
}
