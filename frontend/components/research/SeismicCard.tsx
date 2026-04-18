"use client";

import { ExternalLink } from "lucide-react";
import type { AnalyzeResult } from "@/types/research";
import {
  buildHazardMapUrl,
  buildJShisUrl,
  buildGsiLandformUrl,
} from "@/lib/links/externalMaps";

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

const RISK_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  very_low: { bar: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  low:      { bar: "bg-green-400",   badge: "bg-green-100 text-green-700",     text: "text-green-700" },
  moderate: { bar: "bg-amber-400",   badge: "bg-amber-100 text-amber-700",     text: "text-amber-700" },
  high:     { bar: "bg-orange-400",  badge: "bg-orange-100 text-orange-700",   text: "text-orange-700" },
  very_high:{ bar: "bg-red-400",     badge: "bg-red-100 text-red-700",         text: "text-red-700" },
};

const TERRAIN_COLORS: Record<string, { badge: string }> = {
  low:      { badge: "bg-green-100 text-green-700" },
  moderate: { badge: "bg-amber-100 text-amber-700" },
  high:     { badge: "bg-red-100 text-red-700" },
};

export function SeismicCard({ result, isEn }: Props) {
  const { seismic, terrain, coords } = result;

  if (!seismic && !terrain) return null;

  const hazardUrl  = buildHazardMapUrl(coords.lat, coords.lng);
  const jshisUrl   = buildJShisUrl(coords.lat, coords.lng);
  const gsiLandUrl = buildGsiLandformUrl(coords.lat, coords.lng);

  const t = {
    title:        isEn ? "Seismic & Terrain Risk" : "地震・地形リスク",
    seismicTitle: isEn ? "30-yr Earthquake Probability (Intensity ≥6-)" : "30年以内 震度6弱超過確率（J-SHIS）",
    noSeismic:    isEn ? "Data unavailable" : "データ取得できませんでした",
    terrainTitle: isEn ? "Elevation & Terrain Classification (GSI)" : "標高・地形分類（国土地理院）",
    noTerrain:    isEn ? "Data unavailable" : "データ取得できませんでした",
    elevation:    isEn ? "Elevation" : "標高",
    terrainClass: isEn ? "Terrain type" : "地形分類",
    riskAlert:    isEn ? "Elevated risk factors found in this area" : "このエリアはリスク指標が高い水準を示しています",
    links:        isEn ? "Check on external maps" : "外部マップで詳細を確認",
    hazardLink:   isEn ? "Hazard map (MLIT)" : "ハザードマップ（国交省）",
    jshisLink:    isEn ? "J-SHIS earthquake map" : "地震ハザードステーション（J-SHIS）",
    gsiLink:      isEn ? "GSI landform map" : "地理院地図（地形分類）",
    source:       isEn ? "Source" : "出典",
  };

  const seismicColors = seismic ? RISK_COLORS[seismic.riskLevel] : null;
  const terrainColors = terrain ? TERRAIN_COLORS[terrain.terrainRisk] : null;

  const showAlert =
    (seismic?.riskLevel === "high" || seismic?.riskLevel === "very_high") ||
    terrain?.terrainRisk === "high";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      <h2 className="text-base font-bold text-slate-900">{t.title}</h2>

      {/* Alert banner */}
      {showAlert && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <span className="text-lg leading-none">⚠️</span>
          <span className="font-semibold">{t.riskAlert}</span>
        </div>
      )}

      {/* Seismic section */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-3">{t.seismicTitle}</p>
        {seismic ? (
          <div className="flex items-center gap-4">
            <div className={`text-3xl font-black ${seismicColors!.text} tabular-nums min-w-[4.5rem]`}>
              {seismic.probPct}
              <span className="text-lg font-bold">%</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${seismicColors!.badge}`}>
                  {seismic.riskLabel}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${seismicColors!.bar}`}
                  style={{ width: `${Math.min(seismic.probPct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                {isEn
                  ? "National avg: ~26% (30-yr seismic prob ≥6-)"
                  : "全国平均参考値: 約26%（30年間）"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t.noSeismic}</p>
        )}
      </div>

      <div className="border-t border-slate-100" />

      {/* Terrain section */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-3">{t.terrainTitle}</p>
        {terrain ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {terrain.elevation !== null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500 text-xs">{t.elevation}:</span>
                  <span className="font-bold text-slate-800">{terrain.elevation}m</span>
                  {terrain.elevSource && (
                    <span className="text-xs text-slate-400">({terrain.elevSource})</span>
                  )}
                </div>
              )}
              {terrain.terrainClass && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500 text-xs">{t.terrainClass}:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${terrainColors!.badge}`}>
                    {terrain.terrainClass}
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{terrain.riskNote}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t.noTerrain}</p>
        )}
      </div>

      <div className="border-t border-slate-100" />

      {/* External links */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">{t.links}</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: t.hazardLink,  href: hazardUrl  },
            { label: t.jshisLink,   href: jshisUrl   },
            { label: t.gsiLink,     href: gsiLandUrl },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              {label}
            </a>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {isEn
          ? "Source: J-SHIS (NIED) / GSI (Japan)"
          : "出典: 地震ハザードステーション（防災科研）/ 国土地理院"}
      </p>
    </div>
  );
}
