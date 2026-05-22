"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { getApiBase } from "@/lib/api";

type FeedbackItem = {
  id: string;
  uid: string | null;
  email: string | null;
  type: string | null;
  message: string;
  aiPrompt: string | null;
  aiError: string | null;
  status: string | null;
  createdAt: string | null;
};

type UserItem = {
  uid: string;
  email: string | null;
  plan: string;
  dailySearchCount: number;
  lastSearchDate: string | null;
  createdAt: string | null;
  planActivatedAt: string | null;
};

type SocialPostItem = {
  id: string;
  content: string;
  status: string;
  error: string | null;
  url: string | null;
  scheduledAt: string | null;
  createdAt: string | null;
  publishedAt: string | null;
};

type PromotionTemplate = {
  id: string;
  type?: string | null;
  target?: string | null;
  lang?: string | null;
  slug?: string | null;
  text: string;
  createdAt?: string | null;
};

type TemplatesPage = {
  items: PromotionTemplate[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type TemplatesState =
  | { kind: "loading" }
  | { kind: "ok"; page: TemplatesPage }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

const TEMPLATES_PAGE_SIZE = 10;

type TabKey = "feedbacks" | "users" | "social";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

const FEEDBACK_TYPE_OPTIONS = ["bug", "feature", "other"] as const;
const FEEDBACK_STATUS_OPTIONS = ["pending", "reviewed", "done", "wontfix"] as const;
const USER_PLAN_OPTIONS = ["free", "pro"] as const;
const POST_STATUS_OPTIONS = ["pending", "published", "error"] as const;

async function fetchAdmin<T>(path: string, key: string): Promise<LoadState<T>> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return { kind: "forbidden" };
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { kind: "forbidden" };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { kind: "error", message: `${res.status} ${body}` };
    }
    const data = (await res.json()) as Record<string, T[]>;
    return { kind: "ok", items: data[key] ?? [] };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

async function patchAdmin(path: string, payload: Record<string, unknown>): Promise<string | null> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return "Not authenticated";
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return `${res.status} ${body}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function postAdmin<T = unknown>(
  path: string,
  payload: Record<string, unknown>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${body}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default function AdminClient() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<TabKey>("feedbacks");
  const [feedbackState, setFeedbackState] = useState<LoadState<FeedbackItem>>({ kind: "loading" });
  const [usersState, setUsersState] = useState<LoadState<UserItem>>({ kind: "loading" });
  const [postsState, setPostsState] = useState<LoadState<SocialPostItem>>({ kind: "loading" });
  const [templatesState, setTemplatesState] = useState<TemplatesState>({ kind: "loading" });
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesSearch, setTemplatesSearch] = useState("");

  const loadFeedbacks = useCallback(async () => {
    setFeedbackState({ kind: "loading" });
    setFeedbackState(await fetchAdmin<FeedbackItem>("/api/admin/feedbacks", "feedbacks"));
  }, []);
  const loadUsers = useCallback(async () => {
    setUsersState({ kind: "loading" });
    setUsersState(await fetchAdmin<UserItem>("/api/admin/users", "users"));
  }, []);
  const loadPosts = useCallback(async () => {
    setPostsState({ kind: "loading" });
    setPostsState(await fetchAdmin<SocialPostItem>("/api/admin/social-posts", "posts"));
  }, []);
  const loadTemplates = useCallback(async (page: number, search: string) => {
    setTemplatesState({ kind: "loading" });
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) {
      setTemplatesState({ kind: "forbidden" });
      return;
    }
    const params = new URLSearchParams({
      page: String(page),
      limit: String(TEMPLATES_PAGE_SIZE),
    });
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`${getApiBase()}/api/admin/x-promotions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setTemplatesState({ kind: "forbidden" });
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setTemplatesState({ kind: "error", message: `${res.status} ${body}` });
        return;
      }
      const data = (await res.json()) as {
        tweets: PromotionTemplate[];
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      };
      setTemplatesState({
        kind: "ok",
        page: {
          items: data.tweets ?? [],
          page: data.page ?? page,
          limit: data.limit ?? TEMPLATES_PAGE_SIZE,
          totalCount: data.totalCount ?? 0,
          totalPages: data.totalPages ?? 1,
        },
      });
    } catch (err) {
      setTemplatesState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    loadFeedbacks();
  }, [authLoading, user, loadFeedbacks, router]);

  useEffect(() => {
    if (!user) return;
    if (tab === "users" && usersState.kind === "loading") loadUsers();
    if (tab === "social" && postsState.kind === "loading") loadPosts();
  }, [tab, user, usersState.kind, postsState.kind, loadUsers, loadPosts]);

  // テンプレートはページ/検索が変わったときに再取得（デバウンス）
  useEffect(() => {
    if (!user) return;
    if (tab !== "social") return;
    const handle = setTimeout(() => {
      loadTemplates(templatesPage, templatesSearch);
    }, 250);
    return () => clearTimeout(handle);
  }, [tab, user, templatesPage, templatesSearch, loadTemplates]);

  const refresh = () => {
    if (tab === "feedbacks") loadFeedbacks();
    else if (tab === "users") loadUsers();
    else {
      loadPosts();
      loadTemplates(templatesPage, templatesSearch);
    }
  };

  // 下書き作成（テンプレートから） → 投稿履歴の先頭に挿入する
  const prependPost = (post: SocialPostItem) => {
    setPostsState((s) =>
      s.kind === "ok" ? { kind: "ok", items: [post, ...s.items] } : { kind: "ok", items: [post] }
    );
  };

  // 保存後に親 state を更新するためのコールバック
  const patchFeedback = (id: string, patch: Partial<FeedbackItem>) => {
    setFeedbackState((s) =>
      s.kind === "ok"
        ? { kind: "ok", items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
        : s
    );
  };
  const patchUser = (uid: string, patch: Partial<UserItem>) => {
    setUsersState((s) =>
      s.kind === "ok"
        ? { kind: "ok", items: s.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)) }
        : s
    );
  };
  const patchPost = (id: string, patch: Partial<SocialPostItem>) => {
    setPostsState((s) =>
      s.kind === "ok"
        ? { kind: "ok", items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
        : s
    );
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span className="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          {t("loading")}
        </div>
      </main>
    );
  }

  const activeState =
    tab === "feedbacks" ? feedbackState : tab === "users" ? usersState : postsState;

  if (activeState.kind === "forbidden") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-bold text-red-700 mb-2">{t("forbiddenTitle")}</h1>
          <p className="text-sm text-slate-600 mb-4">{t("forbiddenBody")}</p>
          <button
            onClick={() => router.replace("/")}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
          >
            {t("backHome")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{t("pageTitle")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("pageSubtitle")}</p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            ↻ {t("refresh")}
          </button>
        </header>

        <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
          <TabButton current={tab} value="feedbacks" onClick={setTab} label={t("tabFeedbacks")} />
          <TabButton current={tab} value="users" onClick={setTab} label={t("tabUsers")} />
          <TabButton current={tab} value="social" onClick={setTab} label={t("tabSocialPosts")} />
        </div>

        {activeState.kind === "loading" && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            {t("loading")}
          </div>
        )}

        {activeState.kind === "error" && (
          <div className="bg-white border border-amber-200 rounded-xl p-6 text-center">
            <h2 className="text-base font-bold text-amber-700 mb-2">{t("errorTitle")}</h2>
            <p className="text-xs text-slate-600 mb-4 break-words">{activeState.message}</p>
            <button
              onClick={refresh}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {activeState.kind === "ok" && tab === "feedbacks" && (
          <FeedbackList items={feedbackState.kind === "ok" ? feedbackState.items : []} onPatched={patchFeedback} />
        )}
        {activeState.kind === "ok" && tab === "users" && (
          <UsersTable items={usersState.kind === "ok" ? usersState.items : []} onPatched={patchUser} />
        )}
        {activeState.kind === "ok" && tab === "social" && (
          <SocialPostsList
            items={postsState.kind === "ok" ? postsState.items : []}
            templatesState={templatesState}
            templatesSearch={templatesSearch}
            templatesPage={templatesPage}
            onTemplatesSearchChange={(v) => {
              setTemplatesPage(1);
              setTemplatesSearch(v);
            }}
            onTemplatesPageChange={setTemplatesPage}
            onPatched={patchPost}
            onDraftCreated={prependPost}
          />
        )}
      </div>
    </main>
  );
}

