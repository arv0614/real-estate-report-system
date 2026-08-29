import { Hono } from "hono";
import * as admin from "firebase-admin";
import { config } from "../config";
import { verifyFirebaseUid } from "../services/mcpAuth";
import { FREE_DAILY_LIMIT, MCP_FREE_DAILY_LIMIT } from "../constants/limits";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

const app = new Hono();

/** "YYYY-MM-DD"（UTC）。frontend/lib/userPlan.ts の getTodayString と同形式。 */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface UsageChannel {
  /** 本日の消費回数 */
  used: number;
  /** プラン上限（Pro は unlimited=true のとき参考値） */
  limit: number;
  /** 無制限か（Pro プラン） */
  unlimited: boolean;
  /** 残り回数（unlimited のときは null） */
  remaining: number | null;
}

export interface UsageResponse {
  plan: "free" | "pro";
  date: string;
  web: UsageChannel;
  mcp: UsageChannel;
}

/** users/{uid} ドキュメントのうち利用回数に関係するフィールド */
export interface UserUsageDoc {
  plan?: string;
  dailySearchCount?: number;
  lastSearchDate?: string;
  mcpDailyCount?: number;
  mcpLastCallDate?: string;
}

function buildChannel(used: number, limit: number, unlimited: boolean): UsageChannel {
  return {
    used,
    limit,
    unlimited,
    remaining: unlimited ? null : Math.max(0, limit - used),
  };
}

/**
 * Firestore ドキュメントと当日日付から利用状況レスポンスを組み立てる純粋関数（テスト可能）。
 * 日付が変わっていたら消費回数は 0 とみなす。Pro プランは unlimited=true。
 */
export function computeUsage(data: UserUsageDoc, today: string): UsageResponse {
  const plan: "free" | "pro" = data.plan === "pro" ? "pro" : "free";
  const isPro = plan === "pro";

  const webUsed = data.lastSearchDate === today ? data.dailySearchCount ?? 0 : 0;
  const mcpUsed = data.mcpLastCallDate === today ? data.mcpDailyCount ?? 0 : 0;

  return {
    plan,
    date: today,
    web: buildChannel(webUsed, FREE_DAILY_LIMIT, isPro),
    mcp: buildChannel(mcpUsed, MCP_FREE_DAILY_LIMIT, isPro),
  };
}

/**
 * GET /api/user/usage
 * 認証: Authorization: Bearer <Firebase ID Token>
 *
 * ログインユーザーの「本日の利用回数」を Web / MCP それぞれについて返す。
 * - Web:  users/{uid}.dailySearchCount / lastSearchDate
 * - MCP:  users/{uid}.mcpDailyCount    / mcpLastCallDate
 * 上限は Free = FREE_DAILY_LIMIT、MCP = その ×10。Pro は unlimited=true。
 */
app.get("/usage", async (c) => {
  const auth = await verifyFirebaseUid(c.req.header("authorization"));
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  try {
    const snap = await db.collection("users").doc(auth.uid).get();
    const data = (snap.exists ? snap.data() : {}) as UserUsageDoc;
    return c.json(computeUsage(data, todayString()));
  } catch (err) {
    console.error("[User] usage 取得失敗:", err instanceof Error ? err.message : err);
    return c.json({ error: "Failed to load usage" }, 500);
  }
});

export default app;
