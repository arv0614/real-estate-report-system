import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export interface BlogPostLocation {
  lat: number;
  lng: number;
  name: string;
  areaCode?: string;
}

export type PostMeta = {
  slug: string;
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

export function getAllPostMeta(): PostMeta[] {
  ensureBlogDir();
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  return files
    .map((filename) => {
      const slug = filename.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
      const { data } = matter(raw);
      return {
        slug,
        title: data.title ?? slug,
        description: data.description ?? "",
        publishedAt: data.publishedAt ?? "",
        tags: data.tags ?? [],
        coverImage: data.coverImage,
        primaryLocation: parseLocation(data.primaryLocation),
        secondaryLocations: parseSecondaryLocations(data.secondaryLocations),
        excludeFromMap: data.excludeFromMap === true,
      } satisfies PostMeta;
    })
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  ensureBlogDir();
  const filepath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;

  const raw = fs.readFileSync(filepath, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
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
