"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { signInWithPopup } from "firebase/auth";
import { getApiBase } from "@/lib/api";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { FREE_DAILY_LIMIT, GUEST_DAILY_LIMIT, IS_FREE_UNLIMITED_CAMPAIGN } from "@/lib/userPlan";
import { gtagEvent } from "@/lib/gtag";
import { dataLayerPush } from "@/lib/analytics";
import type { UserPlan } from "@/lib/userPlan";

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlan?: UserPlan | null; // null = guest
  uid?: string | null;
  userEmail?: string | null;
  searchCountToday?: number;
}

// ─────────────────────────────────────────────────────────────
// 🚦 決済有効フラグ
//    Lemon Squeezy の設定完了後に `true` へ変更するだけで決済導線が有効になる
// ─────────────────────────────────────────────────────────────
const IS_PAYMENT_ENABLED = false;

function Cell({ value, highlight }: { value: string; highlight?: boolean }) {
  const isX = value.startsWith("✕");
  const isUnlimited = value.includes("Unlimited") || value === "All" || value === "全項目" || value === "無制限";
  return (
    <td
      className={`px-3 py-3 text-center text-sm border-b border-slate-100 ${
        highlight ? "bg-amber-50" : ""
      } ${
        isX
          ? "text-slate-400"
          : isUnlimited
          ? "text-amber-600 font-semibold"
          : "text-slate-700"
      }`}
    >
      {value}
    </td>
  );
}

