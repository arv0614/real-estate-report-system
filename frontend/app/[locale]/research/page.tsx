import type { Metadata } from "next";
import { ResearchClient } from "@/components/research/ResearchClient";
import type { PropertyType } from "@/types/research";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const isEn = locale === "en";

  const grade      = typeof sp.grade      === "string" ? sp.grade      : null;
  const area       = typeof sp.area       === "string" ? sp.area       : null;
  const score      = typeof sp.score      === "string" ? sp.score      : null;
  const mode       = typeof sp.mode       === "string" ? sp.mode       : "home";
  const type       = typeof sp.type       === "string" ? sp.type       : "mansion";
  const autoFilled = sp.autoFilled === "true";

  const defaultTitle = isEn ? "Property Research (β)" : "物件リサーチ（β）";
  const defaultDesc  = isEn
    ? "Enter address, price, and area to get a market comparison, risk score, and future outlook in 30 seconds."
    : "住所・価格・専有面積を入力するだけで、相場比較・リスク・将来性スコアを30秒で表示します。";

  const ogImageUrl = grade
    ? `${SITE_URL}/api/research-og?grade=${encodeURIComponent(grade)}${area ? `&area=${encodeURIComponent(area)}` : ""}${score ? `&score=${encodeURIComponent(score)}` : ""}&mode=${mode}&type=${type}${autoFilled ? "&autoFilled=true" : ""}`
    : `${SITE_URL}/api/og?address=${encodeURIComponent(isEn ? "Property Analysis" : "物件リサーチ")}`;

  const title = grade && area
    ? (isEn ? `${area} — Grade ${grade} | Property Research` : `${area} 評価${grade} | 物件リサーチ`)
    : defaultTitle;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: defaultDesc,
    openGraph: {
      title,
      description: defaultDesc,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: defaultDesc,
      images: [ogImageUrl],
    },
  };
}

export default async function ResearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const isEn = locale === "en";

  const latStr    = typeof sp.lat    === "string" ? sp.lat    : null;
  const lngStr    = typeof sp.lng    === "string" ? sp.lng    : null;
  const typeStr   = typeof sp.type   === "string" ? sp.type   : null;
  const actionStr = typeof sp.action === "string" ? sp.action : null;

  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;
  const hasCoords = !isNaN(lat) && !isNaN(lng);

  const initialPropertyType: PropertyType =
    typeStr === "house" ? "house" : "mansion";

  const initialAction = actionStr === "area" && hasCoords ? "area" : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <ResearchClient
        isEn={isEn}
        locale={locale}
        initialCenter={hasCoords ? { lat, lng } : null}
        initialPropertyType={initialPropertyType}
        initialAction={initialAction as "area" | null}
      />
    </main>
  );
}
