import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
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

const SITE_NAME = "物件目利きリサーチ";
const DEFAULT_DESCRIPTION =
  "国土交通省「不動産情報ライブラリ」の公式データ × 不動産鑑定士・エージェントの知見を組み合わせ、物件の真の価値とリスクを目利きします。取引価格の可視化・推移分析、ハザードリスク判定、10項目エリア特性・専門家見解レポート、PDF出力まで対応。不動産投資家・営業・購入検討者向け精密調査支援ツール。";
// デフォルト OGP 画像（住所未指定の汎用版）— 静的画像を使用。動的OGPはpage.tsxで上書き
const OGP_IMAGE = `${SITE_URL}/ogp.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "不動産調査レポート",
    "不動産資産価値",
    "不動産リスク分析",
    "不動産 取引価格",
    "ハザードマップ 不動産",
    "エリア分析 不動産",
    "不動産投資 調査",
    "国土交通省 不動産情報",
    "不動産 坪単価",
    "不動産 PDF出力",
    "不動産鑑定 ツール",
  ],
  authors: [{ name: "木下 開" }],
  creator: "木下 開",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: OGP_IMAGE,
        width: 1200,
        height: 630,
        alt: "物件目利きリサーチ — 国交省データとプロの目利きによる不動産精密調査",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | 国交省データとプロの目利きによる不動産精密調査`,
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
          description: "登録不要・1日1回の無料調査",
        },
        {
          "@type": "Offer",
          name: "Freeプラン",
          price: "0",
          priceCurrency: "JPY",
          description: "Googleアカウント登録・1日3回の無料調査",
        },
        {
          "@type": "Offer",
          name: "Proプラン",
          price: "980",
          priceCurrency: "JPY",
          billingIncrement: "P1M",
          description: "無制限調査・10項目エリア特性レポート・PDF出力",
        },
      ],
      featureList: [
        "取引価格の可視化・推移グラフ",
        "ハザードマップ連動リスク分析",
        "10項目エリア特性・専門家見解レポート",
        "暮らしイメージ生成",
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
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
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
