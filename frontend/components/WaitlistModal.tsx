"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/posthog";
import { getApiBase } from "@/lib/api";
import { GUEST_DAILY_LIMIT, FREE_DAILY_LIMIT } from "@/lib/userPlan";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 現在のプラン ("guest" | "free") — テキストを微調整するために使用 */
  plan?: "guest" | "free";
  /** ログイン中ユーザーのUID（任意、Firestoreに保存） */
  uid?: string | null;
  /** ログイン中ユーザーのメール（input の初期値） */
  userEmail?: string | null;
}

export function WaitlistModal({ open, onClose, plan, uid, userEmail }: Props) {
  const t = useTranslations("WaitlistModal");
  const [email, setEmail] = useState(userEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("errorInvalidEmail"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source: "limit_reached_modal",
          uid: uid ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t("errorSave"));
      }

      trackEvent("waitlist_joined", { plan: plan ?? "unknown", source: "limit_reached_modal" });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorSave"));
    } finally {
      setSubmitting(false);
    }
  }

  const limitTitle =
    plan === "guest"
      ? t("guestLimitTitle", { limit: GUEST_DAILY_LIMIT })
      : t("freeLimitTitle", { limit: FREE_DAILY_LIMIT });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── ヘッダー帯 ── */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-6 pt-8 pb-6 text-white">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20 mb-4">
            <svg className="w-6 h-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <h2 className="text-lg font-bold leading-snug mb-1">
            {limitTitle}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t("desc")}
          </p>
        </div>

        {/* ── ボディ ── */}
        <div className="px-6 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-slate-800 text-base mb-1">{t("successTitle")}</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                {t("successDesc")}
              </p>
              <button
                onClick={onClose}
                className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                {t("closeBtn")}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {t("body")}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t("emailLabel")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span>⚠</span> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t("submitting")}
                    </>
                  ) : (
                    t("submitBtn")
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {t("skipBtn")}
                </button>
              </form>

              {/* プラン比較リンク */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>{t("planLink")}</span>
                <a href="/about#pricing" className="text-slate-600 underline hover:text-slate-800">
                  {t("pricingLink")}
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
