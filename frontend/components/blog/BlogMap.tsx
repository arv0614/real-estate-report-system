"use client";

import { useEffect, useRef } from "react";
import type { PostMeta } from "@/lib/blog";
import { OSM_RASTER_STYLE } from "@/lib/blog/mapStyle";

interface Props {
  posts: PostMeta[];
  locale: string;
  /** Slugs of the most recent posts (top N) — these markers are highlighted with a NEW badge. */
  latestSlugs?: string[];
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

const PIN_SIZE = 26;

/** Marker DOM with optional NEW badge — rendered as a circular pin.
 *  The wrap is sized exactly to the pin so MapLibre's `anchor: 'center'`
 *  centers on the pin (not on the visual extent of the absolute-positioned badge).
 *  We avoid setting `position` inline because MapLibre's `.maplibregl-marker`
 *  class applies `position: absolute; left: 0; top: 0` — overriding it would
 *  put the marker at its flow position and offset it from the coordinate. */
function buildMarkerEl(isLatest: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.width = `${PIN_SIZE}px`;
  wrap.style.height = `${PIN_SIZE}px`;
  wrap.style.cursor = "pointer";

  const pin = document.createElement("div");
  pin.style.position = "absolute";
  pin.style.inset = "0";
  pin.style.borderRadius = "50%";
  pin.style.border = "2px solid white";
  pin.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
  pin.style.background = isLatest ? "#e11d48" : "#0d9488";
  wrap.appendChild(pin);

  if (isLatest) {
    const badge = document.createElement("span");
    badge.textContent = "NEW";
    badge.style.position = "absolute";
    badge.style.top = "-10px";
    badge.style.left = "50%";
    badge.style.transform = "translateX(-50%)";
    badge.style.fontSize = "9px";
    badge.style.fontWeight = "700";
    badge.style.letterSpacing = "0.05em";
    badge.style.color = "white";
    badge.style.background = "#e11d48";
    badge.style.padding = "1px 5px";
    badge.style.borderRadius = "8px";
    badge.style.whiteSpace = "nowrap";
    badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
    badge.style.pointerEvents = "none";
    wrap.appendChild(badge);
  }

  return wrap;
}

export default function BlogMap({ posts, locale, latestSlugs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const latestSet = new Set(latestSlugs ?? []);

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;

      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_RASTER_STYLE,
        center: [137.5, 37.5],
        zoom: 4.5,
      });

      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[BlogMap] MapLibre error:", e);
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        for (const post of posts) {
          if (!post.primaryLocation || post.excludeFromMap) continue;
          const loc = post.primaryLocation;
          const blogHref = `${locale === "en" ? "/en" : ""}/blog/${post.slug}`;
          const isLatest = latestSet.has(post.slug);
          const newBadgeHtml = isLatest
            ? `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.05em;color:white;background:#e11d48;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle">NEW</span>`
            : "";

          const popup = new maplibregl.Popup({ offset: 25, maxWidth: "260px" }).setHTML(`
            <div style="font-size:13px;line-height:1.5">
              <h3 style="font-weight:700;margin:0 0 4px;font-size:13px;color:#0f172a">${escapeHtml(truncate(post.title, 60))}${newBadgeHtml}</h3>
              <p style="color:#94a3b8;font-size:11px;margin:0 0 5px">${escapeHtml(formatDate(post.publishedAt))}</p>
              <p style="color:#475569;font-size:12px;margin:0 0 8px">${escapeHtml(truncate(post.description, 80))}</p>
              <a href="${escapeHtml(blogHref)}" style="color:#0d9488;font-weight:600;font-size:12px;text-decoration:none">記事を読む →</a>
            </div>
          `);

          new maplibregl.Marker({
            element: buildMarkerEl(isLatest),
            anchor: "center",
          })
            .setLngLat([loc.lng, loc.lat])
            .setPopup(popup)
            .addTo(map);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [posts, locale, latestSlugs]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border border-slate-200"
      style={{ height: "clamp(300px, 40vw, 400px)" }}
    />
  );
}
