import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  const isJa = locale !== "en";
  const SITE_NAME = isJa ? "物件目利きリサーチ" : "Mekiki Research";
  const DEFAULT_DESCRIPTION = isJa
    ? "国土交通省「不動産情報ライブラリ」の公式データ × 不動産鑑定士・エージェントの知見を組み合わせ、物件の真の価値とリスクを目利きします。取引価格の可視化・推移分析、ハザードリスク判定、10項目エリア特性・専門家見解レポート、PDF出力まで対応。不動産投資家・営業・購入検討者向け精密調査支援ツール。"
    : "Combining Japan's MLIT official property transaction data with real estate professional insights to reveal the true value and risk of any property. Price visualization, hazard risk assessment, AI area reports, and PDF export.";
  const OGP_IMAGE = `${SITE_URL}/ogp.png`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: isJa
        ? `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`
        : `${SITE_NAME} | Property Analysis with Official Gov Data`,
      template: `%s | ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: isJa
      ? ["不動産調査レポート","不動産資産価値","不動産リスク分析","不動産 取引価格","ハザードマップ 不動産","エリア分析 不動産","不動産投資 調査","国土交通省 不動産情報"]
      : ["Japan real estate report","property price Japan","MLIT property data","area analysis Japan","hazard map Japan","real estate investment Japan"],
    authors: [{ name: "木下 開" }],
    openGraph: {
      type: "website",
      locale: isJa ? "ja_JP" : "en_US",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: isJa
        ? `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`
        : `${SITE_NAME} | Property Analysis with Official Gov Data`,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: OGP_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: isJa
        ? `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`
        : `${SITE_NAME} | Property Analysis with Official Gov Data`,
      description: DEFAULT_DESCRIPTION,
      images: [OGP_IMAGE],
    },
    alternates: {
      canonical: locale === "en" ? `${SITE_URL}/en` : SITE_URL,
      languages: {
        "ja": SITE_URL,
        "en": `${SITE_URL}/en`,
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  // JSON-LD 構造化データ（日本語版のみ詳細、英語版は簡略）
  const SITE_NAME = locale !== "en" ? "物件目利きリサーチ" : "Mekiki Research";
  const DEFAULT_DESCRIPTION =
    locale !== "en"
      ? "国土交通省「不動産情報ライブラリ」の公式データ × 不動産鑑定士の知見を組み合わせた精密調査サービス"
      : "Japan property analysis tool combining official MLIT data with real estate expertise.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        inLanguage: locale,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </>
  );
}
