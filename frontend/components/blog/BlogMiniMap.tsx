"use client";

import { useEffect, useRef } from "react";
import type { BlogPostLocation } from "@/lib/blog";

interface Props {
  primaryLocation: BlogPostLocation;
  secondaryLocations?: BlogPostLocation[];
  zoom?: number;
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
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [primaryLocation.lng, primaryLocation.lat],
        zoom,
        attributionControl: {
          customAttribution:
            '© <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> © OpenStreetMap contributors',
        },
      });

      mapRef.current = map;

      map.on("error", (e) => {
        console.error("[BlogMiniMap] MapLibre error:", e);
      });

      map.addControl(new maplibregl.NavigationControl());

      map.on("load", () => {
        if (cancelled) return;

        new maplibregl.Marker({ color: "#0d9488" })
          .setLngLat([primaryLocation.lng, primaryLocation.lat])
          .addTo(map);

        for (const loc of secondaryLocations ?? []) {
          new maplibregl.Marker({ color: "#64748b", scale: 0.7 })
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
      className="w-full rounded-xl overflow-hidden border border-slate-200"
      style={{ height: "220px" }}
    />
  );
}
