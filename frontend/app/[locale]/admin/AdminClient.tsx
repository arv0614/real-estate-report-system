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

type TabKey = "feedbacks" | "users" | "social";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

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

export default function AdminClient() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<TabKey>("feedbacks");
  const [feedbackState, setFeedbackState] = useState<LoadState<FeedbackItem>>({ kind: "loading" });
  const [usersState, setUsersState] = useState<LoadState<UserItem>>({ kind: "loading" });
  const [postsState, setPostsState] = useState<LoadState<SocialPostItem>>({ kind: "loading" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const refresh = () => {
    if (tab === "feedbacks") loadFeedbacks();
    else if (tab === "users") loadUsers();
    else loadPosts();
  };

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      alert(t("copyFailed"));
    }
  }

  // 認証ローディング中 or サインアウト直後
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

  // 現在のタブの state をベースに表示判定
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

        {/* タブメニュー */}
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
          <FeedbackList
            items={activeState.items as FeedbackItem[]}
            expanded={expanded}
            onToggle={toggle}
            onCopy={copyToClipboard}
            copiedId={copiedId}
          />
        )}

        {activeState.kind === "ok" && tab === "users" && (
          <UsersTable items={activeState.items as UserItem[]} />
        )}

        {activeState.kind === "ok" && tab === "social" && (
          <SocialPostsList items={activeState.items as SocialPostItem[]} />
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

// ─── フィードバック一覧 ─────────────────────────────────────────
function FeedbackList({
  items,
  expanded,
  onToggle,
  onCopy,
  copiedId,
}: {
  items: FeedbackItem[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
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
          <li key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <TypeBadge type={item.type} />
                {item.status && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                    {item.status}
                  </span>
                )}
              </div>
              <time className="text-xs text-slate-500" suppressHydrationWarning>
                {formatDate(item.createdAt)}
              </time>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {item.email ?? t("anonymous")}
              {item.uid && (
                <span className="ml-2 text-slate-400">uid: {item.uid.slice(0, 8)}…</span>
              )}
            </div>
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
                      onClick={() => onCopy(item.aiPrompt!, item.id)}
                      className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {copiedId === item.id ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    disabled={!item.aiPrompt && !item.aiError}
                  >
                    {expanded[item.id] ? t("collapse") : t("expand")}
                  </button>
                </div>
              </div>
              {expanded[item.id] && (
                <div className="mt-2">
                  {item.aiPrompt ? (
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-900 text-slate-100 rounded-lg px-3 py-3 border border-slate-800 max-h-96 overflow-y-auto font-mono leading-relaxed">
                      {item.aiPrompt}
                    </pre>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {t("aiPromptMissing")}
                      {item.aiError && (
                        <div className="mt-1 text-amber-600 font-mono break-words">
                          {item.aiError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// ─── ユーザー一覧 ─────────────────────────────────────────────
function UsersTable({ items }: { items: UserItem[] }) {
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
      <div className="mb-4 text-xs text-slate-500">
        {t("usersCountLabel", { count: items.length })}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">{t("colEmail")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colPlan")}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("colSearchCount")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colLastSearch")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("colCreatedAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((u) => (
              <tr key={u.uid} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800">
                  <div>{u.email ?? <span className="text-slate-400">{t("anonymous")}</span>}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{u.uid.slice(0, 12)}…</div>
                </td>
                <td className="px-4 py-3">
                  <PlanBadge plan={u.plan} />
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono">
                  {u.dailySearchCount}
                </td>
                <td className="px-4 py-3 text-slate-700" suppressHydrationWarning>
                  {u.lastSearchDate ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs" suppressHydrationWarning>
                  {formatDate(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── X 投稿管理 ───────────────────────────────────────────────
function SocialPostsList({ items }: { items: SocialPostItem[] }) {
  const t = useTranslations("Admin");
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("socialPostsEmpty")}
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 text-xs text-slate-500">
        {t("socialPostsCountLabel", { count: items.length })}
      </div>
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <StatusBadge status={p.status} />
              <time className="text-xs text-slate-500" suppressHydrationWarning>
                {formatDate(p.scheduledAt ?? p.publishedAt ?? p.createdAt)}
              </time>
            </div>
            <p className="mt-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              {p.content}
            </p>
            {p.error && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-mono break-words">
                {p.error}
              </div>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                {t("viewPost")} →
              </a>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

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
  const label =
    status === "pending"
      ? t("statusPending")
      : status === "published"
        ? t("statusPublished")
        : status === "error"
          ? t("statusError")
          : t("statusUnknown");
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
