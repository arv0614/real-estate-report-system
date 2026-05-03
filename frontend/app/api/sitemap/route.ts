import { AREAS } from "@/lib/areas";
import { getAllPostMeta } from "@/lib/blog";

// /sitemap.xml への rewrite ターゲット (next.config.ts で rewrites 設定)。
// [locale] セグメントによる動的ルーティングと衝突しないよう /api 配下に配置。
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
