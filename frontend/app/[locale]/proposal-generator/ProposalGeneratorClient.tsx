"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { getApiBase } from "@/lib/api";
import { gtagEvent } from "@/lib/gtag";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";

interface ProposalArea {
  areaName: string;
  reasons: string[];
  salesScript: string;
  catchcopy: string;
}

const MAX_TARGET_PROFILE = 1000;
const MAX_BUDGET = 300;

export default function ProposalGeneratorClient() {
  const t = useTranslations("ProposalGenerator");
  const locale = useLocale();
  const { user, plan, planLoading } = useAuth();

  const [targetProfile, setTargetProfile] = useState("");
  const [budget, setBudget] = useState("");
  const [areas, setAreas] = useState<ProposalArea[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const isPro = plan === "pro";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!targetProfile.trim() || !budget.trim()) {
      setError(t("errorValidation"));
      return;
    }

    // ── ペイウォール: フォーム入力・ボタンクリックまでは常に許可するが、
    // Pro プラン以外はここでブロックしアップグレードモーダルを表示する。
    // バックエンドへの API コールは Pro のときだけ行う（未Proでは絶対に叩かない）。
    if (!isPro) {
      gtagEvent({
        action: "view_plan_modal",
        category: "conversion_funnel",
        label: "proposal_generator",
        params: { user_plan: !user ? "guest" : (plan ?? "free") },
      });
      setPlanModalOpen(true);
      return;
    }

    setLoading(true);
    setAreas(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError(t("errorGeneric"));
        return;
      }
      const res = await fetch(`${getApiBase()}/api/pro/generate-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          targetProfile: targetProfile.trim(),
          budget: budget.trim(),
          locale: locale === "en" ? "en" : "ja",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        setError(body.error ?? t("errorGeneric"));
        return;
      }
      const data = (await res.json()) as { areas: ProposalArea[] };
      setAreas(Array.isArray(data.areas) ? data.areas : []);
    } catch (err) {
      console.error("[ProposalGenerator] generate failed:", err);
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{t("pageTitle")}</h1>
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
              PRO
            </span>
          </div>
          <p className="text-sm text-slate-600">{t("pageSubtitle")}</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* 左: 入力フォーム */}
          <form
            onSubmit={handleGenerate}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-800">{t("formTitle")}</h2>

            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("targetProfileLabel")}
              </span>
              <textarea
                value={targetProfile}
                onChange={(e) => setTargetProfile(e.target.value.slice(0, MAX_TARGET_PROFILE))}
                placeholder={t("targetProfilePlaceholder")}
                rows={5}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="block mt-1 text-[11px] text-slate-400 text-right">
                {targetProfile.length}/{MAX_TARGET_PROFILE}
              </span>
            </label>

            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("budgetLabel")}
              </span>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value.slice(0, MAX_BUDGET))}
                placeholder={t("budgetPlaceholder")}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || planLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("generatingBtn")}
                </>
              ) : (
                t("generateBtn")
              )}
            </button>
          </form>

          {/* 右: 結果表示エリア */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3">{t("resultsTitle")}</h2>

            {!isPro ? (
              <SampleTeaser t={t} onUnlock={() => setPlanModalOpen(true)} />
            ) : loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
                <span className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                {t("generatingBtn")}
              </div>
            ) : areas && areas.length > 0 ? (
              <div className="space-y-4">
                {areas.map((area, i) => (
                  <ProposalAreaCard key={`${area.areaName}-${i}`} area={area} t={t} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1">{t("emptyStateTitle")}</p>
                <p className="text-xs text-slate-500">{t("emptyStateBody")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlanComparisonModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlan={plan}
        uid={user?.uid}
        userEmail={user?.email}
      />
    </main>
  );
}

function ProposalAreaCard({
  area,
  t,
}: {
  area: ProposalArea;
  t: ReturnType<typeof useTranslations>;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = [
      area.areaName,
      "",
      `■ ${t("reasonsLabel")}`,
      ...area.reasons.map((r) => `- ${r}`),
      "",
      `■ ${t("salesScriptLabel")}`,
      area.salesScript,
      "",
      `■ ${t("catchcopyLabel")}`,
      area.catchcopy,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード API 利用不可時は静かに無視する
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold text-slate-800">{area.areaName}</h3>
        <button
          type="button"
          onClick={copyAll}
          className="shrink-0 text-xs px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {copied ? `✓ ${t("copiedBtn")}` : `📋 ${t("copyBtn")}`}
        </button>
      </div>

      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 mb-1.5">{t("reasonsLabel")}</p>
        <ul className="space-y-1">
          {area.reasons.map((reason, i) => (
            <li key={i} className="text-sm text-slate-700 flex gap-2">
              <span className="text-amber-500 shrink-0">●</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 mb-1.5">{t("salesScriptLabel")}</p>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
          {area.salesScript}
        </p>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 mb-1.5">{t("catchcopyLabel")}</p>
        <p className="text-base font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          {area.catchcopy}
        </p>
      </div>
    </div>
  );
}

/** 未ログイン・Free ユーザー向けの「モザイク付きサンプル結果」ティーザー。実データは含まない固定サンプル文言。 */
function SampleTeaser({
  t,
  onUnlock,
}: {
  t: ReturnType<typeof useTranslations>;
  onUnlock: () => void;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="blur-[3px] select-none pointer-events-none opacity-70">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-bold text-slate-800">{t("sampleAreaName")}</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
              {t("sampleBadge")}
            </span>
          </div>
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 mb-1.5">{t("reasonsLabel")}</p>
            <ul className="space-y-1">
              {[t("sampleReason1"), t("sampleReason2"), t("sampleReason3")].map((reason, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-amber-500 shrink-0">●</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 mb-1.5">{t("salesScriptLabel")}</p>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              {t("sampleSalesScript")}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">{t("catchcopyLabel")}</p>
            <p className="text-base font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              {t("sampleCatchcopy")}
            </p>
          </div>
        </div>
      </div>

      {/* ロック解除オーバーレイ */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-white/30">
        <div className="bg-white border border-amber-200 rounded-2xl shadow-xl px-6 py-6 max-w-sm text-center">
          <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-800 mb-1.5">{t("unlockOverlayTitle")}</p>
          <p className="text-xs text-slate-600 mb-4">{t("unlockOverlayBody")}</p>
          <button
            type="button"
            onClick={onUnlock}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
          >
            {t("unlockOverlayBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
