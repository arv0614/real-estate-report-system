import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

// 日英の MD ファイルを 1 ディレクトリで管理する命名規約:
//   - <slug>.md     → 日本語 (ja, デフォルト)
//   - <slug>.en.md  → 英語   (en)
// 拡張子から locale を判定する。
const EN_SUFFIX = ".en.md";
const JA_SUFFIX = ".md";

export interface BlogPostLocation {
  lat: number;
  lng: number;
  name: string;
  areaCode?: string;
}

export type Locale = "ja" | "en";

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

function isJaFile(filename: string): boolean {
  return filename.endsWith(JA_SUFFIX) && !filename.endsWith(EN_SUFFIX);
}

function filenameToSlug(filename: string, locale: Locale): string {
  return locale === "en"
    ? filename.replace(/\.en\.md$/, "")
    : filename.replace(/\.md$/, "");
}

function slugToFilename(slug: string, locale: Locale): string {
  return locale === "en" ? `${slug}.en.md` : `${slug}.md`;
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
 * - locale="ja": *.md (但し *.en.md を除く)
 * - locale="en": *.en.md
 *
 * 英語ロケールでは英訳済み記事のみが返る (未翻訳記事は EN サイトに出さない)。
 */
export function getAllPostMeta(locale: Locale = "ja"): PostMeta[] {
  ensureBlogDir();
  const files = fs.readdirSync(BLOG_DIR);
  const targetFiles = locale === "en" ? files.filter(isEnFile) : files.filter(isJaFile);

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
 * 指定 slug が日本語/英語のどちらで利用可能かを返す。
 * Sitemap 生成や hreflang メタデータ生成に使う。
 */
export function getAvailableLocales(slug: string): Locale[] {
  ensureBlogDir();
  const out: Locale[] = [];
  if (fs.existsSync(path.join(BLOG_DIR, slugToFilename(slug, "ja")))) out.push("ja");
  if (fs.existsSync(path.join(BLOG_DIR, slugToFilename(slug, "en")))) out.push("en");
  return out;
}
