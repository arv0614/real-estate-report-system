"use client";

import { useEffect, useRef } from "react";
import type { BlogPostLocation } from "@/lib/blog";
import { MAP_STYLE_URL } from "@/lib/blog/mapStyle";

interface Props {
  primaryLocation: BlogPostLocation;
  secondaryLocations?: BlogPostLocation[];
  zoom?: number;
}

const PRIMARY_COLOR = "bg-teal-600";
const SECONDARY_COLOR = "bg-slate-400";

/**
 * 主点マーカー: テーマカラーのドット + 外側に広がるパルスリング（`animate-ping`）。
 * MapLibre 既定のティアドロップ画像は使わず、Tailwind でスタイリングした HTML 要素を使う。
 */
function buildPrimaryMarkerEl(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "relative flex items-center justify-center w-4 h-4";

  const ping = document.createElement("span");
  ping.className = `absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${PRIMARY_COLOR}`;
  wrap.appendChild(ping);

  const dot = document.createElement("span");
  dot.className = `relative inline-flex w-4 h-4 rounded-full border-2 border-white shadow-lg ${PRIMARY_COLOR}`;
  wrap.appendChild(dot);

  return wrap;
}

/** 副点マーカー: 周辺情報の位置を示す控えめな小さいドット（パルスなし、主点との視覚的な優先度を分ける） */
function buildSecondaryMarkerEl(): HTMLElement {
  const dot = document.createElement("div");
  dot.className = `w-2.5 h-2.5 rounded-full border-2 border-white shadow-md ${SECONDARY_COLOR}`;
  return dot;
}

export default function BlogMiniMap({ primaryLocation, secondaryLocations, zoom = 12 }: Props) {
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
        style: MAP_STYLE_URL,
        center: [primaryLocation.lng, primaryLocation.lat],
        zoom,
        attributionControl: { compact: true },
      });

      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[BlogMiniMap] MapLibre error:", e);
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        new maplibregl.Marker({ element: buildPrimaryMarkerEl(), anchor: "center" })
          .setLngLat([primaryLocation.lng, primaryLocation.lat])
          .addTo(map);

        for (const loc of secondaryLocations ?? []) {
          new maplibregl.Marker({ element: buildSecondaryMarkerEl(), anchor: "center" })
            .setLngLat([loc.lng, loc.lat])
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
  }, [primaryLocation, secondaryLocations, zoom]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm"
      style={{ height: "220px" }}
    />
  );
}
