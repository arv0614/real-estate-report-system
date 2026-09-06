"use client";

import { useEffect, useRef } from "react";
import type { PostMeta } from "@/lib/blog";
import { MAP_STYLE_URL } from "@/lib/blog/mapStyle";

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

const PIN_SIZE = 22;
const BRAND_COLOR = "bg-teal-600";
// 最新記事ピン専用のアクセントカラー。通常ピン(teal)と混同されないよう、密集地帯でも
// 一目でわかる強めのアンバーにする（2026-09-06、視認性改善）。
const LATEST_COLOR = "bg-amber-500";

/**
 * Marker DOM with optional NEW badge — a Tailwind-styled circular dot, not
 * MapLibre's default teardrop image. `wrap` is sized exactly to the pin so
 * MapLibre's `anchor: 'center'` centers on the pin (not on the visual extent
 * of the absolute-positioned badge/ping ring). We avoid setting `position`
 * inline on `wrap` because MapLibre's `.maplibregl-marker` class already
 * applies `position: absolute; left: 0; top: 0` — overriding it would put
 * the marker at its flow position and offset it from the coordinate.
 *
 * Only "latest" posts get the pulsing ring (`animate-ping`): with dozens of
 * posts plotted at once, pulsing every single pin would look noisy rather
 * than refined — reserving it for what's actually new keeps it meaningful.
 *
 * `z-50` on the latest wrap matters in dense clusters: MapLibre's own
 * `.maplibregl-marker` CSS sets `position: absolute` but no `z-index`, so
 * without an explicit one, stacking falls back to DOM/add order — a latest
 * post added before a nearby regular post would otherwise render underneath
 * it. `z-50` guarantees the latest pin always wins regardless of add order.
 */
function buildMarkerEl(isLatest: boolean): HTMLElement {
  const color = isLatest ? LATEST_COLOR : BRAND_COLOR;

  const wrap = document.createElement("div");
  wrap.style.width = `${PIN_SIZE}px`;
  wrap.style.height = `${PIN_SIZE}px`;
  wrap.className = isLatest ? "relative z-50 cursor-pointer" : "relative cursor-pointer";

  if (isLatest) {
    const ping = document.createElement("span");
    ping.className = `absolute inset-0 rounded-full opacity-60 animate-ping ${color}`;
    wrap.appendChild(ping);
  }

  const pin = document.createElement("span");
  pin.className = `absolute inset-0 rounded-full border-2 border-white shadow-lg ${color}`;
  wrap.appendChild(pin);

  if (isLatest) {
    const badge = document.createElement("span");
    badge.textContent = "NEW";
    badge.className =
      "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow pointer-events-none";
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
        style: MAP_STYLE_URL,
        center: [137.5, 37.5],
        zoom: 4.5,
        attributionControl: { compact: true },
      });

      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[BlogMap] MapLibre error:", e);
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        for (const post of posts) {
          if (!post.primaryLocation || post.excludeFromMap) continue;
          const loc = post.primaryLocation;
          const localePrefix = locale === "ja" ? "" : `/${locale}`;
          const blogHref = `${localePrefix}/blog/${post.slug}`;
          const isLatest = latestSet.has(post.slug);
          const newBadgeHtml = isLatest
            ? `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.05em;color:white;background:#f59e0b;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle">NEW</span>`
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
      className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
      style={{ height: "clamp(300px, 40vw, 400px)" }}
    />
  );
}
