import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { AuthModalProvider } from "@/components/AuthModalContext";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type SiteLocale = "ja" | "en" | "zh-TW" | "zh-CN";

const SITE_META: Record<
  SiteLocale,
  {
    name: string;
    title: string;
    description: string;
    keywords: string[];
    ogLocale: string;
  }
> = {
  ja: {
    name: "物件目利きリサーチ",
    title: "物件目利きリサーチ | 国交省データ×AI分析で相場とリスクを即調査",
    description:
      "不動産の購入・調査を検討中の方必見。国土交通省の実取引データとAI分析で相場・ハザードリスク・生活環境を即座にレポート化。取引価格の推移分析・10項目エリアレポート・PDF出力まで対応。購入検討者・不動産エージェント向け公的データ閲覧ツール。",
    keywords: [
      "不動産調査レポート",
      "不動産 相場",
      "不動産リスク分析",
      "不動産 取引価格",
      "ハザードマップ 不動産",
      "マイホーム 購入",
      "不動産 データ調査",
      "国土交通省 不動産情報",
      "不動産 AI分析",
      "物件調査 ツール",
    ],
    ogLocale: "ja_JP",
  },
  en: {
    name: "Mekiki Research",
    title: "Mekiki Research | Japan Property Analysis — Price & Risk in Seconds",
    description:
      "Instantly analyze any property in Japan. Official MLIT transaction data + AI-powered area reports: price trends, flood & landslide risk, school zones, nearest stations, and more. Built for home buyers, property researchers, and real estate agents.",
    keywords: [
      "Japan real estate analysis",
      "property price Japan",
      "MLIT property data",
      "hazard risk Japan",
      "home buying Japan",
      "real estate data Japan",
      "property report Japan",
      "AI area analysis",
    ],
    ogLocale: "en_US",
  },
  "zh-TW": {
    name: "物件目利研究",
    title: "物件目利研究 | 以國交省資料 × AI 分析即時掌握行情與風險",
    description:
      "正在考慮購屋或調查物件的您必看。以國土交通省實際成交資料與 AI 分析,即刻產生行情、災害風險、生活環境的報告。讓資料消除購屋前的不安。",
    keywords: [
      "日本不動產分析",
      "日本房價",
      "國交省 不動產資料",
      "災害風險 日本",
      "日本購屋",
      "日本不動產調查",
      "日本物件調查",
      "AI 區域分析",
    ],
    ogLocale: "zh_TW",
  },
  "zh-CN": {
    name: "物件目利研究",
    title: "物件目利研究 | 以国交省数据 × AI 分析即时掌握行情与风险",
    description:
      "正在考虑购房或调查物件的您必看。以国土交通省实际成交数据与 AI 分析,即刻生成行情、灾害风险、生活环境的报告。让数据消除购房前的不安。",
    keywords: [
      "日本房地产分析",
      "日本房价",
      "国交省 房地产数据",
      "灾害风险 日本",
      "日本购房",
      "日本房地产调查",
      "日本物件调查",
      "AI 区域分析",
    ],
    ogLocale: "zh_CN",
  },
};

function asSiteLocale(s: string): SiteLocale {
  return (Object.keys(SITE_META) as SiteLocale[]).includes(s as SiteLocale)
    ? (s as SiteLocale)
    : "ja";
}

function localizedSiteUrl(locale: SiteLocale): string {
  return locale === "ja" ? SITE_URL : `${SITE_URL}/${locale}`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = asSiteLocale(rawLocale);
  const meta = SITE_META[locale];
  const OGP_IMAGE = `${SITE_URL}/ogp.png`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: meta.title,
      template: `%s | ${meta.name}`,
    },
    description: meta.description,
    keywords: meta.keywords,
    authors: [{ name: "木下 開" }],
    openGraph: {
      type: "website",
      locale: meta.ogLocale,
      url: localizedSiteUrl(locale),
      siteName: meta.name,
      title: meta.title,
      description: meta.description,
      images: [{ url: OGP_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [OGP_IMAGE],
    },
    alternates: {
      canonical: localizedSiteUrl(locale),
      languages: {
        ja: SITE_URL,
        en: `${SITE_URL}/en`,
        "zh-TW": `${SITE_URL}/zh-TW`,
        "zh-CN": `${SITE_URL}/zh-CN`,
        "x-default": SITE_URL,
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const JSONLD_SHORT_DESCRIPTION: Record<SiteLocale, string> = {
  ja: "国交省の実取引データ × AI分析で物件の相場・ハザードリスク・生活環境を即座にレポート化。マイホーム購入・不動産調査のための公的データ閲覧ツール。",
  en: "Instantly analyze any property in Japan — MLIT price data, hazard risk, neighborhood info, and AI area reports.",
  "zh-TW": "以國交省實際成交資料 × AI 分析,即刻產生物件行情、災害風險、生活環境的調查報告。",
  "zh-CN": "以国交省实际成交数据 × AI 分析,即刻生成物件行情、灾害风险、生活环境的调查报告。",
};

const JSONLD_OFFER_FREE: Record<SiteLocale, { name: string; description: string }> = {
  ja: {
    name: "フリープラン",
    description: "1日3回の調査・取引価格サマリー・ハザード情報・AIエリアレポート（全10項目）",
  },
  en: {
    name: "Free Plan",
    description: "3 research reports/day, price summary, hazard info, full 10-section AI area report",
  },
  "zh-TW": {
    name: "免費方案",
    description: "每日 3 次調查・成交價摘要・災害資訊・AI 區域報告(全 10 項)",
  },
  "zh-CN": {
    name: "免费方案",
    description: "每日 3 次调查・成交价摘要・灾害信息・AI 区域报告(全 10 项)",
  },
};

const JSONLD_OFFER_PRO: Record<SiteLocale, { name: string; description: string }> = {
  ja: {
    name: "プロプラン",
    description: "検索無制限・PDF出力・暮らしイメージ生成・検索履歴保存",
  },
  en: {
    name: "Pro Plan",
    description: "Unlimited searches, PDF export, lifestyle image generation, search history",
  },
  "zh-TW": {
    name: "Pro 方案",
    description: "無限搜尋・PDF 輸出・生活意象生成・搜尋紀錄保存",
  },
  "zh-CN": {
    name: "Pro 方案",
    description: "无限搜索・PDF 输出・生活意象生成・搜索记录保存",
  },
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: rawLocale } = await params;

  if (!hasLocale(routing.locales, rawLocale)) {
    notFound();
  }
  const locale = asSiteLocale(rawLocale);

  const messages = await getMessages();

  // JSON-LD 構造化データ
  const SITE_NAME = SITE_META[locale].name;
  const DEFAULT_DESCRIPTION = JSONLD_SHORT_DESCRIPTION[locale];
  const offerFree = JSONLD_OFFER_FREE[locale];
  const offerPro = JSONLD_OFFER_PRO[locale];
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
            name: offerFree.name,
            price: "0",
            priceCurrency: "JPY",
            description: offerFree.description,
          },
          {
            "@type": "Offer",
            name: offerPro.name,
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
            description: offerPro.description,
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
          availableLanguage: ["Japanese", "English", "Traditional Chinese", "Simplified Chinese"],
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
        <AuthModalProvider>
          {children}
          <FeedbackWidget />
        </AuthModalProvider>
      </NextIntlClientProvider>
    </>
  );
}
