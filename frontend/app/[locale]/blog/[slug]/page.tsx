import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPostMeta, getAvailableLocales, getPostBySlug, type Locale } from "@/lib/blog";
import BlogMiniMapWrapper from "@/components/blog/BlogMiniMapWrapper";
import LanguageToggle from "@/components/LanguageToggle";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type Props = { params: Promise<{ locale: string; slug: string }> };

function asLocale(s: string): Locale {
  return s === "en" ? "en" : "ja";
}

function blogPathFor(locale: Locale, slug: string): string {
  return locale === "en" ? `${SITE_URL}/en/blog/${slug}` : `${SITE_URL}/blog/${slug}`;
}

export async function generateStaticParams() {
  // 日英いずれかで利用可能な slug の集合を返す。実際にどのロケール × slug の
  // 組み合わせで記事を持つかは、ページ本体で getPostBySlug(locale) が判断し、
  // 該当ファイルがなければ notFound() が呼ばれる。
  const slugs = new Set<string>();
  for (const post of getAllPostMeta("ja")) slugs.add(post.slug);
  for (const post of getAllPostMeta("en")) slugs.add(post.slug);
  return Array.from(slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = asLocale(rawLocale);
  const post = getPostBySlug(slug, locale);
  if (!post) return {};

  // ブログ専用 OGP 画像 (1200x630, summary_large_image) を絶対 URL で構築。
  // X / Slack / Facebook の OGP scraper はクロスオリジン取得を行うため、
  // 必ず絶対 URL を返す必要がある (相対パスだとデフォルトのサイトロゴに
  // フォールバックして「グレーアイコン」になる)。
  const ogImage = new URL(`${SITE_URL}/api/og/blog`);
  ogImage.searchParams.set("title", post.title);
  if (post.description) ogImage.searchParams.set("description", post.description);
  if (post.tags.length > 0) ogImage.searchParams.set("tags", post.tags.slice(0, 4).join(","));
  if (post.publishedAt) ogImage.searchParams.set("date", post.publishedAt);
  const ogImageUrl = ogImage.toString();

  // 翻訳済み記事のみ hreflang alternate を出す (未翻訳の言語は alternate に含めない)
  const available = getAvailableLocales(slug);
  const languages: Record<string, string> = {};
  if (available.includes("ja")) languages["ja"] = blogPathFor("ja", slug);
  if (available.includes("en")) languages["en"] = blogPathFor("en", slug);
  if (available.includes("ja")) languages["x-default"] = blogPathFor("ja", slug);

  const siteName = locale === "en" ? "Mekiki Research" : "物件目利きリサーチ";
  const canonical = blogPathFor(locale, slug);

  return {
    title: `${post.title} | ${siteName}`,
    description: post.description,
    alternates: { canonical, languages },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      tags: post.tags,
      locale: locale === "en" ? "en_US" : "ja_JP",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImageUrl],
    },
  };
}

function formatDate(iso: string, locale: Locale) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = asLocale(rawLocale);
  const post = getPostBySlug(slug, locale);
  if (!post) notFound();

  const isEn = locale === "en";
  const homeHref = isEn ? "/en" : "/";
  const blogHref = isEn ? "/en/blog" : "/blog";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";

  // この記事が翻訳済みのロケールを取得 (LanguageToggle が翻訳のない方向への
  // 切り替えを表示しないため)
  const availableLocales = getAvailableLocales(slug);

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

  const loc = post.primaryLocation;
  const researchHref = loc
    ? `${isEn ? "/en" : ""}/research?lat=${loc.lat}&lng=${loc.lng}&type=mansion`
    : null;

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
          <div className="ml-auto">
            <LanguageToggle currentLocale={locale} availableLocales={availableLocales} />
          </div>
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
              {formatDate(post.publishedAt, locale)}
            </time>
          )}
        </div>

        {/* Area map card (shown when primaryLocation is present) */}
        {loc && (
          <div className="mb-8 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              📍 {isEn ? "Target Area" : "対象エリア"}: {loc.name}
            </p>
            <BlogMiniMapWrapper
              primaryLocation={loc}
              secondaryLocations={post.secondaryLocations}
            />
            {researchHref && (
              <div className="mt-3">
                <Link
                  href={researchHref}
                  className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
                >
                  {isEn
                    ? "Analyze this area in β →"
                    : "β 版でこのエリアを調べる →"}
                </Link>
              </div>
            )}
          </div>
        )}

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
