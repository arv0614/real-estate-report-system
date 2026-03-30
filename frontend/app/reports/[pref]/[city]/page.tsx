/**
 * /reports/[pref]/[city] — エリア別不動産レポートページ（プログラマティックSEO）
 *
 * ISR: revalidate = 86400 (24時間)
 * データ: 国交省「不動産情報ライブラリ」API → バックエンド経由
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findArea, AREAS, PREF_NAMES } from "@/lib/areas";
import { calcSummary, formatPrice, formatUnitPrice } from "@/lib/api";
import { SummaryCards } from "@/components/SummaryCards";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import type { TransactionApiResponse } from "@/types/api";

export const revalidate = 86400; // 24時間ISR

// ── 静的パス生成（ビルド時に全エリアのパスを事前生成） ──────────────
export function generateStaticParams() {
  return AREAS.map((a) => ({ pref: a.prefSlug, city: a.citySlug }));
}

// ── メタデータ ────────────────────────────────────────────────────────
type PageProps = {
  params: Promise<{ pref: string; city: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pref, city } = await params;
  const area = findArea(pref, city);
  if (!area) return {};

  const prefName = PREF_NAMES[pref] ?? pref;
  const title = `${area.city}の不動産取引価格・資産価値調査レポート | ${prefName}`;
  const description = `${prefName}${area.city}の不動産取引価格・㎡単価・ハザード情報を国土交通省データをもとに調査。最新の取引事例、洪水浸水リスク、エリア特性を無料で確認できます。`;

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://realestate-frontend-2hctlfcy6a-an.a.run.app";

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/reports/${pref}/${city}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/reports/${pref}/${city}`,
      siteName: "不動産価値・リスク調査レポート",
      locale: "ja_JP",
      type: "article",
      images: [{ url: `${SITE_URL}/ogp.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// ── データ取得 ────────────────────────────────────────────────────────
async function fetchAreaData(
  lat: number,
  lng: number
): Promise<TransactionApiResponse | null> {
  const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
  const API_BASE = RAW_API_URL.replace(/\/$/, "") || "";
  const url = `${API_BASE}/api/property/transactions?lat=${lat}&lng=${lng}&zoom=15`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── ページ本体 ─────────────────────────────────────────────────────────
export default async function AreaReportPage({ params }: PageProps) {
  const { pref, city } = await params;
  const area = findArea(pref, city);
  if (!area) notFound();

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://realestate-frontend-2hctlfcy6a-an.a.run.app";

  const data = await fetchAreaData(area.lat, area.lng);
  const records = data?.data?.data ?? [];
  const summary = records.length > 0 ? calcSummary(records) : null;
  const hazard = data?.hazard ?? undefined;

  // 同一都道府県の他エリアリンク（最大6件、自分自身を除く）
  const relatedAreas = AREAS.filter(
    (a) => a.prefSlug === pref && a.citySlug !== city
  ).slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-slate-700 text-sm">
            ← トップへ戻る
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600 font-medium">
            {area.prefecture} {area.city} の不動産調査レポート
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ページタイトル */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-6">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest mb-1">
            エリア別 不動産価値・リスク調査
          </p>
          <h1 className="text-2xl font-bold text-slate-900 leading-snug">
            {area.prefecture} {area.city}
            <span className="block text-base font-normal text-slate-500 mt-1">
              不動産取引価格・資産価値・ハザード情報レポート
            </span>
          </h1>
          <p className="text-sm text-slate-600 mt-3">
            国土交通省「不動産情報ライブラリ」のオープンデータをもとに、
            {area.city}の最新不動産取引価格・㎡単価・洪水リスク・土砂災害リスクを調査しています。
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1">
              国土交通省データ
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-full px-3 py-1">
              ハザードマップ情報
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">
              毎日更新
            </span>
          </div>
        </div>

        {/* データ取得失敗時 */}
        {!data && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 text-amber-800 text-sm">
            現在、{area.city}のデータを取得中です。しばらくしてから再度アクセスしてください。
          </div>
        )}

        {/* サマリーカード */}
        {summary && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              取引価格サマリー
            </h2>
            <SummaryCards summary={summary} hazard={hazard} />
          </section>
        )}

        {/* 価格推移チャート */}
        {records.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              価格推移トレンド
            </h2>
            <PriceTrendChart records={records} />
          </section>
        )}

        {/* データ概要テキスト */}
        {summary && (
          <section className="bg-white rounded-xl border border-slate-200 px-6 py-5 space-y-2">
            <h2 className="text-base font-semibold text-slate-800">
              {area.city} の不動産取引概要
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              国土交通省のデータによると、{area.prefecture}{area.city}では
              {summary.totalCount.toLocaleString()}件の取引事例が確認されています。
              平均取引価格は{formatPrice(summary.avgTradePrice)}
              {summary.avgUnitPrice
                ? `、平均㎡単価は${formatUnitPrice(summary.avgUnitPrice)}`
                : ""}
              です。
              {hazard?.flood.hasRisk
                ? "洪水浸水想定区域が一部に含まれており、物件選定時には国土交通省ハザードマップの確認を推奨します。"
                : "洪水浸水想定区域への該当は確認されておらず、ハザードリスクは比較的低い地域です。"}
            </p>
          </section>
        )}

        {/* AIレポート誘導CTA */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl px-6 py-6 text-white">
          <h2 className="text-lg font-bold mb-1">
            {area.city}の詳細エリア診断を無料で試す
          </h2>
          <p className="text-sm text-blue-100 mb-4">
            国交省データ×専門家分析による10項目のエリア特性レポートを生成します。
            生活環境・周辺施設・資産価値トレンドまで詳しく調査できます。
          </p>
          <Link
            href={`/?lat=${area.lat}&lng=${area.lng}`}
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-blue-50 transition-colors"
          >
            {area.city}の詳細レポートを見る →
          </Link>
        </section>

        {/* 関連エリアリンク */}
        {relatedAreas.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              {area.prefecture} の他のエリアを調べる
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedAreas.map((a) => (
                <Link
                  key={a.citySlug}
                  href={`/reports/${a.prefSlug}/${a.citySlug}`}
                  className="inline-flex items-center gap-1 text-sm bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  {a.city}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>
          データソース: 国土交通省「不動産情報ライブラリ」 /{" "}
          <Link href="/" className="underline hover:text-slate-600">
            不動産価値・リスク調査レポート
          </Link>
        </p>
        <p className="mt-1">
          © {new Date().getFullYear()} 不動産価値・リスク調査レポート — 情報は参考値です。投資判断には専門家にご相談ください。
        </p>
      </footer>
    </div>
  );
}
