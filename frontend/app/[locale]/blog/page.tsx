import type { Metadata } from "next";
import Link from "next/link";
import { ALL_LOCALES, getAllPostMeta, type Locale } from "@/lib/blog";
import BlogIndexClient from "@/components/blog/BlogIndexClient";
import LanguageToggle from "@/components/LanguageToggle";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = { params: Promise<{ locale: string }> };

function asLocale(s: string): Locale {
  return (ALL_LOCALES as string[]).includes(s) ? (s as Locale) : "ja";
}

const BLOG_INDEX_LABELS: Record<
  Locale,
  {
    title: string;
    description: string;
    blogLabel: string;
    serviceName: string;
    subtitle: string;
    emptyMsg: string;
    topLabel: string;
    termsLabel: string;
    privacyLabel: string;
  }
> = {
  ja: {
    title: "ブログ | 物件目利きリサーチ",
    description:
      "マイホーム購入・不動産投資に役立つ情報を発信。国交省データの活用術・ハザードマップの見方・エリア相場分析など。",
    blogLabel: "ブログ",
    serviceName: "物件目利きリサーチ",
    subtitle: "マイホーム購入・不動産投資に役立つ情報を発信しています",
    emptyMsg: "記事がありません。",
    topLabel: "トップ",
    termsLabel: "利用規約",
    privacyLabel: "プライバシーポリシー",
  },
  en: {
    title: "Blog | Mekiki Research",
    description:
      "Insights on Japan real estate: MLIT data, hazard maps, and AI-powered area analysis.",
    blogLabel: "Blog",
    serviceName: "Mekiki Research",
    subtitle: "Insights on Japan real estate investing and home buying",
    emptyMsg: "No articles yet.",
    topLabel: "Top",
    termsLabel: "Terms",
    privacyLabel: "Privacy",
  },
  "zh-TW": {
    title: "部落格 | 物件目利研究",
    description:
      "日本不動產購買與投資的洞察:國交省資料運用、災害地圖判讀、區域行情分析。",
    blogLabel: "部落格",
    serviceName: "物件目利研究",
    subtitle: "日本住宅購買與不動產投資的實用資訊",
    emptyMsg: "目前還沒有文章。",
    topLabel: "首頁",
    termsLabel: "服務條款",
    privacyLabel: "隱私權政策",
  },
  "zh-CN": {
    title: "博客 | 物件目利研究",
    description:
      "日本房地产购买与投资的洞察:国交省数据运用、灾害地图解读、区域行情分析。",
    blogLabel: "博客",
    serviceName: "物件目利研究",
    subtitle: "日本住房购买与房地产投资的实用资讯",
    emptyMsg: "目前还没有文章。",
    topLabel: "首页",
    termsLabel: "服务条款",
    privacyLabel: "隐私政策",
  },
};

function blogIndexUrlFor(locale: Locale): string {
  return locale === "ja" ? `${SITE_URL}/blog` : `${SITE_URL}/${locale}/blog`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = asLocale(rawLocale);
  const labels = BLOG_INDEX_LABELS[locale];
  const url = blogIndexUrlFor(locale);
  return {
    title: labels.title,
    description: labels.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: labels.title,
      description: labels.description,
    },
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = asLocale(rawLocale);
  const posts = getAllPostMeta(locale);
  const labels = BLOG_INDEX_LABELS[locale];

  const homeHref = locale === "ja" ? "/" : `/${locale}`;
  const { blogLabel, serviceName, subtitle, emptyMsg } = labels;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-2 group">
            <img
              src="/logo_mekiki_research.png"
              alt=""
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="text-base font-bold text-slate-800 group-hover:text-slate-600 transition-colors">
              {serviceName}
            </span>
          </Link>
          <div className="ml-auto">
            <LanguageToggle currentLocale={locale} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{blogLabel}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <BlogIndexClient posts={posts} locale={locale} emptyMsg={emptyMsg} />
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {serviceName}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href={homeHref} className="hover:text-slate-600 transition-colors">
              {labels.topLabel}
            </Link>
            <Link
              href={locale === "ja" ? "/terms" : `/${locale}/terms`}
              className="hover:text-slate-600 transition-colors"
            >
              {labels.termsLabel}
            </Link>
            <Link
              href={locale === "ja" ? "/privacy" : `/${locale}/privacy`}
              className="hover:text-slate-600 transition-colors"
            >
              {labels.privacyLabel}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
