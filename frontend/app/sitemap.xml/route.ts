import { AREAS } from "@/lib/areas";
import { getAllPostMeta } from "@/lib/blog";

// Next.js 16 の metadata route (`app/sitemap.ts`) は next-intl の `[locale]`
// セグメントと相互作用して `/sitemap.xml` が 404 になる事象が発生したため、
// 明示的な Route Handler に置き換えた。常に最新のブログ記事一覧を返す。
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
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
  if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
  if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
  parts.push(`  </url>`);
  return parts.join("\n");
}

export async function GET(): Promise<Response> {
  const now = new Date().toISOString();

  const staticEntries: SitemapEntry[] = [
    { loc: SITE_URL, lastmod: now, changefreq: "weekly", priority: 1.0 },
    { loc: `${SITE_URL}/about`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${SITE_URL}/terms`, lastmod: now, changefreq: "yearly", priority: 0.3 },
    { loc: `${SITE_URL}/privacy`, lastmod: now, changefreq: "yearly", priority: 0.3 },
    { loc: `${SITE_URL}/licenses`, lastmod: now, changefreq: "yearly", priority: 0.2 },
    { loc: `${SITE_URL}/blog`, lastmod: now, changefreq: "weekly", priority: 0.8 },
  ];

  const areaEntries: SitemapEntry[] = AREAS.map((area) => ({
    loc: `${SITE_URL}/reports/${area.prefSlug}/${area.citySlug}`,
    lastmod: now,
    changefreq: "weekly",
    priority: 0.7,
  }));

  // ブログ記事は読み取りに失敗しても sitemap 全体を 500 にしないよう try/catch
  let blogEntries: SitemapEntry[] = [];
  try {
    blogEntries = getAllPostMeta().map((post) => ({
      loc: `${SITE_URL}/blog/${post.slug}`,
      lastmod: (post.publishedAt ? new Date(post.publishedAt) : new Date()).toISOString(),
      changefreq: "monthly",
      priority: 0.7,
    }));
  } catch (err) {
    console.warn("[sitemap] Failed to enumerate blog posts:", err);
  }

  const all = [...staticEntries, ...areaEntries, ...blogEntries];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map(entryToXml).join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
