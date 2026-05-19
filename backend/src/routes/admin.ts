import { Hono } from "hono";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
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

/**
 * GET /api/admin/users
 * Firestore `users` コレクションを返す。email は Firebase Auth から補完する。
 */
app.get("/users", async (c) => {
  const LIMIT = 500;
  try {
    const snap = await db.collection("users").limit(LIMIT).get();

    const users = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const uid = doc.id;
        let email: string | null = (data.email as string | undefined) ?? null;
        if (!email) {
          try {
            const userRecord = await admin.auth().getUser(uid);
            email = userRecord.email ?? null;
          } catch {
            // ユーザーが Auth に存在しない（削除済み等）。null のままで OK
          }
        }
        const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
        const planActivatedAt = data.planActivatedAt as admin.firestore.Timestamp | undefined;
        return {
          uid,
          email,
          plan: (data.plan as string | undefined) ?? "free",
          dailySearchCount: (data.dailySearchCount as number | undefined) ?? 0,
          lastSearchDate: (data.lastSearchDate as string | undefined) ?? null,
          createdAt: createdAt ? createdAt.toDate().toISOString() : null,
          planActivatedAt: planActivatedAt ? planActivatedAt.toDate().toISOString() : null,
        };
      })
    );

    // 最終検索日の降順でソート（未設定は末尾）
    users.sort((a, b) => {
      if (!a.lastSearchDate && !b.lastSearchDate) return 0;
      if (!a.lastSearchDate) return 1;
      if (!b.lastSearchDate) return -1;
      return b.lastSearchDate.localeCompare(a.lastSearchDate);
    });

    return c.json({ users, count: users.length });
  } catch (err) {
    console.error("[Admin] users 読み取り失敗:", err);
    return c.json({ error: "Failed to load users" }, 500);
  }
});

/**
 * GET /api/admin/social-posts
 * Firestore `social_posts` コレクションを返す。
 * フィールド: content, status ("pending" | "published" | "error"), scheduledAt または createdAt
 */
app.get("/social-posts", async (c) => {
  const LIMIT = 500;
  try {
    // scheduledAt / createdAt のどちらか一方でソートしたいが、orderBy を厳格にすると
    // フィールド欠落ドキュメントが除外されるため、createdAt でソートする運用にする。
    const snap = await db
      .collection("social_posts")
      .orderBy("createdAt", "desc")
      .limit(LIMIT)
      .get()
      .catch(() => null);

    // コレクション未作成 or インデックス未準備でも 500 を返さないようフォールバック
    const docs = snap ? snap.docs : [];

    const posts = docs.map((doc) => {
      const data = doc.data();
      const scheduledAt = data.scheduledAt as admin.firestore.Timestamp | undefined;
      const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
      const publishedAt = data.publishedAt as admin.firestore.Timestamp | undefined;
      return {
        id: doc.id,
        content: (data.content as string | undefined) ?? "",
        status: (data.status as string | undefined) ?? "pending",
        error: (data.error as string | undefined) ?? null,
        url: (data.url as string | undefined) ?? null,
        scheduledAt: scheduledAt ? scheduledAt.toDate().toISOString() : null,
        createdAt: createdAt ? createdAt.toDate().toISOString() : null,
        publishedAt: publishedAt ? publishedAt.toDate().toISOString() : null,
      };
    });

    return c.json({ posts, count: posts.length });
  } catch (err) {
    console.error("[Admin] social_posts 読み取り失敗:", err);
    return c.json({ error: "Failed to load social posts" }, 500);
  }
});

/**
 * GET /api/admin/x-promotions
 * `backend/data/x_promotions.json`（自動投稿スクリプト post_to_x.js の参照元）を返す。
 * Cloud Run 上では Dockerfile が data/ を /app/data/ にコピーしているので
 * process.cwd() (/app) からの相対で読み取れる。
 */
app.get("/x-promotions", async (c) => {
  const candidates = [
    path.resolve(process.cwd(), "data/x_promotions.json"),
    path.resolve(__dirname, "../../data/x_promotions.json"),
  ];
  let raw: string | null = null;
  for (const p of candidates) {
    try {
      raw = await fs.promises.readFile(p, "utf8");
      break;
    } catch {
      // 次の候補へ
    }
  }
  if (raw === null) {
    console.error("[Admin] x_promotions.json を読み込めませんでした。候補:", candidates);
    return c.json({ error: "x_promotions.json not found" }, 500);
  }
  try {
    const data = JSON.parse(raw) as {
      meta?: Record<string, unknown>;
      tweets?: Array<Record<string, unknown>>;
    };
    return c.json({
      meta: data.meta ?? {},
      tweets: Array.isArray(data.tweets) ? data.tweets : [],
    });
  } catch (err) {
    console.error("[Admin] x_promotions.json のパースに失敗:", err);
    return c.json({ error: "Failed to parse x_promotions.json" }, 500);
  }
});