function TabButton({
  current,
  value,
  onClick,
  label,
}: {
  current: TabKey;
  value: TabKey;
  onClick: (v: TabKey) => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onClick(value)}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? "border-slate-800 text-slate-800"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

// ─── フィードバック ───────────────────────────────────────────
function FeedbackList({
  items,
  onPatched,
}: {
  items: FeedbackItem[];
  onPatched: (id: string, patch: Partial<FeedbackItem>) => void;
}) {
  const t = useTranslations("Admin");
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("empty")}
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 text-xs text-slate-500">{t("countLabel", { count: items.length })}</div>
      <ul className="space-y-3">
        {items.map((item) => (
          <FeedbackRow key={item.id} item={item} onPatched={onPatched} />
        ))}
      </ul>
    </>
  );
}

function FeedbackRow({
  item,
  onPatched,
}: {
  item: FeedbackItem;
  onPatched: (id: string, patch: Partial<FeedbackItem>) => void;
}) {
  const t = useTranslations("Admin");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(item.message);
  const [type, setType] = useState<string>(item.type ?? "other");
  const [status, setStatus] = useState<string>(item.status ?? "pending");
  const [aiPrompt, setAiPrompt] = useState<string>(item.aiPrompt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setMessage(item.message);
    setType(item.type ?? "other");
    setStatus(item.status ?? "pending");
    setAiPrompt(item.aiPrompt ?? "");
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Partial<FeedbackItem> = {
      message,
      type,
      status,
      aiPrompt: aiPrompt.trim() === "" ? null : aiPrompt,
    };
    const err = await patchAdmin(`/api/admin/feedbacks/${item.id}`, payload);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onPatched(item.id, payload);
    setEditing(false);
  };

  const copyPrompt = async () => {
    if (!item.aiPrompt) return;
    try {
      await navigator.clipboard.writeText(item.aiPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(t("copyFailed"));
    }
  };

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={item.type} />
          {item.status && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
              {feedbackStatusLabel(item.status, t)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <time className="text-xs text-slate-500" suppressHydrationWarning>
            {formatDate(item.createdAt)}
          </time>
          {!editing && (
            <button
              onClick={startEdit}
              className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {t("edit")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {item.email ?? t("anonymous")}
        {item.uid && <span className="ml-2 text-slate-400">uid: {item.uid.slice(0, 8)}…</span>}
      </div>

      {!editing ? (
        <>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">{t("messageLabel")}</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              {item.message}
            </p>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-slate-600">{t("aiPromptLabel")}</p>
              <div className="flex items-center gap-2">
                {item.aiPrompt && (
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {copied ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  disabled={!item.aiPrompt && !item.aiError}
                >
                  {expanded ? t("collapse") : t("expand")}
                </button>
              </div>
            </div>
            {expanded && (
              <div className="mt-2">
                {item.aiPrompt ? (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-900 text-slate-100 rounded-lg px-3 py-3 border border-slate-800 max-h-96 overflow-y-auto font-mono leading-relaxed">
                    {item.aiPrompt}
                  </pre>
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t("aiPromptMissing")}
                    {item.aiError && (
                      <div className="mt-1 text-amber-600 font-mono break-words">{item.aiError}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="block text-slate-600 font-semibold mb-1">{t("colStatus")}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
              >
                {FEEDBACK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {feedbackStatusLabel(s, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="block text-slate-600 font-semibold mb-1">{t("colContent")}</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
              >
                {FEEDBACK_TYPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "bug" ? t("typeBug") : s === "feature" ? t("typeFeature") : t("typeOther")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">{t("messageLabel")}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">{t("aiPromptLabel")}</span>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={6}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-mono"
            />
          </label>
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 break-words">
              {t("saveFailed")}: {error}
            </div>
          )}
          <EditActions saving={saving} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

// ─── ユーザー一覧 ─────────────────────────────────────────────
function UsersTable({
  items,
  onPatched,
}: {
  items: UserItem[];
  onPatched: (uid: string, patch: Partial<UserItem>) => void;
}) {
  const t = useTranslations("Admin");
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("usersEmpty")}
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 text-xs text-slate-500">{t("usersCountLabel", { count: items.length })}</div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">{t("colEmail")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colPlan")}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("colSearchCount")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colLastSearch")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colCreatedAt")}</th>
              <th className="px-4 py-3 text-right font-semibold"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((u) => (
              <UserRow key={u.uid} user={u} onPatched={onPatched} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserRow({
  user,
  onPatched,
}: {
  user: UserItem;
  onPatched: (uid: string, patch: Partial<UserItem>) => void;
}) {
  const t = useTranslations("Admin");
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<string>(user.plan);
  const [searchCount, setSearchCount] = useState<string>(String(user.dailySearchCount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setPlan(user.plan);
    setSearchCount(String(user.dailySearchCount));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const parsed = Number(searchCount);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError(t("saveFailed") + ": invalid count");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { plan, dailySearchCount: parsed };
    const err = await patchAdmin(`/api/admin/users/${user.uid}`, payload);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onPatched(user.uid, payload);
    setEditing(false);
  };

  return (
    <tr className="hover:bg-slate-50 align-top">
      <td className="px-4 py-3 text-slate-800">
        <div>{user.email ?? <span className="text-slate-400">{t("anonymous")}</span>}</div>
        <div className="text-[10px] text-slate-400 font-mono">{user.uid.slice(0, 12)}…</div>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
          >
            {USER_PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "pro" ? t("planPro") : t("planFree")}
              </option>
            ))}
          </select>
        ) : (
          <PlanBadge plan={user.plan} />
        )}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 font-mono">
        {editing ? (
          <input
            type="number"
            min={0}
            value={searchCount}
            onChange={(e) => setSearchCount(e.target.value)}
            className="w-20 border border-slate-300 rounded px-2 py-1 bg-white text-right text-xs"
          />
        ) : (
          user.dailySearchCount
        )}
      </td>
      <td className="px-4 py-3 text-slate-700" suppressHydrationWarning>
        {user.lastSearchDate ?? "—"}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs" suppressHydrationWarning>
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="flex flex-col items-end gap-1">
            <EditActions saving={saving} onSave={save} onCancel={() => setEditing(false)} compact />
            {error && (
              <div className="text-[10px] text-red-700 max-w-[200px] break-words text-right">
                {t("saveFailed")}: {error}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            {t("edit")}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── X 投稿管理 ───────────────────────────────────────────────
function SocialPostsList({
  items,
  templatesState,
  templatesSearch,
  templatesPage,
  onTemplatesSearchChange,
  onTemplatesPageChange,
  onPatched,
  onDraftCreated,
}: {
  items: SocialPostItem[];
  templatesState: TemplatesState;
  templatesSearch: string;
  templatesPage: number;
  onTemplatesSearchChange: (v: string) => void;
  onTemplatesPageChange: (page: number) => void;
  onPatched: (id: string, patch: Partial<SocialPostItem>) => void;
  onDraftCreated: (post: SocialPostItem) => void;
}) {
  const t = useTranslations("Admin");
  return (
    <>
      <TemplatesSection
        state={templatesState}
        search={templatesSearch}
        onSearchChange={onTemplatesSearchChange}
        onPageChange={onTemplatesPageChange}
        onDraftCreated={onDraftCreated}
      />

      <h2 className="text-base font-bold text-slate-800 mt-8 mb-3">{t("postsHistory")}</h2>
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          {t("socialPostsEmpty")}
        </div>
      ) : (
        <>
          <div className="mb-4 text-xs text-slate-500">
            {t("socialPostsCountLabel", { count: items.length })}
          </div>
          <ul className="space-y-3">
            {items.map((p) => (
              <SocialPostRow key={p.id} post={p} onPatched={onPatched} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function TemplatesSection({
  state,
  search,
  onSearchChange,
  onPageChange,
  onDraftCreated,
}: {
  state: TemplatesState;
  search: string;
  onSearchChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onDraftCreated: (post: SocialPostItem) => void;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(true);
  // 入力中は表示だけ追従し、debounce 経由で parent state に反映する
  const [searchDraft, setSearchDraft] = useState(search);

  // 親 state が外部要因で変わった場合 (リフレッシュ等) は draft も同期する
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  // デバウンス: 入力停止後 350ms で親へ通知（親側でも 250ms デバウンスして API 呼び出し）
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== search) onSearchChange(searchDraft);
    }, 350);
    return () => clearTimeout(handle);
    // onSearchChange を依存に入れると親の再 render で都度走るので意図的に除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, search]);

  return (
    <section>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div>
          <h2 className="text-base font-bold text-slate-800">{t("templatesTitle")}</h2>
          <p className="text-xs text-slate-500">{t("templatesSubtitle")}</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          {open ? t("templatesHide") : t("templatesShow")}
        </button>
      </div>

      {open && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("searchTemplates")}
            className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => setSearchDraft("")}
              className="text-xs px-2.5 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {t("clearSearch")}
            </button>
          )}
        </div>
      )}

      {open && state.kind === "loading" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
          {t("loading")}
        </div>
      )}
      {open && state.kind === "forbidden" && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
          {t("forbiddenBody")}
        </div>
      )}
      {open && state.kind === "error" && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
          {state.message}
        </div>
      )}
      {open && state.kind === "ok" && state.page.items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
          {search ? t("templatesNoMatch") : t("templatesEmpty")}
        </div>
      )}
      {open && state.kind === "ok" && state.page.items.length > 0 && (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {t("templatesCountLabel", { count: state.page.totalCount })}
          </div>
          <ul className="space-y-2">
            {state.page.items.map((tpl) => (
              <TemplateRow key={tpl.id} template={tpl} onDraftCreated={onDraftCreated} />
            ))}
          </ul>
          <Pagination
            page={state.page.page}
            totalPages={state.page.totalPages}
            onPageChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("Admin");
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← {t("prevPage")}
      </button>
      <span className="text-xs text-slate-600 font-mono">
        {t("pageInfo", { page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t("nextPage")} →
      </button>
    </div>
  );
}

function TemplateRow({
  template,
  onDraftCreated,
}: {
  template: PromotionTemplate;
  onDraftCreated: (post: SocialPostItem) => void;
}) {
  const t = useTranslations("Admin");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(template.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(t("copyFailed"));
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    const result = await postAdmin<{ id: string }>("/api/admin/social-posts", {
      content: template.text,
      status: "pending",
      templateId: template.id,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDraftCreated({
      id: result.data.id,
      content: template.text,
      status: "pending",
      error: null,
      url: null,
      scheduledAt: null,
      createdAt: new Date().toISOString(),
      publishedAt: null,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(template.text)}`;
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(template.text)}`;
  // Facebook Sharer は基本 URL 単位の共有。本文中の最初の URL を抽出して渡す。
  const urlMatch = template.text.match(/https?:\/\/[^\s]+/);
  const firstUrl = urlMatch ? urlMatch[0] : null;
  const facebookUrl = firstUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(firstUrl)}&quote=${encodeURIComponent(template.text)}`
    : null;

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] font-mono text-slate-400" title={template.id}>
          #{template.id.slice(0, 8)}
        </span>
        {template.lang && (
          <span className="text-[10px] uppercase font-semibold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
            {template.lang}
          </span>
        )}
        {template.type && (
          <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[280px]">
            {template.type}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
        {template.text}
      </p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-400">
          {t("charCount", { count: Array.from(template.text).length })}
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          {copied ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
        </button>
        <a
          href={intentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
        >
          𝕏 {t("openOnX")} ↗
        </a>
        <a
          href={threadsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1 rounded border border-slate-800 bg-white text-slate-800 hover:bg-slate-50"
        >
          @ {t("openOnThreads")} ↗
        </a>
        {facebookUrl ? (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          >
            f {t("openOnFacebook")} ↗
          </a>
        ) : (
          <span
            title={t("facebookNoUrl")}
            className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
          >
            f {t("openOnFacebook")}
          </span>
        )}
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="text-xs px-2.5 py-1 rounded border border-slate-800 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? t("saving") : savedFlash ? `✓ ${t("draftSaved")}` : t("saveAsDraft")}
        </button>
        {error && (
          <span className="text-[10px] text-red-700 max-w-[200px] break-words">
            {t("saveFailed")}: {error}
          </span>
        )}
      </div>
    </li>
  );
}

function SocialPostRow({
  post,
  onPatched,
}: {
  post: SocialPostItem;
  onPatched: (id: string, patch: Partial<SocialPostItem>) => void;
}) {
  const t = useTranslations("Admin");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [status, setStatus] = useState(post.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setContent(post.content);
    setStatus(post.status);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = { content, status };
    const err = await patchAdmin(`/api/admin/social-posts/${post.id}`, payload);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onPatched(post.id, payload);
    setEditing(false);
  };

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusBadge status={post.status} />
        <div className="flex items-center gap-2">
          <time className="text-xs text-slate-500" suppressHydrationWarning>
            {formatDate(post.scheduledAt ?? post.publishedAt ?? post.createdAt)}
          </time>
          {!editing && (
            <button
              onClick={startEdit}
              className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {t("edit")}
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        <>
          <p className="mt-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            {post.content}
          </p>
          {post.error && (
            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-mono break-words">
              {post.error}
            </div>
          )}
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-600 hover:underline"
            >
              {t("viewPost")} →
            </a>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">{t("colStatus")}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full sm:w-48 border border-slate-300 rounded px-2 py-1.5 bg-white"
            >
              {POST_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {postStatusLabel(s, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">{t("colContent")}</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-sm"
            />
            <span className="block text-[10px] text-slate-400 mt-1">{content.length} chars</span>
          </label>
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 break-words">
              {t("saveFailed")}: {error}
            </div>
          )}
          <EditActions saving={saving} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

// ─── 共通: 保存/キャンセルボタン ───────────────────────────────
function EditActions({
  saving,
  onSave,
  onCancel,
  compact = false,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("Admin");
  const btn = compact
    ? "text-[11px] px-2 py-1 rounded font-semibold"
    : "text-xs px-3 py-1.5 rounded font-semibold";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
      >
        {t("cancel")}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`${btn} bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50`}
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}

// ─── バッジ / 表示ヘルパー ────────────────────────────────────
function TypeBadge({ type }: { type: string | null }) {
  const t = useTranslations("Admin");
  const label =
    type === "bug" ? t("typeBug") : type === "feature" ? t("typeFeature") : t("typeOther");
  const cls =
    type === "bug"
      ? "bg-red-100 text-red-700 border-red-200"
      : type === "feature"
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${cls}`}>{label}</span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const t = useTranslations("Admin");
  const isPro = plan === "pro";
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
        isPro
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {isPro ? t("planPro") : t("planFree")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("Admin");
  const label = postStatusLabel(status, t);
  const cls =
    status === "published"
      ? "bg-green-100 text-green-700 border-green-200"
      : status === "error"
        ? "bg-red-100 text-red-700 border-red-200"
        : status === "pending"
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${cls}`}>{label}</span>
  );
}

function postStatusLabel(status: string, t: (k: string) => string): string {
  return status === "pending"
    ? t("statusPending")
    : status === "published"
      ? t("statusPublished")
      : status === "error"
        ? t("statusError")
        : t("statusUnknown");
}

function feedbackStatusLabel(status: string, t: (k: string) => string): string {
  return status === "pending"
    ? t("statusPending")
    : status === "reviewed"
      ? t("statusReviewed")
      : status === "done"
        ? t("statusDone")
        : status === "wontfix"
          ? t("statusWontfix")
          : status;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
