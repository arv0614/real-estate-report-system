"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/blog";

const BlogMap = dynamic(() => import("./BlogMap"), { ssr: false });

interface Props {
  posts: PostMeta[];
  locale: string;
  emptyMsg: string;
}

type SortOrder = "newest" | "oldest";

const NEW_BADGE_DAYS = 14;

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isNewPost(iso: string): boolean {
  if (!iso) return false;
  const published = new Date(iso).getTime();
  if (Number.isNaN(published)) return false;
  const ageMs = Date.now() - published;
  return ageMs >= 0 && ageMs <= NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

export default function BlogIndexClient({ posts, locale, emptyMsg }: Props) {
  const isEn = locale === "en";

  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  const areaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of posts) {
      if (p.primaryLocation?.name) names.add(p.primaryLocation.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const filtered =
      areaFilter === "all"
        ? posts
        : posts.filter((p) => p.primaryLocation?.name === areaFilter);

    return [...filtered].sort((a, b) => {
      if (sortOrder === "newest") return a.publishedAt < b.publishedAt ? 1 : -1;
      return a.publishedAt > b.publishedAt ? 1 : -1;
    });
  }, [posts, sortOrder, areaFilter]);

  // Most-recent post (across all posts) — used to highlight the latest article on the map.
  const latestSlug = useMemo(() => {
    const sorted = [...posts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    return sorted[0]?.slug;
  }, [posts]);

  const sortLabel = isEn ? "Sort" : "並び替え";
  const areaLabel = isEn ? "Area" : "エリア";
  const allAreasLabel = isEn ? "All areas" : "すべてのエリア";
  const newestLabel = isEn ? "Newest first" : "新しい順";
  const oldestLabel = isEn ? "Oldest first" : "古い順";
  const newBadgeLabel = "NEW";
  const countLabel = isEn
    ? `${visiblePosts.length} ${visiblePosts.length === 1 ? "post" : "posts"}`
    : `${visiblePosts.length}件`;

  return (
    <>
      {/* Map section — always visible */}
      <div className="mb-8">
        <BlogMap posts={visiblePosts} locale={locale} latestSlug={latestSlug} />
      </div>

      {/* Filter & sort controls */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-1">
          <label htmlFor="blog-sort" className="text-xs font-semibold text-slate-500 shrink-0">
            {sortLabel}
          </label>
          <select
            id="blog-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
          >
            <option value="newest">{newestLabel}</option>
            <option value="oldest">{oldestLabel}</option>
          </select>
        </div>

        {areaOptions.length > 0 && (
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="blog-area" className="text-xs font-semibold text-slate-500 shrink-0">
              {areaLabel}
            </label>
            <select
              id="blog-area"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors flex-1 min-w-0"
            >
              <option value="all">{allAreasLabel}</option>
              {areaOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="text-xs text-slate-400 shrink-0 sm:ml-auto">{countLabel}</span>
      </div>

      {/* Article list */}
      {visiblePosts.length === 0 ? (
        <p className="text-slate-500 text-sm">{emptyMsg}</p>
      ) : (
        <div className="space-y-6">
          {visiblePosts.map((post) => {
            const showNew = isNewPost(post.publishedAt);
            return (
              <article
                key={post.slug}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <Link
                  href={`${isEn ? "/en" : ""}/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="flex items-start gap-2 mb-2">
                    {showNew && (
                      <span className="shrink-0 inline-flex items-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                        {newBadgeLabel}
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {post.title}
                    </h2>
                  </div>
                  {post.description && (
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-3">
                      {post.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt} className="text-xs text-slate-400">
                        {formatDate(post.publishedAt, locale)}
                      </time>
                    )}
                    {post.primaryLocation?.name && (
                      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <span aria-hidden>📍</span>
                        {post.primaryLocation.name}
                      </span>
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
            );
          })}
        </div>
      )}
    </>
  );
}
