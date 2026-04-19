"use client";

import { ExternalLink, Map, Camera } from "lucide-react";
import { buildGoogleMapsUrl, buildStreetViewUrl, buildHazardMapUrl, buildJShisUrl } from "@/lib/links/externalMaps";

interface Props {
  lat: number;
  lng: number;
  isEn: boolean;
}

export function ExternalMaps({ lat, lng, isEn }: Props) {
  const links = [
    {
      href: buildGoogleMapsUrl(lat, lng),
      icon: <Map className="w-4 h-4" />,
      label: isEn ? "Google Maps" : "Google マップ",
    },
    {
      href: buildStreetViewUrl(lat, lng),
      icon: <Camera className="w-4 h-4" />,
      label: isEn ? "Street View" : "ストリートビュー",
    },
    {
      href: buildHazardMapUrl(lat, lng),
      icon: <ExternalLink className="w-4 h-4" />,
      label: isEn ? "Hazard Map" : "ハザードマップ",
    },
    {
      href: buildJShisUrl(lat, lng),
      icon: <ExternalLink className="w-4 h-4" />,
      label: isEn ? "Seismic Map" : "地震動マップ",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {isEn ? "External maps" : "外部マップ"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <span className="text-slate-400 flex-shrink-0">{link.icon}</span>
            <span className="font-medium text-xs">{link.label}</span>
            <ExternalLink className="w-3 h-3 ml-auto text-slate-300 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
