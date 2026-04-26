"use client";

import { useEffect, useRef } from "react";
import type { PostMeta } from "@/lib/blog";

interface Props {
  posts: PostMeta[];
  locale: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogMap({ posts, locale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;

      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
        center: [137.5, 37.5],
        zoom: 4.5,
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl());

      for (const post of posts) {
        if (!post.primaryLocation || post.excludeFromMap) continue;
        const loc = post.primaryLocation;
        const blogHref = `${locale === "en" ? "/en" : ""}/blog/${post.slug}`;

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: "260px" }).setHTML(`
          <div style="font-size:13px;line-height:1.5">
            <h3 style="font-weight:700;margin:0 0 4px;font-size:13px;color:#0f172a">${escapeHtml(truncate(post.title, 60))}</h3>
            <p style="color:#94a3b8;font-size:11px;margin:0 0 5px">${escapeHtml(formatDate(post.publishedAt))}</p>
            <p style="color:#475569;font-size:12px;margin:0 0 8px">${escapeHtml(truncate(post.description, 80))}</p>
            <a href="${escapeHtml(blogHref)}" style="color:#0d9488;font-weight:600;font-size:12px;text-decoration:none">記事を読む →</a>
          </div>
        `);

        new maplibregl.Marker({ color: "#0d9488" })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [posts, locale]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-slate-200"
      style={{ height: "clamp(400px, 50vw, 600px)" }}
    />
  );
}
