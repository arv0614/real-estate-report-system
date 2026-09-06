"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { getApiBase } from "@/lib/api";
import { gtagEvent } from "@/lib/gtag";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import BlogMiniMapWrapper from "@/components/blog/BlogMiniMapWrapper";

interface ProposalArea {
  areaName: string;
  reasons: string[];
  salesScript: string;
  catchcopy: string;
  lat: number;
  lng: number;
}

const MAX_TARGET_PROFILE = 1000;
const MAX_BUDGET = 300;

/** 「よくある条件」プリセット。選択するとテキストエリアに追記される（自由記述と併用可）。 */
const PRESET_KEYS = ["preset1", "preset2", "preset3", "preset4", "preset5", "preset6"] as const;

/** 「よくある予算・条件」プリセット。選択すると予算欄に追記される（自由記述と併用可）。 */
const BUDGET_PRESET_KEYS = ["budgetPreset1", "budgetPreset2", "budgetPreset3", "budgetPreset4"] as const;

/** 既存の値を上書きせず、末尾に追記する（重複追加は防止）。プリセット選択の共通ロジック。 */
function appendPreset(current: string, addition: string, maxLen: number): string {
  const trimmed = current.trim();
  const next = !trimmed ? addition : trimmed.includes(addition) ? current : `${trimmed}、${addition}`;
  return next.slice(0, maxLen);
}

/** 対象の広域エリア。バックエンドにはここで選ばれたラベルをそのまま送信する。 */
const TARGET_AREA_KEYS = [
  "areaTokyo23",
  "areaTokyoOutskirts",
  "areaKanagawa",
  "areaChiba",
  "areaSaitama",
  "areaKansai",
  "areaOther",
] as const;

export default function ProposalGeneratorClient() {
  const t = useTranslations("ProposalGenerator");
  const locale = useLocale();
  const { user, plan, planLoading } = useAuth();

  const [targetProfile, setTargetProfile] = useState("");
  const [budget, setBudget] = useState("");
  const [targetArea, setTargetArea] = useState("");
  const [areas, setAreas] = useState<ProposalArea[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const isPro = plan === "pro";
  const homeHref = locale === "en" ? "/en" : "/";

  /** プリセットを選ぶとテキストエリアに追記する（自由記述を上書きしない）。選択後は毎回リセットして再選択可能にする。 */
  function handlePresetSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) return;
    setTargetProfile((prev) => appendPreset(prev, value, MAX_TARGET_PROFILE));
    e.target.value = "";
  }

  /** 予算プリセットを選ぶと予算欄に追記する（自由記述を上書きしない）。選択後は毎回リセットして再選択可能にする。 */
  function handleBudgetPresetSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) return;
    setBudget((prev) => appendPreset(prev, value, MAX_BUDGET));
    e.target.value = "";
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!targetProfile.trim() || !budget.trim() || !targetArea) {
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
          targetArea,
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
      {/* 迷子防止: TOPへ戻る導線 */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_mekiki_research.png" alt="" className="h-7 w-7 object-contain" />
            <span>{t("backToTop")}</span>
          </Link>
        </div>
      </div>

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
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <select
                  defaultValue=""
                  onChange={handlePresetSelect}
                  aria-label={t("presetLabel")}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="" disabled>
                    {t("presetPlaceholder")}
                  </option>
                  {PRESET_KEYS.map((key) => (
                    <option key={key} value={t(key)}>
                      {t(key)}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {targetProfile.length}/{MAX_TARGET_PROFILE}
                </span>
              </div>
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
              <select
                defaultValue=""
                onChange={handleBudgetPresetSelect}
                aria-label={t("budgetPresetPlaceholder")}
                className="mt-1.5 text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="" disabled>
                  {t("budgetPresetPlaceholder")}
                </option>
                {BUDGET_PRESET_KEYS.map((key) => (
                  <option key={key} value={t(key)}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("targetAreaLabel")}
              </span>
              <select
                value={targetArea}
                onChange={(e) => setTargetArea(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="" disabled>
                  {t("targetAreaPlaceholder")}
                </option>
                {TARGET_AREA_KEYS.map((key) => (
                  <option key={key} value={t(key)}>
                    {t(key)}
                  </option>
                ))}
              </select>
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
                  <ProposalAreaCard key={`${area.areaName}-${i}`} area={area} t={t} locale={locale} />
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
  locale,
}: {
  area: ProposalArea;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const [copied, setCopied] = useState(false);
  const hasCoords =
    typeof area.lat === "number" &&
    typeof area.lng === "number" &&
    Number.isFinite(area.lat) &&
    Number.isFinite(area.lng);

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

      {/* 位置関係を視覚化する小さな地図（駅名だけでは掴みにくいエリア感を補う） */}
      {hasCoords && (
        <div className="mb-4">
          <BlogMiniMapWrapper
            primaryLocation={{ lat: area.lat, lng: area.lng, name: area.areaName }}
            zoom={13}
          />
        </div>
      )}

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

      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 mb-1.5">{t("catchcopyLabel")}</p>
        <p className="text-base font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          {area.catchcopy}
        </p>
      </div>

      {/* トップページの分析機能（取引価格・ハザード等）へ別タブで遷移 */}
      {hasCoords && (
        <a
          href={`${locale === "en" ? "/en" : ""}/?lat=${area.lat}&lng=${area.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          {t("viewDetailsBtn")}
          <span aria-hidden>↗</span>
        </a>
      )}
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
