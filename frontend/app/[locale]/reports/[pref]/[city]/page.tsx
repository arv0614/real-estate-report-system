/**
 * /[locale]/reports/[pref]/[city] — ロケール対応エリアレポートページ
 *
 * 日本語 SSG (/reports/...) とは別に、[locale] ルーティング経由のリクエストを処理。
 * getTranslations() でサーバーサイド翻訳、locale パラメータをバックエンドへ伝播。
 * revalidate は直接宣言（re-export 不可のため）。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { findArea, AREAS, PREF_NAMES, PREF_NAMES_EN } from "@/lib/areas";
import { calcSummary, formatPrice, formatUnitPrice } from "@/lib/api";
import { SummaryCards } from "@/components/SummaryCards";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import type { TransactionApiResponse } from "@/types/api";

export const revalidate = 86400; // 24h ISR

// ── 静的パス生成（pref/city のみ — locale は [locale]/layout で処理済み） ──
export function generateStaticParams() {
  return AREAS.map((a) => ({ pref: a.prefSlug, city: a.citySlug }));
}

// ── 型定義 ────────────────────────────────────────────────────
type PageProps = {
  params: Promise<{ locale: string; pref: string; city: string }>;
};

// ── メタデータ ─────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, pref, city } = await params;
  const area = findArea(pref, city);
  if (!area) return {};

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://mekiki-research.com";

  if (locale === "en") {
    const title = `${area.cityEn}, ${area.prefectureEn} Property Report | Mekiki Research`;
    const description = `Property transaction prices, per-㎡ unit prices, flood risk and hazard data for ${area.cityEn}, ${area.prefectureEn}. Based on Japan MLIT open data.`;
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/en/reports/${pref}/${city}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/en/reports/${pref}/${city}`,
        siteName: "Mekiki Research",
        locale: "en_US",
        type: "article",
        images: [{ url: `${SITE_URL}/ogp.png`, width: 1200, height: 630 }],
      },
    };
  }

  // Japanese (default)
  const prefName = PREF_NAMES[pref] ?? pref;
  const title = `${area.city}の不動産取引価格・資産価値調査レポート | ${prefName}`;
  const description = `${prefName}${area.city}の不動産取引価格・㎡単価・ハザード情報を国土交通省データをもとに調査。最新の取引事例、洪水浸水リスク、エリア特性を無料で確認できます。`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/reports/${pref}/${city}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/reports/${pref}/${city}`,
      siteName: "物件目利きリサーチ",
      locale: "ja_JP",
      type: "article",
      images: [{ url: `${SITE_URL}/ogp.png`, width: 1200, height: 630 }],
    },
  };
}

// ── データ取得（locale パラメータをバックエンドへ伝播） ────────────────
// NOTE: サーバーコンポーネントでは相対パス（/api/...）を使わない。
// Next.js は相対パスを現在のリクエスト URL で解決するため、
// /en/reports/... ページだと /en/api/... になってしまう（404）。
// NEXT_PUBLIC_API_URL が未設定なら呼び出しをスキップする。
async function fetchAreaData(
  lat: number,
  lng: number,
  locale: string
): Promise<TransactionApiResponse | null> {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!API_BASE) {
    return null;
  }
  const url = `${API_BASE}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=15&locale=${locale}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── ページ本体 ──────────────────────────────────────────────────
export default async function LocaleAreaReportPage({ params }: PageProps) {
  const { locale, pref, city } = await params;
  const area = findArea(pref, city);
  if (!area) notFound();

  const t = await getTranslations({ locale, namespace: "ReportPage" });
  const isEn = locale === "en";

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://mekiki-research.com";

  const data = await fetchAreaData(area.lat, area.lng, locale);
  const records = data?.data?.data ?? [];
  const summary = records.length > 0 ? calcSummary(records) : null;
  const hazard = data?.hazard ?? undefined;

  const cityLabel = isEn ? area.cityEn : area.city;
  const prefLabel = isEn ? (PREF_NAMES_EN[pref] ?? pref) : (PREF_NAMES[pref] ?? pref);

  // 同一都道府県の他エリアリンク（最大6件、自分自身を除く）
  const relatedAreas = AREAS.filter(
    (a) => a.prefSlug === pref && a.citySlug !== city
  ).slice(0, 6);

  const homeHref = isEn ? "/en" : "/";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={homeHref} className="text-slate-500 hover:text-slate-700 text-sm">
            {t("backLink")}
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600 font-medium">
            {cityLabel} {t("headerSuffix")}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ページタイトル */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-6">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-1">
            {t("badge")}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 leading-snug">
            {prefLabel} {cityLabel}
            <span className="block text-base font-normal text-slate-500 mt-1">
              {t("titleSuffix")}
            </span>
          </h1>
          <p className="text-sm text-slate-600 mt-3">
            {t("descPrefix")}{cityLabel}{t("descTemplate")}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1">
              {t("badgeMlit")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-full px-3 py-1">
              {t("badgeHazard")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">
              {t("badgeDaily")}
            </span>
          </div>
        </div>

        {/* データ取得失敗時 */}
        {!data && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 text-amber-800 text-sm">
            {t("noDataMsg", { city: cityLabel })}
          </div>
        )}

        {/* サマリーカード */}
        {summary && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              {t("sectionPrice")}
            </h2>
            <SummaryCards summary={summary} hazard={hazard} />
          </section>
        )}

        {/* 価格推移チャート */}
        {records.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              {t("sectionTrend")}
            </h2>
            <PriceTrendChart records={records} />
          </section>
        )}

        {/* データ概要テキスト */}
        {summary && (
          <section className="bg-white rounded-xl border border-slate-200 px-6 py-5 space-y-2">
            <h2 className="text-base font-semibold text-slate-800">
              {cityLabel} {t("overviewTitle")}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t("overviewPrefix")}
              {t("overviewCount", {
                pref: prefLabel,
                city: cityLabel,
                count: summary.totalCount.toLocaleString(),
              })}
              {t("overviewAvgPrice", { price: formatPrice(summary.avgTradePrice) })}
              {summary.avgUnitPrice
                ? t("overviewUnitPrice", { unitPrice: formatUnitPrice(summary.avgUnitPrice) })
                : ""}
              {t("overviewSuffix")}
              {" "}
              {hazard?.flood.hasRisk ? t("hazardTrue") : t("hazardFalse")}
            </p>
          </section>
        )}

        {/* 暮らしのイメージ */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-700">{t("lifestyleTitle")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("lifestyleNote")}</p>
          </div>
          <img
            src={`/seo-images/lifestyles/${area.prefSlug}_${area.citySlug}.jpg`}
            alt={`${cityLabel} lifestyle`}
            className="w-full h-56 object-cover"
            loading="lazy"
          />
        </section>

        {/* AIレポート誘導CTA */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl px-6 py-6 text-white">
          <h2 className="text-lg font-bold mb-1">
            {t("ctaTitle", { city: cityLabel })}
          </h2>
          <p className="text-sm text-blue-100 mb-4">
            {t("ctaDesc")}
          </p>
          <Link
            href={`${homeHref}?lat=${area.lat}&lng=${area.lng}`}
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-blue-50 transition-colors"
          >
            {t("ctaBtn", { city: cityLabel })}
          </Link>
        </section>

        {/* 関連エリアリンク */}
        {relatedAreas.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              {t("relatedTitle", { pref: prefLabel })}
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedAreas.map((a) => (
                <Link
                  key={a.citySlug}
                  href={`${isEn ? "/en" : ""}/reports/${a.prefSlug}/${a.citySlug}`}
                  className="inline-flex items-center gap-1 text-sm bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  {isEn ? a.cityEn : a.city}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>
          {t("footerSource")} /{" "}
          <Link href={homeHref} className="underline hover:text-slate-600">
            {t("footerSiteLink")}
          </Link>
        </p>
        <p className="mt-1">
          © {new Date().getFullYear()} {t("footerSiteLink")} — {t("footerCopyright")}
        </p>
      </footer>
    </div>
  );
}
