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

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FeedbackItem[] }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export default function AdminClient() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadFeedbacks = useCallback(async (): Promise<LoadState> => {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return { kind: "forbidden" };

    try {
      const res = await fetch(`${getApiBase()}/api/admin/feedbacks`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        return { kind: "forbidden" };
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { kind: "error", message: `${res.status} ${body}` };
      }
      const data = (await res.json()) as { feedbacks: FeedbackItem[] };
      return { kind: "ok", items: data.feedbacks };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  const refresh = useCallback(() => {
    setState({ kind: "loading" });
    loadFeedbacks().then(setState);
  }, [loadFeedbacks]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    loadFeedbacks().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, loadFeedbacks, router]);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // フォールバック: ユーザーに alert で通知
      alert(t("copyFailed"));
    }
  }

  if (authLoading || (state.kind === "loading" && user)) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span className="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          {t("loading")}
        </div>
      </main>
    );
  }

  if (state.kind === "forbidden") {
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

  if (state.kind === "error") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-bold text-amber-700 mb-2">{t("errorTitle")}</h1>
          <p className="text-xs text-slate-600 mb-4 break-words">{state.message}</p>
          <button
            onClick={refresh}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
          >
            {t("retry")}
          </button>
        </div>
      </main>
    );
  }

  const items = state.kind === "ok" ? state.items : [];

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

        <div className="mb-4 text-xs text-slate-500">
          {t("countLabel", { count: items.length })}
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            {t("empty")}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5"
              >
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
                    <p className="text-xs font-semibold text-slate-600">
                      {t("aiPromptLabel")}
                    </p>
                    <div className="flex items-center gap-2">
                      {item.aiPrompt && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.aiPrompt!, item.id)}
                          className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {copiedId === item.id ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
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
        )}
      </div>
    </main>
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
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