export function PlanComparisonModal({ open, onClose, currentPlan, uid, userEmail, searchCountToday = 0 }: Props) {
  const t = useTranslations("PlanModal");
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [waitlistOpen, setWaitlistOpen] = React.useState(false);
  const [waitlistEmail, setWaitlistEmail] = React.useState(userEmail ?? "");
  const [waitlistLoading, setWaitlistLoading] = React.useState(false);
  const [waitlistDone, setWaitlistDone] = React.useState(false);
  const [waitlistError, setWaitlistError] = React.useState("");

  if (!open) return null;

  const FEATURES = [
    {
      label: t("featureSearchCount"),
      guest: `${GUEST_DAILY_LIMIT}`,
      free: IS_FREE_UNLIMITED_CAMPAIGN ? t("featureCpUnlimited") : `${FREE_DAILY_LIMIT}`,
      pro: t("featureUnlimited"),
    },
    { label: t("featurePriceSummary"), guest: t("featureAvail"), free: t("featureAvail"), pro: t("featureAvail") },
    { label: t("featureHazard"),       guest: t("featureAvail"), free: t("featureAvail"), pro: t("featureAvail") },
    { label: t("featureLifestyle"),    guest: t("featureAvail"), free: t("featureAvail"), pro: t("featureAvail") },
    { label: t("featurePriceChart"),   guest: t("featureAvail"), free: t("featureAvail"), pro: t("featureAvail") },
    { label: t("featureAreaReport"),   guest: t("featureGuestLocked"), free: t("featureBetaAll"), pro: t("featureAll") },
    { label: t("featureLifestyleImage"), guest: t("featureNone"), free: t("featureAvail"), pro: t("featureAvail") },
    { label: t("featurePdf"),          guest: t("featureNone"), free: t("featureNone"), pro: t("featureAvail") },
    { label: t("featureHistory"),      guest: t("featureNone"), free: t("featureAvail"), pro: t("featureAvail") },
  ];

  async function handleGoogleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (e) {
      console.error("login error:", e);
    }
  }

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = waitlistEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistError(t("waitlistError"));
      return;
    }
    setWaitlistLoading(true);
    setWaitlistError("");
    try {
      const docId = email.replace(/[^a-zA-Z0-9]/g, "_");
      await setDoc(doc(db, "waitlist", docId), {
        email,
        uid: uid ?? null,
        registeredAt: serverTimestamp(),
        source: "plan_modal",
      }, { merge: true });
      setWaitlistDone(true);
    } catch (err) {
      console.error("[Waitlist] save error:", err);
      setWaitlistError(t("waitlistSaveError"));
    } finally {
      setWaitlistLoading(false);
    }
  }

  async function handleUpgrade() {
    gtagEvent({ action: "click_checkout", category: "conversion_funnel", label: "Pro" });
    dataLayerPush({ event: "begin_checkout", user_plan: currentPlan ?? "guest", search_count_today: searchCountToday });
    if (!IS_PAYMENT_ENABLED) {
      setWaitlistOpen(true);
      return;
    }
    if (!uid) return;
    setCheckoutLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        alert("Login required.");
        return;
      }
      const res = await fetch(`${getApiBase()}/api/lemonsqueezy/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to create checkout session.");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      console.error("[LemonSqueezy] checkout error:", e);
      alert("An error occurred during checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{t("modalTitle")}</h2>
            <p className="text-purple-200 text-xs mt-0.5">{t("modalSubtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none transition-colors"
            aria-label={t("closeBtn")}
          >
            ×
          </button>
        </div>

        {/* プラン名ヘッダー */}
        <div className="px-6 pt-5 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-sm text-slate-500 font-medium w-40" />
                  <th className="px-3 py-2 text-center w-28">
                    <div className="text-slate-600 font-semibold text-sm">{t("guestPlan")}</div>
                    <div className="text-slate-400 text-xs">{t("guestSub")}</div>
                    <div className="mt-1.5 text-slate-500 font-bold text-base">{t("guestPrice")}</div>
                  </th>
                  <th className="px-3 py-2 text-center w-28">
                    <div className="text-blue-600 font-semibold text-sm">{t("freePlan")}</div>
                    <div className="text-slate-400 text-xs">{t("freeSub")}</div>
                    <div className="mt-1.5 text-blue-600 font-bold text-base">{t("freePrice")}</div>
                  </th>
                  <th className="px-3 py-2 text-center w-28 relative">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {t("proRecommended")}
                      </span>
                    </div>
                    <div className="text-amber-600 font-semibold text-sm pt-3">{t("proPlan")}</div>
                    <div className="text-slate-400 text-xs">{t("proSub")}</div>
                    <div className="mt-1.5 text-amber-600 font-bold text-base">{t("proPrice")}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.label} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-3 text-sm text-slate-600 border-b border-slate-100 font-medium">
                      {f.label}
                    </td>
                    <Cell value={f.guest} />
                    <Cell value={f.free} />
                    <Cell value={f.pro} highlight />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 py-5 space-y-3">
          {/* ゲスト → 無料ログインCTA */}
          {!currentPlan && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 text-sm text-blue-800">
                <span className="font-semibold">{t("ctaGuestTitle")}</span>
                {IS_FREE_UNLIMITED_CAMPAIGN
                  ? <> {t("ctaGuestCpText")} {t("ctaGuestCpSuffix")}</>
                  : <> {t("ctaGuestNormalText", { limit: FREE_DAILY_LIMIT })}</>
                }
              </div>
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t("ctaGuestBtn")}
              </button>
            </div>
          )}

          {/* オープンベータ告知（フリープランユーザー向け） */}
          {currentPlan === "free" && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">
                {t("ctaBetaTitle")}
              </p>
              <p className="text-sm text-blue-700">
                {t("ctaBetaBody")}
              </p>
            </div>
          )}

          {/* プロユーザー */}
          {currentPlan === "pro" && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 text-center">
              {t("ctaProActive")}
            </div>
          )}

          {/* ウェイトリスト登録フォーム */}
          {waitlistOpen && !waitlistDone && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
              <p className="text-sm font-semibold text-purple-800 mb-1">{t("waitlistTitle")}</p>
              <p className="text-xs text-purple-700 mb-3">{t("waitlistDesc")}</p>
              <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder={t("waitlistPlaceholder")}
                  className="flex-1 text-sm border border-purple-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  type="submit"
                  disabled={waitlistLoading}
                  className="shrink-0 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
                >
                  {waitlistLoading ? "..." : t("waitlistSubmit")}
                </button>
              </form>
              {waitlistError && <p className="text-xs text-red-600 mt-1">{waitlistError}</p>}
            </div>
          )}
          {waitlistDone && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 text-center">
              {t("waitlistDone")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
