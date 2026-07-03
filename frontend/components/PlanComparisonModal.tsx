"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { getApiBase } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { useAuthModal } from "./AuthModalContext";
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
  const { open: openAuthModal } = useAuthModal();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [consentChecked, setConsentChecked] = React.useState(false);

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

  function handleSignInClick() {
    onClose();
    openAuthModal("signin");
  }

  async function handleUpgrade() {
    gtagEvent({ action: "begin_checkout", category: "conversion_funnel", label: "Pro" });
    dataLayerPush({ event: "begin_checkout", user_plan: currentPlan ?? "guest", search_count_today: searchCountToday });
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
                onClick={handleSignInClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                {t("ctaGuestBtn")}
              </button>
            </div>
          )}

          {/* Pro アップグレードCTA（フリープランユーザー向け） */}
          {currentPlan === "free" && (
            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                {t("ctaUpgradeTitle")}
              </p>
              <p className="text-sm text-amber-700 mb-3">
                {t("ctaUpgradeBody")}
              </p>
              <label className="flex items-start gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                />
                <span className="text-xs text-amber-800 leading-snug">{t("consentLabel")}</span>
              </label>
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading || !consentChecked}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {checkoutLoading ? t("checkoutLoading") : t("ctaUpgradeBtn")}
              </button>
            </div>
          )}

          {/* プロユーザー */}
          {currentPlan === "pro" && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 text-center">
              {t("ctaProActive")}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
