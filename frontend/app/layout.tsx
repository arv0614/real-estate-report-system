import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import PostHogInit from "@/components/PostHogInit";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

// NOTE: lang="ja" is set statically here (default locale).
// For the English version (/en/*), the [locale] layout overrides OGP/hreflang
// metadata to signal the correct language to search engines.
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
      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || "GTM-5ZNNGVZQ"} />
      {/*
        gtag.js を GTM と並行して直接読み込む。
        GTM 側は既に GA4 設定タグ / Enhanced Measurement で自動収集（page_view 等）を
        担っているため、ここでの config は send_page_view:false で二重計測を防ぎ、
        window.gtag("event", ...) （lib/gtag.ts の gtagEvent）が直接 GA4 に届く経路だけを
        追加する（GTM コンテナ側のカスタムイベント設定に依存しない）。
      */}
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
          `,
        }}
      />
      <Script
        id="ga4-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <body className="min-h-full flex flex-col">
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
