"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { PostMeta } from "@/lib/blog";

const BlogMap = dynamic(() => import("./BlogMap"), { ssr: false });

interface Props {
  posts: PostMeta[];
  locale: string;
  labels: {
    listTab: string;
    mapTab: string;
  };
}

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexClient({ posts, locale, labels }: Props) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<"list" | "map">(
    searchParams.get("view") === "map" ? "map" : "list"
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === "map") {
      params.set("view", "map");
    } else {
      params.delete("view");
    }
    const newUrl =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState(null, "", newUrl);
  }, [view]);

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView("list")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "list"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📋 {labels.listTab}
        </button>
        <button
          onClick={() => setView("map")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "map"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🗾 {labels.mapTab}
        </button>
      </div>

      {view === "list" ? (
        posts.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {locale === "en" ? "No articles yet." : "記事がありません。"}
          </p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <Link
                  href={`${locale === "en" ? "/en" : ""}/blog/${post.slug}`}
                  className="group block"
                >
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2 leading-snug">
                    {post.title}
                  </h2>
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
            ))}
          </div>
        )
      ) : (
        <BlogMap posts={posts} locale={locale} />
      )}
    </>
  );
}
