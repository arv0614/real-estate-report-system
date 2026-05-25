import { AREAS } from "@/lib/areas";
import { ALL_LOCALES, getAllPostMeta, getAvailableLocales, type Locale } from "@/lib/blog";

// /sitemap.xml への rewrite ターゲット (next.config.ts で rewrites 設定)。
// [locale] セグメントによる動的ルーティングと衝突しないよう /api 配下に配置。
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

interface AlternateLink {
  hreflang: string;
  href: string;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  // hreflang annotations (Google 推奨のサイトマップ多言語アノテーション)。
  // 同一ページの全言語版を相互にリンクし、x-default も含める。
  alternates?: AlternateLink[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entryToXml(e: SitemapEntry): string {
  const parts: string[] = [`  <url>`, `    <loc>${escapeXml(e.loc)}</loc>`];
  if (e.alternates) {
    for (const a of e.alternates) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`,
      );
    }
  }
  if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
  if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
  parts.push(`  </url>`);
  return parts.join("\n");
}

/** ロケール付き完全修飾 URL を生成する (ja はプレフィックス無し = localePrefix:"as-needed")。 */
function urlFor(locale: Locale, pathNoLocale: string): string {
  return locale === "ja"
    ? `${SITE_URL}${pathNoLocale}`
    : `${SITE_URL}/${locale}${pathNoLocale}`;
}

/** 指定パスの全対応ロケール版を相互リンクした hreflang アノテーションを作る。 */
function buildAlternates(pathNoLocale: string, locales: Locale[]): AlternateLink[] {
  const links: AlternateLink[] = locales.map((loc) => ({
    hreflang: loc,
    href: urlFor(loc, pathNoLocale),
  }));
  // x-default は既定ロケール (ja) を指す。
  if (locales.includes("ja")) {
    links.push({ hreflang: "x-default", href: urlFor("ja", pathNoLocale) });
  }
  return links;
}

/**
 * 1 ページにつき、対応する全ロケール版を個別の <url> として展開する。
 * 各 <url> には同一の hreflang アノテーション一式 (自己参照 + x-default 含む) を付与する。
 * 単一ロケールのみのページ (alternates 不要) は alternates を省略する。
 */
function localizedEntries(
  pathNoLocale: string,
  locales: Locale[],
  opts: { lastmod?: string; changefreq?: SitemapEntry["changefreq"]; priority?: number },
): SitemapEntry[] {
  const alternates = locales.length > 1 ? buildAlternates(pathNoLocale, locales) : undefined;
  return locales.map((loc) => ({
    loc: urlFor(loc, pathNoLocale),
    lastmod: opts.lastmod,
    changefreq: opts.changefreq,
    priority: opts.priority,
    alternates,
  }));
}

export async function GET(): Promise<Response> {
  const now = new Date().toISOString();

  // 全ロケールに存在するページ (トップ / 静的ページ / ブログインデックス) は
  // localizedEntries で各言語版を hreflang アノテーション付きで展開する。
  const localizedPages: SitemapEntry[] = [
    ...localizedEntries("", [...ALL_LOCALES], { lastmod: now, changefreq: "weekly", priority: 1.0 }),
    ...localizedEntries("/about", [...ALL_LOCALES], { lastmod: now, changefreq: "monthly", priority: 0.8 }),
    ...localizedEntries("/blog", [...ALL_LOCALES], { lastmod: now, changefreq: "weekly", priority: 0.8 }),
    ...localizedEntries("/terms", [...ALL_LOCALES], { lastmod: now, changefreq: "yearly", priority: 0.3 }),
    ...localizedEntries("/privacy", [...ALL_LOCALES], { lastmod: now, changefreq: "yearly", priority: 0.3 }),
    ...localizedEntries("/licenses", [...ALL_LOCALES], { lastmod: now, changefreq: "yearly", priority: 0.2 }),
  ];

  // エリアレポートはロケール無しのルート直下 SSG ページ (言語版を持たない)。
  const areaEntries: SitemapEntry[] = AREAS.map((area) => ({
    loc: `${SITE_URL}/reports/${area.prefSlug}/${area.citySlug}`,
    lastmod: now,
    changefreq: "weekly",
    priority: 0.7,
  }));

  const blogEntries: SitemapEntry[] = [];
  try {
    // slug は全ロケール共通 (命名規約: <slug>.md / <slug>.en.md / ...)。
    // 全ロケールを走査して slug→最新 lastmod を集約し、記事ごとに
    // 翻訳が存在するロケール分だけ hreflang アノテーション付きで展開する。
    const lastmodBySlug = new Map<string, string>();
    for (const loc of ALL_LOCALES) {
      for (const post of getAllPostMeta(loc)) {
        const lm = (post.publishedAt ? new Date(post.publishedAt) : new Date()).toISOString();
        const prev = lastmodBySlug.get(post.slug);
        if (!prev || lm > prev) lastmodBySlug.set(post.slug, lm);
      }
    }
    for (const [slug, lastmod] of lastmodBySlug) {
      const locales = getAvailableLocales(slug);
      blogEntries.push(
        ...localizedEntries(`/blog/${slug}`, locales, {
          lastmod,
          changefreq: "monthly",
          priority: 0.7,
        }),
      );
    }
  } catch (err) {
    console.warn("[sitemap] Failed to enumerate blog posts:", err);
  }

  const all = [...localizedPages, ...areaEntries, ...blogEntries];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${all.map(entryToXml).join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
