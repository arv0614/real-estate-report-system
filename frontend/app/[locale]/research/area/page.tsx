import type { Metadata } from "next";
import { AreaClient } from "@/components/research/AreaClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  const title = isEn ? "Area Summary | Property Research" : "エリアサマリー | 物件リサーチ";
  const desc  = isEn
    ? "Explore market data, disaster risk, and population trends for any area in Japan."
    : "エリアの相場・災害リスク・人口動態を地図から確認できます。";
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: desc,
    openGraph: { title, description: desc },
  };
}

export default async function AreaPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const isEn = locale === "en";

  const latStr  = typeof sp.lat  === "string" ? sp.lat  : null;
  const lngStr  = typeof sp.lng  === "string" ? sp.lng  : null;
  const typeStr = typeof sp.type === "string" ? sp.type : null;
  const lat = latStr ? parseFloat(latStr) : null;
  const lng = lngStr ? parseFloat(lngStr) : null;
  const initialType = typeStr === "house" ? "house" : typeStr === "mansion" ? "mansion" : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <AreaClient
        initialLat={lat && isFinite(lat) ? lat : null}
        initialLng={lng && isFinite(lng) ? lng : null}
        initialType={initialType}
        isEn={isEn}
        locale={locale}
      />
    </main>
  );
}
