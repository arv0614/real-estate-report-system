"use client";

import { useState, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { analyzeArea } from "@/app/[locale]/research/area/areaActions";
import type { AreaResult, AreaSummaryResult } from "@/app/[locale]/research/area/areaActions";
import { PopulationChart } from "./PopulationChart";
import { buildHazardMapUrl, buildJShisUrl, buildGsiLandformUrl } from "@/lib/links/externalMaps";
import { ExternalLink } from "lucide-react";

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

// ── Price histogram ───────────────────────────────────────────────────────────
function PriceHistogram({ prices, isEn }: { prices: number[]; isEn: boolean }) {
  if (prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const med = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // Build 8 buckets
  const bucketCount = 8;
  const range = max - min || 1;
  const bucketSize = range / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: min + i * bucketSize,
    end: min + (i + 1) * bucketSize,
    count: 0,
  }));
  for (const p of prices) {
    const idx = Math.min(Math.floor((p - min) / bucketSize), bucketCount - 1);
    buckets[idx].count++;
  }
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-900 mb-1">
        {isEn ? "Transaction Price Distribution" : "取引価格分布（エリア全体）"}
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        {isEn ? `${prices.length} transactions` : `${prices.length}件の取引データ`}
      </p>
      <div className="flex items-end gap-1 h-24">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-blue-400 transition-all duration-500"
              style={{ height: maxCount > 0 ? `${(b.count / maxCount) * 88}px` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{Math.round(min).toLocaleString()}万</span>
        <span>{Math.round(max).toLocaleString()}万</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs">
        <span className="text-slate-600">
          {isEn ? "Median" : "中央値"}:{" "}
          <strong>{Math.round(med).toLocaleString()}万円</strong>
        </span>
        <span className="text-slate-600">
          {isEn ? "Range" : "レンジ"}:{" "}
          <strong>{Math.round(min).toLocaleString()}〜{Math.round(max).toLocaleString()}万円</strong>
        </span>
      </div>
    </div>
  );
}

// ── Disaster summary ──────────────────────────────────────────────────────────
function DisasterSummary({
  result,
  isEn,
}: {
  result: AreaSummaryResult;
  isEn: boolean;
}) {
  const { seismic, terrain, hazard, coords } = result;
  if (!seismic && !terrain && !hazard) return null;

  const hazardUrl  = buildHazardMapUrl(coords.lat, coords.lng);
  const jshisUrl   = buildJShisUrl(coords.lat, coords.lng);
  const gsiLandUrl = buildGsiLandformUrl(coords.lat, coords.lng);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">
        {isEn ? "Disaster & Terrain Risk" : "災害・地形リスク"}
      </h3>

      {seismic && (
        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              {isEn ? "30-yr Earthquake Probability" : "30年地震確率（震度6弱以上）"}
            </span>
            <span className={`font-semibold ${
              seismic.riskLevel === "very_high" || seismic.riskLevel === "high"
                ? "text-red-600"
                : seismic.riskLevel === "moderate"
                ? "text-amber-600"
                : "text-green-600"
            }`}>
              {seismic.probPct}%（{seismic.riskLabel}）
            </span>
          </div>
        </div>
      )}

      {terrain && (
        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{isEn ? "Elevation" : "標高"}</span>
            <span className="font-medium text-slate-700">
              {terrain.elevation !== null ? `${terrain.elevation}m` : "—"}
            </span>
          </div>
          {terrain.terrainClass && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{isEn ? "Terrain" : "地形分類"}</span>
              <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                terrain.terrainRisk === "high"
                  ? "bg-red-100 text-red-700"
                  : terrain.terrainRisk === "moderate"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
              }`}>
                {terrain.terrainClass}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {[
          { url: hazardUrl, label: isEn ? "Hazard map" : "ハザードマップ" },
          { url: jshisUrl,  label: isEn ? "J-SHIS" : "J-SHIS地震ハザード" },
          { url: gsiLandUrl,label: isEn ? "GSI terrain" : "地形分類（GSI）" },
        ].map(({ url, label }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            {label}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props {
  initialLat: number | null;
  initialLng: number | null;
  isEn: boolean;
  locale: string;
}

export function AreaClient({ initialLat, initialLng, isEn, locale }: Props) {
  const router = useRouter();
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLng !== null
      ? { lat: initialLat, lng: initialLng }
      : null
  );
  const [result,  setResult]  = useState<AreaResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAnalysis = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    startTransition(async () => {
      const res = await analyzeArea(lat, lng);
      setResult(res);
    });
  }, []);

  // Auto-run on initial coords
  useState(() => {
    if (initialLat !== null && initialLng !== null) {
      runAnalysis(initialLat, initialLng);
    }
  });

  const handleMapClick = useCallback((lat: number, lng: number) => {
    runAnalysis(lat, lng);
  }, [runAnalysis]);

  const handleAddPropertyDetails = useCallback(() => {
    const params = coords
      ? `?lat=${coords.lat}&lng=${coords.lng}`
      : "";
    router.push(`/${locale}/research${params}`);
  }, [coords, locale, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isEn ? "Area Summary" : "エリアサマリー"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEn
            ? "Tap the map to explore market data and risk indicators for any area."
            : "地図をタップしてエリアの相場・リスク情報を確認できます。"}
        </p>
      </div>

      {/* Map — tap to set location */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
        <ResearchMap
          lat={coords?.lat ?? 35.6812}
          lng={coords?.lng ?? 139.7671}
          onChange={handleMapClick}
        />
        {!coords && (
          <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
            {isEn ? "Drag the marker or tap the map to select an area." : "マーカーをドラッグするかタップしてエリアを選択してください。"}
          </div>
        )}
      </div>

      {/* Loading */}
      {isPending && (
        <div className="flex items-center gap-3 text-slate-500 bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm">
            {isEn ? "Fetching area data…" : "エリアデータを取得中…"}
          </span>
        </div>
      )}

      {/* Error */}
      {result && !result.ok && !isPending && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
          {result.error}
        </div>
      )}

      {/* Results */}
      {result && result.ok && !isPending && (
        <div className="space-y-4">
          {/* City name banner */}
          {result.cityName && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <span className="font-semibold">{result.cityName}</span>
              {" — "}
              {isEn
                ? `${result.totalFetched} transactions in this tile`
                : `このタイル内${result.totalFetched}件の取引データ`}
            </div>
          )}

          <PriceHistogram prices={result.allPrices} isEn={isEn} />
          <DisasterSummary result={result} isEn={isEn} />

          {/* Population wrapped to accept AreaSummaryResult */}
          {result.population && (
            <PopulationChart
              result={{
                ok: true,
                coords: result.coords,
                coordOverrideUsed: false,
                originalCoords: null,
                input: { address: "", price: 0, area: 0, builtYear: 2000, mode: "home" },
                similar: [],
                searchRange: null,
                searchRangeLabel: null,
                hazard: result.hazard,
                cityCode: result.cityCode,
                seismic: result.seismic,
                terrain: result.terrain,
                population: result.population,
                totalFetched: result.totalFetched,
                autoFilledFields: [],
              }}
              isEn={isEn}
            />
          )}

          {/* CTA to full research */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                {isEn ? "Want a full property verdict?" : "物件情報を足して総合判定する"}
              </p>
              <p className="text-xs text-blue-700">
                {isEn
                  ? "Add price, area, and year built to calculate a full A–D grade."
                  : "価格・面積・築年を入力するとA〜Dの総合グレードを算出できます。"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPropertyDetails}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {isEn ? "Add property details →" : "物件情報を入力 →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
