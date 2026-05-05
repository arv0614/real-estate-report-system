import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

// 多言語 MD ファイルを 1 ディレクトリで管理する命名規約:
//   - <slug>.md         → 日本語 (ja, デフォルト)
//   - <slug>.en.md      → 英語   (en)
//   - <slug>.zh-TW.md   → 繁体中文 (zh-TW)
//   - <slug>.zh-CN.md   → 簡体中文 (zh-CN)
// 拡張子から locale を判定する。
const EN_SUFFIX = ".en.md";
const ZH_TW_SUFFIX = ".zh-TW.md";
const ZH_CN_SUFFIX = ".zh-CN.md";
const JA_SUFFIX = ".md";

export interface BlogPostLocation {
  lat: number;
  lng: number;
  name: string;
  areaCode?: string;
}

export { ALL_LOCALES } from "./locale";
export type { Locale } from "./locale";

import type { Locale } from "./locale";
import { ALL_LOCALES } from "./locale";

export type PostMeta = {
  slug: string;
  locale: Locale;
  title: string;
  description: string;
  publishedAt: string;
  tags: string[];
  coverImage?: string;
  primaryLocation?: BlogPostLocation;
  secondaryLocations?: BlogPostLocation[];
  excludeFromMap?: boolean;
};

export type Post = PostMeta & {
  content: string;
};

function parseLocation(raw: unknown): BlogPostLocation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.lat !== "number" || typeof r.lng !== "number") return undefined;
  return {
    lat: r.lat,
    lng: r.lng,
    name: typeof r.name === "string" ? r.name : "",
    areaCode: typeof r.areaCode === "string" ? r.areaCode : undefined,
  };
}

function parseSecondaryLocations(raw: unknown): BlogPostLocation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const locs = raw.map(parseLocation).filter((l): l is BlogPostLocation => l !== undefined);
  return locs.length > 0 ? locs : undefined;
}

function ensureBlogDir() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }
}

function isEnFile(filename: string): boolean {
  return filename.endsWith(EN_SUFFIX);
}

function isZhTwFile(filename: string): boolean {
  return filename.endsWith(ZH_TW_SUFFIX);
}

function isZhCnFile(filename: string): boolean {
  return filename.endsWith(ZH_CN_SUFFIX);
}

function isJaFile(filename: string): boolean {
  return (
    filename.endsWith(JA_SUFFIX) &&
    !filename.endsWith(EN_SUFFIX) &&
    !filename.endsWith(ZH_TW_SUFFIX) &&
    !filename.endsWith(ZH_CN_SUFFIX)
  );
}

function filenameToSlug(filename: string, locale: Locale): string {
  switch (locale) {
    case "en":
      return filename.replace(/\.en\.md$/, "");
    case "zh-TW":
      return filename.replace(/\.zh-TW\.md$/, "");
    case "zh-CN":
      return filename.replace(/\.zh-CN\.md$/, "");
    default:
      return filename.replace(/\.md$/, "");
  }
}

function slugToFilename(slug: string, locale: Locale): string {
  switch (locale) {
    case "en":
      return `${slug}.en.md`;
    case "zh-TW":
      return `${slug}.zh-TW.md`;
    case "zh-CN":
      return `${slug}.zh-CN.md`;
    default:
      return `${slug}.md`;
  }
}

function fileFilterFor(locale: Locale): (filename: string) => boolean {
  switch (locale) {
    case "en":
      return isEnFile;
    case "zh-TW":
      return isZhTwFile;
    case "zh-CN":
      return isZhCnFile;
    default:
      return isJaFile;
  }
}

function parseFrontmatter(filename: string, locale: Locale): PostMeta {
  const slug = filenameToSlug(filename, locale);
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const { data } = matter(raw);
  return {
    slug,
    locale,
    title: data.title ?? slug,
    description: data.description ?? "",
    publishedAt: data.publishedAt ?? "",
    tags: data.tags ?? [],
    coverImage: data.coverImage,
    primaryLocation: parseLocation(data.primaryLocation),
    secondaryLocations: parseSecondaryLocations(data.secondaryLocations),
    excludeFromMap: data.excludeFromMap === true,
  } satisfies PostMeta;
}

/**
 * 指定 locale の全記事メタデータを取得する。
 * - locale="ja":    *.md (但し *.en.md / *.zh-TW.md / *.zh-CN.md を除く)
 * - locale="en":    *.en.md
 * - locale="zh-TW": *.zh-TW.md
 * - locale="zh-CN": *.zh-CN.md
 *
 * 翻訳が存在しない記事は、そのロケールでは返らない (未翻訳記事はそのサイトに出さない)。
 */
export function getAllPostMeta(locale: Locale = "ja"): PostMeta[] {
  ensureBlogDir();
  const files = fs.readdirSync(BLOG_DIR);
  const targetFiles = files.filter(fileFilterFor(locale));

  return targetFiles
    .map((f) => parseFrontmatter(f, locale))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/**
 * slug + locale で記事本体を取得する。
 * - locale="ja": <slug>.md
 * - locale="en": <slug>.en.md
 *
 * 該当ファイルがなければ null を返す。EN で未翻訳の記事は null となり、
 * 呼び出し側で notFound() を呼ぶことで 404 / 未翻訳ページの分岐が可能。
 */
export function getPostBySlug(slug: string, locale: Locale = "ja"): Post | null {
  ensureBlogDir();
  const filename = slugToFilename(slug, locale);
  const filepath = path.join(BLOG_DIR, filename);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    locale,
    title: data.title ?? slug,
    description: data.description ?? "",
    publishedAt: data.publishedAt ?? "",
    tags: data.tags ?? [],
    coverImage: data.coverImage,
    primaryLocation: parseLocation(data.primaryLocation),
    secondaryLocations: parseSecondaryLocations(data.secondaryLocations),
    excludeFromMap: data.excludeFromMap === true,
    content,
  };
}

/**
 * 指定 slug が ja / en / zh-TW / zh-CN のどのロケールで利用可能かを返す。
 * Sitemap 生成や hreflang メタデータ生成に使う。
 */
export function getAvailableLocales(slug: string): Locale[] {
  ensureBlogDir();
  return ALL_LOCALES.filter((loc) =>
    fs.existsSync(path.join(BLOG_DIR, slugToFilename(slug, loc))),
  );
}
