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
      <body className="min-h-full flex flex-col">
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
