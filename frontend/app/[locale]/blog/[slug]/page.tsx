import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPostMeta, getPostBySlug } from "@/lib/blog";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  return getAllPostMeta().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} | 物件目利きリサーチ`,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/blog/${slug}`,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      tags: post.tags,
    },
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const isEn = locale === "en";
  const homeHref = isEn ? "/en" : "/";
  const blogHref = isEn ? "/en/blog" : "/blog";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    url: `${SITE_URL}/blog/${slug}`,
    author: {
      "@type": "Organization",
      name: "物件目利きリサーチ",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "物件目利きリサーチ",
      url: SITE_URL,
    },
    keywords: post.tags.join(", "),
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
          <span className="text-slate-300">/</span>
          <Link
            href={blogHref}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {isEn ? "Blog" : "ブログ"}
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Article header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-3">
            {post.title}
          </h1>
          {post.publishedAt && (
            <time dateTime={post.publishedAt} className="text-sm text-slate-400">
              {formatDate(post.publishedAt)}
            </time>
          )}
        </div>

        {/* Markdown body */}
        <article className="prose prose-slate prose-sm sm:prose-base max-w-none
          prose-headings:font-bold prose-headings:text-slate-900
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-slate-700 prose-p:leading-relaxed
          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-900
          prose-ul:pl-5 prose-ol:pl-5
          prose-li:text-slate-700 prose-li:leading-relaxed
          prose-table:text-sm prose-thead:bg-slate-100
          prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold
          prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-slate-100
          prose-hr:border-slate-200 prose-hr:my-8
          prose-blockquote:border-l-4 prose-blockquote:border-blue-200 prose-blockquote:pl-4 prose-blockquote:text-slate-600
          prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-sm
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </article>

        {/* CTA */}
        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-xl px-6 py-6 text-center">
          <p className="font-bold text-slate-800 mb-1">
            {isEn
              ? "Try Mekiki Research for free"
              : "物件目利きリサーチを無料で試してみましょう"}
          </p>
          <p className="text-sm text-slate-600 mb-4">
            {isEn
              ? "Enter any address in Japan — get price data, hazard risk, and an AI area report in 30 seconds."
              : "住所を入力するだけで、相場・ハザードリスク・AIレポートが30秒で確認できます"}
          </p>
          <Link
            href={homeHref}
            className="inline-block bg-blue-600 text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isEn ? "Start for free →" : "無料で調査する →"}
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link
            href={blogHref}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            {isEn ? "← Back to Blog" : "← ブログ一覧に戻る"}
          </Link>
        </div>
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
