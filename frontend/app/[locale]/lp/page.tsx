/**
 * /[locale]/lp — 広告流入向けランディングページ
 * シンプルな構成: ヒーロー → 3つの強み → ターゲット層訴求 → ボトムCTA
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LpCtaLink } from "./LpCtaLink";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = { params: Promise<{ locale: string }> };

const SERVICE_NAMES: Record<string, string> = {
  ja: "物件目利きリサーチ",
  en: "Mekiki Research",
  "zh-TW": "物件目利研究",
  "zh-CN": "物件目利研究",
};

function homeHrefFor(locale: string): string {
  return locale === "ja" ? "/" : `/${locale}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LandingPage" });
  const path = locale === "ja" ? "/lp" : `/${locale}/lp`;
  return {
    title: t("heroTitle"),
    description: t("heroDesc"),
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        ja: `${SITE_URL}/lp`,
        en: `${SITE_URL}/en/lp`,
        "zh-TW": `${SITE_URL}/zh-TW/lp`,
        "zh-CN": `${SITE_URL}/zh-CN/lp`,
        "x-default": `${SITE_URL}/lp`,
      },
    },
    openGraph: {
      title: t("heroTitle"),
      description: t("heroDesc"),
      url: `${SITE_URL}${path}`,
    },
  };
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LandingPage" });
  const serviceName = SERVICE_NAMES[locale] ?? SERVICE_NAMES.ja;
  const homeHref = homeHrefFor(locale);

  const FEATURES = [
    { icon: "🤖", tag: t("f0Tag"), title: t("f0Title"), desc: t("f0Desc") },
    { icon: "🌊", tag: t("f1Tag"), title: t("f1Title"), desc: t("f1Desc") },
    { icon: "📊", tag: t("f2Tag"), title: t("f2Title"), desc: t("f2Desc") },
  ];

  const AUDIENCES = [
    { icon: "🏠", title: t("a0Title"), desc: t("a0Desc") },
    { icon: "💼", title: t("a1Title"), desc: t("a1Desc") },
    { icon: "🤝", title: t("a2Title"), desc: t("a2Desc") },
  ];

  const STATS = [
    { num: t("heroStat0"), label: t("heroStat0Label") },
    { num: t("heroStat1"), label: t("heroStat1Label") },
    { num: t("heroStat2"), label: t("heroStat2Label") },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_mekiki_research.png" alt="" className="h-8 w-8 object-contain shrink-0" />
            <span className="font-bold text-slate-800 text-sm leading-tight">{serviceName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {t("navFeatures")}
            </a>
            <a href="#audience" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {t("navAudience")}
            </a>
            <Link
              href={homeHref}
              className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              {t("navAppLink")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,180,255,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(160,80,255,0.18),transparent_55%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {t("heroBadge")}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-200">
              {t("heroTitle")}
            </span>
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("heroDesc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LpCtaLink
              href={homeHref}
              label="heroCta"
              className="group inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-white text-slate-900 font-bold text-base hover:bg-slate-100 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              {t("heroCta")}
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M3 12h18" />
              </svg>
            </LpCtaLink>
          </div>
          <p className="mt-5 text-xs text-slate-400">{t("heroNote")}</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-7 grid grid-cols-3 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800">{s.num}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
            {t("featuresTitle")}
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">{t("featuresDesc")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-200 transition-all"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-blue-600 mb-2">
                {f.tag}
              </p>
              <h3 className="font-bold text-slate-800 mb-2 text-lg">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Audience ── */}
      <section id="audience" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
              {t("audienceTitle")}
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">{t("audienceDesc")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="text-4xl mb-4">{a.icon}</div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">{a.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-4 tracking-tight">
            {t("bottomCtaTitle")}
          </h2>
          <p className="text-base sm:text-lg text-blue-100 mb-9 leading-relaxed max-w-xl mx-auto">
            {t("bottomCtaDesc")}
          </p>
          <LpCtaLink
            href={homeHref}
            label="bottomCta"
            className="group inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white text-blue-700 font-bold text-base sm:text-lg hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            {t("bottomCta")}
            <svg
              className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M3 12h18" />
            </svg>
          </LpCtaLink>
          <p className="mt-5 text-xs text-blue-200">{t("bottomCtaNote")}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_mekiki_research.png" alt="" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm text-white font-semibold">{serviceName}</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-5 text-xs">
            <Link href={homeHref} className="hover:text-white transition-colors">
              {t("navAppLink")}
            </Link>
            <Link
              href={locale === "ja" ? "/about" : `/${locale}/about`}
              className="hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href={locale === "ja" ? "/terms" : `/${locale}/terms`}
              className="hover:text-white transition-colors"
            >
              Terms
            </Link>
            <Link
              href={locale === "ja" ? "/privacy" : `/${locale}/privacy`}
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
          </nav>
          <p className="text-xs leading-relaxed text-center sm:text-right">
            © {new Date().getFullYear()} {serviceName}
          </p>
        </div>
      </footer>
    </div>
  );
}
