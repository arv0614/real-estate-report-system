import type { Metadata } from "next";
import Link from "next/link";
import { getAllPostMeta } from "@/lib/blog";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return isEn
    ? {
        title: "Blog | Mekiki Research",
        description:
          "Insights on Japan real estate: how to use MLIT transaction data, read hazard maps, and analyze property values with AI.",
        alternates: { canonical: `${SITE_URL}/en/blog` },
        openGraph: {
          type: "website",
          url: `${SITE_URL}/en/blog`,
          title: "Blog | Mekiki Research",
          description:
            "Insights on Japan real estate: MLIT data, hazard maps, and AI-powered area analysis.",
        },
      }
    : {
        title: "ブログ | 物件目利きリサーチ",
        description:
          "マイホーム購入・不動産投資に役立つ情報を発信。国交省データの活用術・ハザードマップの見方・エリア相場分析など、データドリブンな不動産調査のノウハウを解説します。",
        alternates: { canonical: `${SITE_URL}/blog` },
        openGraph: {
          type: "website",
          url: `${SITE_URL}/blog`,
          title: "ブログ | 物件目利きリサーチ",
          description:
            "マイホーム購入・不動産投資に役立つ情報を発信。国交省データの活用術・ハザードマップの見方・エリア相場分析など。",
        },
      };
}

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  const posts = getAllPostMeta();
  const isEn = locale === "en";

  const homeHref = isEn ? "/en" : "/";
  const blogLabel = isEn ? "Blog" : "ブログ";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";
  const emptyMsg = isEn ? "No articles yet." : "記事がありません。";
  const subtitle = isEn
    ? "Insights on Japan real estate investing and home buying"
    : "マイホーム購入・不動産投資に役立つ情報を発信しています";

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
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{blogLabel}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        {posts.length === 0 ? (
          <p className="text-slate-500 text-sm">{emptyMsg}</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <Link href={`${isEn ? "/en" : ""}/blog/${post.slug}`} className="group block">
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2 leading-snug">
                    {post.title}
                  </h2>
                  {post.description && (
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-3">
                      {post.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {post.publishedAt && (
                      <time
                        dateTime={post.publishedAt}
                        className="text-xs text-slate-400"
                      >
                        {formatDate(post.publishedAt, locale)}
                      </time>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {serviceName}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href={homeHref} className="hover:text-slate-600 transition-colors">
              {isEn ? "Top" : "トップ"}
            </Link>
            <Link
              href={isEn ? "/en/terms" : "/terms"}
              className="hover:text-slate-600 transition-colors"
            >
              {isEn ? "Terms" : "利用規約"}
            </Link>
            <Link
              href={isEn ? "/en/privacy" : "/privacy"}
              className="hover:text-slate-600 transition-colors"
            >
              {isEn ? "Privacy" : "プライバシーポリシー"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
