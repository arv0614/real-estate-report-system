import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ProposalGeneratorClient from "./ProposalGeneratorClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProposalGenerator" });
  const path = locale === "ja" ? "/proposal-generator" : `/${locale}/proposal-generator`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // 顧客の個人情報を入力するツールのため検索エンジンには出さない
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}${path}` },
  };
}

export default function ProposalGeneratorPage() {
  return <ProposalGeneratorClient />;
}
