"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/blog";
import { PREFECTURES, prefectureForLocation, prefectureLabel } from "@/lib/blog/prefecture";

const BlogMap = dynamic(() => import("./BlogMap"), { ssr: false });

interface Props {
  posts: PostMeta[];
  locale: string;
  emptyMsg: string;
}

type SortOrder = "newest" | "oldest";

const NEW_BADGE_TOP_N = 3;

const DATE_LOCALE_TAG: Record<string, string> = {
  ja: "ja-JP",
  en: "en-US",
  "zh-TW": "zh-TW",
  "zh-CN": "zh-CN",
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(DATE_LOCALE_TAG[locale] ?? "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const LIST_LABELS: Record<
  string,
  {
    sort: string;
    area: string;
    allAreas: string;
    prefecture: string;
    allPrefectures: string;
    newest: string;
    oldest: string;
    postsSingular?: string;
    postsPlural?: string;
    countSuffix: string;
  }
> = {
  ja: { sort: "並び替え", area: "エリア", allAreas: "すべてのエリア", prefecture: "都道府県", allPrefectures: "すべての地域", newest: "新しい順", oldest: "古い順", countSuffix: "件" },
  en: { sort: "Sort", area: "Area", allAreas: "All areas", prefecture: "Prefecture", allPrefectures: "All regions", newest: "Newest first", oldest: "Oldest first", postsSingular: "post", postsPlural: "posts", countSuffix: "" },
  "zh-TW": { sort: "排序", area: "區域", allAreas: "所有區域", prefecture: "都道府縣", allPrefectures: "所有地區", newest: "由新至舊", oldest: "由舊至新", countSuffix: "篇" },
  "zh-CN": { sort: "排序", area: "区域", allAreas: "所有区域", prefecture: "都道府县", allPrefectures: "所有地区", newest: "由新到旧", oldest: "由旧到新", countSuffix: "篇" },
};

export default function BlogIndexClient({ posts, locale, emptyMsg }: Props) {
  const labels = LIST_LABELS[locale] ?? LIST_LABELS.ja;
  const localePrefix = locale === "ja" ? "" : `/${locale}`;

  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [prefectureFilter, setPrefectureFilter] = useState<string>("all");

  // 都道府県: lat/lng ベースの判定（frontend/lib/blog/prefecture.ts）を使うため
  // 表記揺れのある primaryLocation.name や翻訳済みロケール（en/zh-TW/zh-CN）でも
  // 常に安定して分類できる。
  const prefectureOptions = useMemo(() => {
    const present = new Set<string>();
    for (const p of posts) {
      const pref = prefectureForLocation(p.primaryLocation);
      if (pref) present.add(pref);
    }
    // 北から南への標準的な都道府県順で表示（アルファベット順より地理的に把握しやすい）
    return PREFECTURES.filter((p) => present.has(p.name)).map((p) => p.name);
  }, [posts]);

  // 都道府県を選ぶと、その都道府県内の記事だけに市区町村フィルタの選択肢も絞り込む
  const postsInPrefecture = useMemo(() => {
    if (prefectureFilter === "all") return posts;
    return posts.filter((p) => prefectureForLocation(p.primaryLocation) === prefectureFilter);
  }, [posts, prefectureFilter]);

  const areaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of postsInPrefecture) {
      if (p.primaryLocation?.name) names.add(p.primaryLocation.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }, [postsInPrefecture]);

  const visiblePosts = useMemo(() => {
    const filtered =
      areaFilter === "all"
        ? postsInPrefecture
        : postsInPrefecture.filter((p) => p.primaryLocation?.name === areaFilter);

    return [...filtered].sort((a, b) => {
      if (sortOrder === "newest") return a.publishedAt < b.publishedAt ? 1 : -1;
      return a.publishedAt > b.publishedAt ? 1 : -1;
    });
  }, [postsInPrefecture, sortOrder, areaFilter]);

  function handlePrefectureChange(value: string) {
    setPrefectureFilter(value);
    // 都道府県を切り替えたら、別の都道府県に属していた市区町村フィルタは意味を
    // 失うためリセットする（両フィルタの組み合わせで0件になるのを防ぐ）。
    setAreaFilter("all");
  }

  // Top-N most-recent posts (across all posts) — used to highlight the latest articles
  // in both the list (NEW badge) and on the map (red pin + NEW badge).
  const latestSlugs = useMemo(() => {
    const sorted = [...posts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    return sorted.slice(0, NEW_BADGE_TOP_N).map((p) => p.slug);
  }, [posts]);
  const latestSlugSet = useMemo(() => new Set(latestSlugs), [latestSlugs]);

  const sortLabel = labels.sort;
  const areaLabel = labels.area;
  const allAreasLabel = labels.allAreas;
  const prefectureLabelText = labels.prefecture;
  const allPrefecturesLabel = labels.allPrefectures;
  const newestLabel = labels.newest;
  const oldestLabel = labels.oldest;
  const newBadgeLabel = "NEW";
  const countLabel =
    locale === "en"
      ? `${visiblePosts.length} ${visiblePosts.length === 1 ? labels.postsSingular : labels.postsPlural}`
      : `${visiblePosts.length}${labels.countSuffix}`;

  return (
    <>
      {/* Map section — always visible */}
      <div className="mb-8">
        <BlogMap posts={visiblePosts} locale={locale} latestSlugs={latestSlugs} />
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

        {prefectureOptions.length > 0 && (
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="blog-prefecture" className="text-xs font-semibold text-slate-500 shrink-0">
              {prefectureLabelText}
            </label>
            <select
              id="blog-prefecture"
              value={prefectureFilter}
              onChange={(e) => handlePrefectureChange(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors flex-1 min-w-0"
            >
              <option value="all">{allPrefecturesLabel}</option>
              {prefectureOptions.map((name) => (
                <option key={name} value={name}>
                  {prefectureLabel(name, locale)}
                </option>
              ))}
            </select>
          </div>
        )}

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
            const showNew = latestSlugSet.has(post.slug);
            return (
              <article
                key={post.slug}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <Link
                  href={`${localePrefix}/blog/${post.slug}`}
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