// ── 編集系エンドポイント ─────────────────────────────────────
// 各 PATCH は許可フィールドのみを受け付ける allowlist 方式。
// クライアントが想定外のキーを送ってきても無視される。

const FEEDBACK_TYPES = new Set(["bug", "feature", "other"]);
const FEEDBACK_STATUSES = new Set(["pending", "reviewed", "done", "wontfix"]);
const USER_PLANS = new Set(["free", "pro"]);
const POST_STATUSES = new Set(["pending", "published", "error"]);

/**
 * PATCH /api/admin/feedbacks/:id
 * 編集可: message, type, status, aiPrompt
 */
app.patch("/feedbacks/:id", async (c) => {
  const id = c.req.param("id");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const update: Record<string, unknown> = {};
  if (typeof body.message === "string") update.message = body.message;
  if (typeof body.type === "string") {
    if (!FEEDBACK_TYPES.has(body.type)) return c.json({ error: "Invalid type" }, 400);
    update.type = body.type;
  }
  if (typeof body.status === "string") {
    if (!FEEDBACK_STATUSES.has(body.status)) return c.json({ error: "Invalid status" }, 400);
    update.status = body.status;
  }
  if (typeof body.aiPrompt === "string" || body.aiPrompt === null) {
    update.aiPrompt = body.aiPrompt;
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: "No editable fields provided" }, 400);
  }

  try {
    const ref = db.collection("feedbacks").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return c.json({ error: "Feedback not found" }, 404);
    await ref.update({ ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return c.json({ ok: true, id });
  } catch (err) {
    console.error("[Admin] feedback 更新失敗:", err);
    return c.json({ error: "Failed to update feedback" }, 500);
  }
});

/**
 * PATCH /api/admin/users/:uid
 * 編集可: plan, dailySearchCount
 */
app.patch("/users/:uid", async (c) => {
  const uid = c.req.param("uid");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const update: Record<string, unknown> = {};
  if (typeof body.plan === "string") {
    if (!USER_PLANS.has(body.plan)) return c.json({ error: "Invalid plan" }, 400);
    update.plan = body.plan;
  }
  if (typeof body.dailySearchCount === "number") {
    if (!Number.isInteger(body.dailySearchCount) || body.dailySearchCount < 0) {
      return c.json({ error: "Invalid dailySearchCount" }, 400);
    }
    update.dailySearchCount = body.dailySearchCount;
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: "No editable fields provided" }, 400);
  }

  try {
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return c.json({ error: "User not found" }, 404);
    await ref.update({ ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return c.json({ ok: true, uid });
  } catch (err) {
    console.error("[Admin] user 更新失敗:", err);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

/**
 * POST /api/admin/social-posts
 * 新しい X 投稿下書きを Firestore に作成する。
 * Body: { content: string, status?: "pending" | "published" | "error", templateId?: number }
 */
app.post("/social-posts", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return c.json({ error: "content is required" }, 400);

  const status = typeof body.status === "string" ? body.status : "pending";
  if (!POST_STATUSES.has(status)) return c.json({ error: "Invalid status" }, 400);

  const doc: Record<string, unknown> = {
    content,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: c.get("adminEmail"),
  };
  if (typeof body.templateId === "number") doc.templateId = body.templateId;
  if (status === "published") {
    doc.publishedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  try {
    const ref = await db.collection("social_posts").add(doc);
    return c.json({ ok: true, id: ref.id }, 201);
  } catch (err) {
    console.error("[Admin] social_post 作成失敗:", err);
    return c.json({ error: "Failed to create social post" }, 500);
  }
});

/**
 * PATCH /api/admin/social-posts/:id
 * 編集可: content, status
 * - status が "published" に切り替わった場合は publishedAt をサーバ時刻でセット
 * - 新規作成は upsert: true で許可（コレクションが存在しない場合の初投稿用）
 */
app.patch("/social-posts/:id", async (c) => {
  const id = c.req.param("id");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const update: Record<string, unknown> = {};
  if (typeof body.content === "string") update.content = body.content;
  if (typeof body.status === "string") {
    if (!POST_STATUSES.has(body.status)) return c.json({ error: "Invalid status" }, 400);
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: "No editable fields provided" }, 400);
  }

  try {
    const ref = db.collection("social_posts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return c.json({ error: "Social post not found" }, 404);

    // published に切り替わったら publishedAt を埋める
    if (update.status === "published" && snap.data()?.status !== "published") {
      update.publishedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.update({ ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return c.json({ ok: true, id });
  } catch (err) {
    console.error("[Admin] social_post 更新失敗:", err);
    return c.json({ error: "Failed to update social post" }, 500);
  }
});

export default app;
