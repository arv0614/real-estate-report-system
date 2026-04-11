/**
 * /[locale]/about — ロケール対応サービス紹介ページ
 * locale=ja → 日本語、locale=en → 英語
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { IS_FREE_UNLIMITED_CAMPAIGN } from "@/lib/userPlan";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

// Operator constants (locale-independent)
const OPERATOR_NAME = "木下 開 (Kai Kinoshita)";
const OPERATOR_ADDRESS = "東京都葛飾区東新小岩7-13-20, Tokyo, Japan";
const OPERATOR_PHONE = "070-8397-8965 (weekdays 10:00–18:00 JST)";
const OPERATOR_EMAIL = "realestate.report.support@gmail.com";
const SERVICE_NAME_JA = "物件目利きリサーチ";
const SERVICE_NAME_EN = "Mekiki Research";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale === "en") {
    return {
      title: "About & Pricing | Mekiki Research",
      description:
        "MLIT official data × real estate professional insights. Instantly generate transaction price trends, hazard risk, and 10-section area reports for any location in Japan.",
      alternates: { canonical: `${SITE_URL}/en/about` },
    };
  }
  return {
    title: "サービス紹介・料金プラン | 物件目利きリサーチ",
    description:
      "国土交通省「不動産情報ライブラリ」の公式データ × 不動産プロフェッショナルの知見を組み合わせた精密調査サービス。",
    alternates: { canonical: `${SITE_URL}/about` },
  };
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default async function LocaleAboutPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  const isEn = locale === "en";

  const homeHref = isEn ? "/en" : "/";
  const serviceName = isEn ? SERVICE_NAME_EN : SERVICE_NAME_JA;

  const FEATURES = [
    { icon: "📊", title: t("f0title"), desc: t("f0desc") },
    { icon: "🌊", title: t("f1title"), desc: t("f1desc") },
    { icon: "📋", title: t("f2title"), desc: t("f2desc") },
    { icon: "🖼️", title: t("f3title"), desc: t("f3desc") },
    { icon: "📄", title: t("f4title"), desc: t("f4desc") },
    { icon: "🗂️", title: t("f5title"), desc: t("f5desc") },
  ];

  // Plan data — features list per plan
  const PLAN_FEATURES_0 = [
    { text: t("plan0f0"), ok: true },
    { text: t("plan0f1"), ok: true },
    { text: t("plan0f2"), ok: true },
    { text: t("plan0f3"), ok: false },
    { text: t("plan0f4"), ok: false },
    { text: t("plan0f5"), ok: false },
    { text: t("plan0f6"), ok: false },
  ];
  const PLAN_FEATURES_1 = [
    { text: IS_FREE_UNLIMITED_CAMPAIGN ? t("plan1f0cp") : t("plan1f0"), ok: true },
    { text: t("plan0f1"), ok: true },
    { text: t("plan0f2"), ok: true },
    { text: t("plan1f3"), ok: true },
    { text: t("plan0f4"), ok: false },
    { text: t("plan0f5"), ok: true },
    { text: t("plan0f6"), ok: false },
  ];
  const PLAN_FEATURES_2 = [
    { text: t("plan2f0"), ok: true },
    { text: t("plan0f1"), ok: true },
    { text: t("plan0f2"), ok: true },
    { text: t("plan2f3"), ok: true },
    { text: t("plan0f4"), ok: true },
    { text: t("plan0f5"), ok: true },
    { text: t("plan2f6"), ok: true },
  ];

  // Operator legal table rows (text values are locale-independent facts)
  const LEGAL_ROWS = [
    { label: t("legalRow0label"), value: OPERATOR_NAME },
    { label: t("legalRow1label"), value: OPERATOR_NAME },
    { label: t("legalRow2label"), value: OPERATOR_ADDRESS },
    { label: t("legalRow3label"), value: OPERATOR_PHONE },
    { label: t("legalRow4label"), value: OPERATOR_EMAIL },
    { label: t("legalRow5label"), value: isEn ? `${SERVICE_NAME_EN} (β)` : `${SERVICE_NAME_JA}（β版）` },
    {
      label: t("legalRow6label"),
      value: isEn
        ? "B2B/B2C SaaS combining Japan MLIT open property data and expert real estate insights for area analysis"
        : "国土交通省「不動産情報ライブラリ」データ及び不動産プロフェッショナルの知見を活用した不動産エリア精密調査SaaSサービス",
    },
    {
      label: t("legalRow7label"),
      value: isEn
        ? "Guest: Free / Free plan: Free (Google account required) / Pro plan: ¥980/month (incl. tax) — coming soon"
        : "Guestプラン: 無料 / Freeプラン: 無料（Googleアカウント登録必須）/ Proプラン: 月額980円（税込）※近日公開予定",
    },
    {
      label: t("legalRow8label"),
      value: isEn
        ? "Credit card via Stripe (Visa / Mastercard / JCB / Amex)"
        : "クレジットカード決済（Stripe）。Visa / Mastercard / JCB / American Express 対応予定",
    },
    {
      label: t("legalRow9label"),
      value: isEn
        ? "Charged upon Pro plan upgrade; renewed automatically each month on the same date"
        : "Proプランへのアップグレード時に課金が発生し、以降は毎月同日に自動更新されます",
    },
    {
      label: t("legalRow10label"),
      value: isEn
        ? "The Pro plan can be cancelled at any time. Access continues until month-end. No pro-rated refunds, except for service-critical failures."
        : "Proプランはいつでもキャンセル可能です。解約した場合、当月末日までサービスをご利用いただけます。日割り返金は行っておりません。",
    },
    {
      label: t("legalRow11label"),
      value: isEn
        ? "Pro plan features are activated immediately upon payment confirmation"
        : "お支払い確認後、即時にProプランの機能が有効化されます",
    },
    {
      label: t("legalRow12label"),
      value: isEn
        ? "Latest version of Google Chrome / Safari / Firefox / Edge (internet connection required)"
        : "最新バージョンのGoogle Chrome / Safari / Firefox / Edge（インターネット接続必須）",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo_mekiki_research.png" alt="" className="h-8 w-8 object-contain shrink-0" />
            <span className="font-bold text-slate-800 text-sm leading-tight">{serviceName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">{t("navFeatures")}</a>
            <a href="#pricing" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">{t("navPricing")}</a>
            <a href="#legal" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">{t("navLegal")}</a>
            <Link href={homeHref} className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
              {t("navAppLink")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.25),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {t("heroBadge")}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
              {t("heroTitle")}
            </span>
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("heroDesc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={homeHref} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-bold text-base hover:bg-slate-100 transition-colors shadow-lg">
              {t("heroCta1")}
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white font-medium text-base hover:bg-white/10 transition-colors">
              {t("heroCta2")}
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-400">{t("heroNote")}</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <p className="text-2xl font-extrabold text-slate-800">{t(`stat${i}num` as Parameters<typeof t>[0])}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t(`stat${i}label` as Parameters<typeof t>[0])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">{t("featuresSectionTitle")}</h2>
          <p className="text-slate-500 max-w-xl mx-auto">{t("featuresSectionDesc")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">{t("pricingSectionTitle")}</h2>
            <p className="text-slate-500 max-w-lg mx-auto">{t("pricingSectionDesc")}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            {/* Guest */}
            <div className="relative bg-white rounded-2xl border-2 border-slate-200 p-6 flex flex-col">
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t("plan0label")}</p>
                <p className="text-3xl font-extrabold text-slate-900">{t("plan0price")}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t("plan0note")}</p>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {PLAN_FEATURES_0.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    {f.ok ? <CheckIcon /> : <XIcon />}
                    <span className={`text-sm ${f.ok ? "text-slate-700" : "text-slate-400"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <Link href={homeHref} className="block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors border border-slate-300 text-slate-700 hover:bg-slate-50">
                {t("plan0cta")}
              </Link>
            </div>
            {/* Free */}
            <div className="relative bg-white rounded-2xl border-2 border-blue-200 p-6 flex flex-col">
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t("plan1label")}</p>
                <p className="text-3xl font-extrabold text-slate-900">¥0</p>
                <p className="text-xs text-slate-400 mt-0.5">{t("plan1note")}</p>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {PLAN_FEATURES_1.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    {f.ok ? <CheckIcon /> : <XIcon />}
                    <span className={`text-sm ${f.ok ? "text-slate-700" : "text-slate-400"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <Link href={homeHref} className="block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors bg-blue-600 text-white hover:bg-blue-700">
                {t("plan1cta")}
              </Link>
            </div>
            {/* Pro */}
            <div className="relative bg-white rounded-2xl border-2 border-amber-400 ring-2 ring-amber-300 p-6 flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  {t("plan2badge")}
                </span>
              </div>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t("plan2label")}</p>
                <p className="text-3xl font-extrabold text-slate-900">{t("plan2price")}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t("plan2note")}</p>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {PLAN_FEATURES_2.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    {f.ok ? <CheckIcon /> : <XIcon />}
                    <span className={`text-sm ${f.ok ? "text-slate-700" : "text-slate-400"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <a href="#pricing" className="block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors bg-amber-500 text-white cursor-not-allowed opacity-70">
                {t("plan2cta")}
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">{t("pricingNote")}</p>
        </div>
      </section>

      {/* ── Legal ── */}
      <section id="legal" className="max-w-3xl mx-auto px-4 py-20">
        <h2 className="text-xl font-extrabold text-slate-900 mb-8 pb-3 border-b border-slate-200">
          {t("legalTitle")}
        </h2>
        <div className="space-y-0 divide-y divide-slate-100">
          {LEGAL_ROWS.map(({ label, value }) => (
            <div key={label} className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-slate-600 mb-1 sm:mb-0">{label}</dt>
              <dd className="text-sm text-slate-700 sm:col-span-2 leading-relaxed">{value}</dd>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 mt-0">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center">
              <img src="/logo_mekiki_research.png" alt="" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm text-white font-semibold">{serviceName}</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-5 text-xs">
            <Link href={homeHref} className="hover:text-white transition-colors">{t("footerAppLink")}</Link>
            <a href="#features" className="hover:text-white transition-colors">{t("footerFeatures")}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t("footerPricing")}</a>
            <a href="#legal" className="hover:text-white transition-colors">{t("footerLegal")}</a>
            <Link href={isEn ? "/en/terms" : "/terms"} className="hover:text-white transition-colors">{t("footerTerms")}</Link>
            <Link href={isEn ? "/en/privacy" : "/privacy"} className="hover:text-white transition-colors">{t("footerPrivacy")}</Link>
            <Link href={isEn ? "/en/licenses" : "/licenses"} className="hover:text-white transition-colors">{t("footerLicenses")}</Link>
          </nav>
          <p className="text-xs leading-relaxed text-center sm:text-right">
            {t("footerCredit")}<br />
            {isEn ? "Map: © Geospatial Information Authority of Japan" : "地図: © 国土地理院"}
          </p>
        </div>
      </footer>
    </div>
  );
}
