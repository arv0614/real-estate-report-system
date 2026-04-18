import type { Metadata } from "next";
import { ResearchClient } from "@/components/research/ResearchClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    metadataBase: new URL(SITE_URL),
    title: isEn ? "Property Research (β)" : "物件リサーチ（β）",
    description: isEn
      ? "Enter address, price, and area to get a market comparison, risk score, and future outlook in 30 seconds."
      : "住所・価格・専有面積を入力するだけで、相場比較・リスク・将来性スコアを30秒で表示します。",
  };
}

export default async function ResearchPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";
  return (
    <main className="min-h-screen bg-slate-50">
      <ResearchClient isEn={isEn} />
    </main>
  );
}
