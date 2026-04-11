// Server Component — no "use client"
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = {
  searchParams: Promise<{ address?: string; score?: string; price?: string; flood?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const address = params.address;

  if (!address) {
    return {}; // layout.tsx のデフォルトメタデータを使用
  }

  const ogUrl = new URL(`${SITE_URL}/api/og`);
  ogUrl.searchParams.set("address", address);
  if (params.score) ogUrl.searchParams.set("score", params.score);
  if (params.price) ogUrl.searchParams.set("price", params.price);
  if (params.flood) ogUrl.searchParams.set("flood", params.flood);
  const ogImageUrl = ogUrl.toString();

  const title = `${address} | 物件目利きリサーチ`;
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
