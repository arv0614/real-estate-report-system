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
  const DEFAULT_TITLE = isJa
    ? `${SITE_NAME} | 国交省データ×AI分析で相場とリスクを即調査`
    : `${SITE_NAME} | Japan Property Analysis — Price & Risk in Seconds`;
  const DEFAULT_DESCRIPTION = isJa
    ? "マイホーム・投資物件を検討中の方必見。国土交通省の実取引データとAI分析で相場・ハザードリスク・生活環境を即座にレポート化。取引価格の推移分析・10項目エリアレポート・PDF出力まで対応。不動産投資家・購入検討者・エージェント向け精密調査ツール。"
    : "Instantly analyze any property in Japan. Official MLIT transaction data + AI-powered area reports: price trends, flood & landslide risk, school zones, nearest stations, and more. Built for home buyers, investors, and real estate agents.";
  const OGP_IMAGE = `${SITE_URL}/ogp.png`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: isJa
      ? ["不動産調査レポート","不動産 相場","不動産リスク分析","不動産 取引価格","ハザードマップ 不動産","マイホーム 購入","不動産投資 調査","国土交通省 不動産情報","不動産 AI分析","物件調査 ツール"]
      : ["Japan real estate analysis","property price Japan","MLIT property data","hazard risk Japan","home buying Japan","real estate investment Japan","property report Japan","AI area analysis"],
    authors: [{ name: "木下 開" }],
    openGraph: {
      type: "website",
      locale: isJa ? "ja_JP" : "en_US",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: OGP_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
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

  // JSON-LD 構造化データ
  const isJa = locale !== "en";
  const SITE_NAME = isJa ? "物件目利きリサーチ" : "Mekiki Research";
  const DEFAULT_DESCRIPTION = isJa
    ? "国交省の実取引データ × AI分析で物件の相場・ハザードリスク・生活環境を即座にレポート化。マイホーム購入・不動産投資の精密調査ツール。"
    : "Instantly analyze any property in Japan — MLIT price data, hazard risk, neighborhood info, and AI area reports.";
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
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        description: DEFAULT_DESCRIPTION,
        offers: [
          {
            "@type": "Offer",
            name: isJa ? "フリープラン" : "Free Plan",
            price: "0",
            priceCurrency: "JPY",
            description: isJa
              ? "1日3回の調査・取引価格サマリー・ハザード情報・AIエリアレポート（全10項目）"
              : "3 research reports/day, price summary, hazard info, full 10-section AI area report",
          },
          {
            "@type": "Offer",
            name: isJa ? "プロプラン" : "Pro Plan",
            price: "980",
            priceCurrency: "JPY",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "980",
              priceCurrency: "JPY",
              unitCode: "MON",
              billingDuration: 1,
              billingIncrement: 1,
            },
            description: isJa
              ? "検索無制限・PDF出力・暮らしイメージ生成・検索履歴保存"
              : "Unlimited searches, PDF export, lifestyle image generation, search history",
          },
        ],
        author: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#org`,
          name: SITE_NAME,
          url: SITE_URL,
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        contactPoint: {
          "@type": "ContactPoint",
          email: "realestate.report.support@gmail.com",
          contactType: "customer support",
          availableLanguage: ["Japanese", "English"],
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
