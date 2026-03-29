import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PostHogInit from "@/components/PostHogInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://realestate-frontend-2hctlfcy6a-an.a.run.app";

const SITE_NAME = "AI不動産診断レポート";
const DEFAULT_DESCRIPTION =
  "AIと国土交通省データで不動産の資産価値・リスクを即時分析。取引価格の可視化、ハザード情報、AIによる10項目エリア分析、暮らしイメージ生成、PDF出力まで対応。不動産投資家・営業・購入検討者向けSaaS。";
// デフォルト OGP 画像（住所未指定の汎用版）— 静的画像を使用。動的OGPはpage.tsxで上書き
const OGP_IMAGE = `${SITE_URL}/ogp.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | 資産価値・リスクを瞬時に診断`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "AI不動産診断",
    "不動産資産価値",
    "不動産リスク分析",
    "不動産レポート",
    "取引価格 分析",
    "ハザードマップ 不動産",
    "エリア分析 AI",
    "不動産投資 ツール",
    "国土交通省 不動産情報",
    "不動産 坪単価",
    "不動産 PDF出力",
  ],
  authors: [{ name: "木下 開" }],
  creator: "木下 開",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | 資産価値・リスクを瞬時に診断`,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: OGP_IMAGE,
        width: 1200,
        height: 630,
        alt: "AI不動産診断レポート — 資産価値・リスクを瞬時に診断",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | 資産価値・リスクを瞬時に診断`,
    description: DEFAULT_DESCRIPTION,
    images: [OGP_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

// JSON-LD 構造化データ
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      inLanguage: "ja",
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
      inLanguage: "ja",
      description: DEFAULT_DESCRIPTION,
      offers: [
        {
          "@type": "Offer",
          name: "Guestプラン",
          price: "0",
          priceCurrency: "JPY",
          description: "登録不要・1日1回の無料診断",
        },
        {
          "@type": "Offer",
          name: "Freeプラン",
          price: "0",
          priceCurrency: "JPY",
          description: "Googleアカウント登録・1日3回の無料診断",
        },
        {
          "@type": "Offer",
          name: "Proプラン",
          price: "980",
          priceCurrency: "JPY",
          billingIncrement: "P1M",
          description: "無制限診断・AI全10項目・PDF出力",
        },
      ],
      featureList: [
        "取引価格の可視化・推移グラフ",
        "ハザードマップ連動リスク分析",
        "AIによる10項目エリア分析レポート",
        "暮らしイメージ画像生成",
        "PDFレポート出力",
        "検索履歴の自動保存",
      ],
      creator: {
        "@type": "Person",
        name: "木下 開",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
