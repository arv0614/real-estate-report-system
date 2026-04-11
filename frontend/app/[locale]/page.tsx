// Server Component — no "use client"
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import HomeClient from "../HomeClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ address?: string; score?: string; price?: string; flood?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const address = sp.address;

  if (!address) {
    return {}; // locale layout のデフォルトメタデータを使用
  }

  const ogUrl = new URL(`${SITE_URL}/api/og`);
  ogUrl.searchParams.set("address", address);
  if (sp.score) ogUrl.searchParams.set("score", sp.score);
  if (sp.price) ogUrl.searchParams.set("price", sp.price);
  if (sp.flood) ogUrl.searchParams.set("flood", sp.flood);
  const ogImageUrl = ogUrl.toString();

  const siteName = locale === "en" ? "Mekiki Research" : "物件目利きリサーチ";
  const title = `${address} | ${siteName}`;
  return {
    title,
    openGraph: {
      title,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImageUrl],
    },
  };
}

export default function HomePage() {
  return <HomeClient />;
}
