"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { getApiBase } from "@/lib/api";
import { trackEvent } from "@/lib/posthog";

type FeedbackType = "bug" | "feature" | "other";

const MAX_LENGTH = 2000;

export function FeedbackWidget() {
  const t = useTranslations("FeedbackWidget");
  const { user, loading: authLoading } = useAuth();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // パネルを閉じるたびに入力をリセット
  useEffect(() => {
    if (!open) {
      // 完了画面のフリッカー防止のため少し遅延
      const tm = setTimeout(() => {
        setMessage("");
        setError(null);
        setSuccess(false);
        setType("feature");
      }, 200);
      return () => clearTimeout(tm);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = message.trim();
    if (!trimmed) {
      setError(t("errorEmpty"));
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(t("errorTooLong"));
      return;
    }

    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) {
      setError(t("loginRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ message: trimmed, type }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(t("errorRateLimit"));
        }
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t("errorSubmit"));
      }

      trackEvent("feedback_submitted", { type });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  // 未ログイン・Auth ロード中はボタンを出さない（バックエンドが認証必須のため）
  if (authLoading || !user) return null;

  return (
    <>
      {/* ── トリガーボタン（右下固定） ── */}
      {!open && (
        <button
          type="button"
          aria-label={t("buttonLabel")}
          title={t("buttonLabel")}
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9998] flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700 hover:scale-105 transition-all"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* ── パネル（右下固定・チャットウィンドウ風） ── */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[9998] w-[calc(100vw-2.5rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* ヘッダー */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 text-white flex items-center justify-between">
            <div>
              <p className="text-sm font-bold leading-tight">{t("title")}</p>
              <p className="text-xs text-slate-300 leading-tight mt-0.5">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              aria-label={t("closeBtn")}
              onClick={() => setOpen(false)}
              className="text-slate-300 hover:text-white p-1 -mr-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ボディ */}
          <div className="px-4 py-4">
            {success ? (
              <div className="text-center py-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-bold text-slate-800 text-sm mb-1">{t("successTitle")}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{t("successDesc")}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
                >
                  {t("closeBtn")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t("typeLabel")}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["bug", "feature", "other"] as FeedbackType[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setType(opt)}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          type === opt
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
                        }`}
                      >
                        {opt === "bug" ? t("typeBug") : opt === "feature" ? t("typeFeature") : t("typeOther")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t("messageLabel")}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("messagePlaceholder")}
                    rows={5}
                    maxLength={MAX_LENGTH}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition resize-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 text-right">
                    {message.length} / {MAX_LENGTH}
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-red-600 flex items-start gap-1">
                    <span>⚠</span> <span className="flex-1">{error}</span>
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    {t("cancelBtn")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t("submitting")}
                      </>
                    ) : (
                      t("submitBtn")
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
