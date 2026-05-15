import { Hono } from "hono";
import * as admin from "firebase-admin";
import { config, isAdminEmail } from "../config";

// ── Firebase Admin 初期化（冪等） ─────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.firebase.projectId || undefined });
}
const db = admin.firestore();

type AdminContext = {
  Variables: {
    adminUid: string;
    adminEmail: string;
  };
};

const app = new Hono<AdminContext>();

/**
 * 管理者ミドルウェア
 * 1. Authorization: Bearer <Firebase ID Token> を検証
 * 2. decodedToken.email が ADMIN_EMAILS に含まれるか確認
 * 3. 通過すれば c.set("adminUid"/"adminEmail") を埋めて next() を呼ぶ
 */
app.use("*", async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Firebase auth required" }, 401);
  }
  const idToken = authHeader.slice(7);

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    const e = err as { code?: string; message?: string; errorInfo?: { code?: string; message?: string } };
    console.error("[Admin] ID token verification failed", {
      code: e.code ?? e.errorInfo?.code ?? null,
      message: e.message ?? e.errorInfo?.message ?? String(err),
    });
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  if (!isAdminEmail(decoded.email)) {
    console.warn(`[Admin] 管理者外アクセス: uid=${decoded.uid}, email=${decoded.email ?? "(none)"}`);
    return c.json({ error: "Forbidden: Admin privileges required" }, 403);
  }

  c.set("adminUid", decoded.uid);
  c.set("adminEmail", decoded.email ?? "");
  await next();
});

/**
 * GET /api/admin/feedbacks
 * Firestore `feedbacks` コレクションを createdAt 降順で全件返す。
 * MVPなのでページングは省略、上限のみ設ける。
 */
app.get("/feedbacks", async (c) => {
  const LIMIT = 500;
  try {
    const snap = await db
      .collection("feedbacks")
      .orderBy("createdAt", "desc")
      .limit(LIMIT)
      .get();

    const feedbacks = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
      return {
        id: doc.id,
        uid: (data.uid as string | undefined) ?? null,
        email: (data.email as string | undefined) ?? null,
        type: (data.type as string | undefined) ?? null,
        message: (data.message as string | undefined) ?? "",
        aiPrompt: (data.aiPrompt as string | null | undefined) ?? null,
        aiError: (data.aiError as string | null | undefined) ?? null,
        status: (data.status as string | undefined) ?? null,
        createdAt: createdAt ? createdAt.toDate().toISOString() : null,
      };
    });

    return c.json({ feedbacks, count: feedbacks.length });
  } catch (err) {
    console.error("[Admin] Firestore 読み取り失敗:", err);
    return c.json({ error: "Failed to load feedbacks" }, 500);
  }
});

export default app;
