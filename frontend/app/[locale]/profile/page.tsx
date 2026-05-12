import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale === "en") {
    return {
      title: "White-Label Settings | Mekiki Research",
      description: "Customize PDF report headers with your own company name and logo (Pro plan).",
      robots: { index: false, follow: false },
      alternates: { canonical: `${SITE_URL}/en/profile` },
    };
  }
  return {
    title: "ホワイトラベル設定 | 物件目利きリサーチ",
    description: "PDFレポートのヘッダーに自社の社名とロゴを表示する設定（Proプラン）。",
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}/profile` },
  };
}

export default function ProfilePage() {
  return <ProfileClient />;
}
