"use client";

import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { analyzeArea } from "@/app/[locale]/research/area/areaActions";
import type { AreaResult, AreaSummaryResult } from "@/app/[locale]/research/area/areaActions";
import { PopulationChart } from "./PopulationChart";
import {
  buildGoogleMapsUrl, buildStreetViewUrl,
  buildHazardMapUrl, buildJShisUrl, buildGsiLandformUrl,
} from "@/lib/links/externalMaps";
import { ExternalLink, AlertTriangle } from "lucide-react";
import type { PropertyType } from "@/types/research";

const TYPE_FILTER: Record<PropertyType, string> = {
  mansion: "中古マンション等",
  house:   "宅地(土地と建物)",
};

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

// ── Skeleton blocks ───────────────────────────────────────────────────────────
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-200 rounded-xl animate-pulse ${className ?? ""}`} />;
}

const STEPS_JA = ["位置情報取得 ✓", "エリアデータ取得中…", "表示"];
const STEPS_EN = ["Location ✓", "Fetching area data…", "Rendering"];

function AreaSkeleton({ isEn, slow }: { isEn: boolean; slow: boolean }) {
  const steps = isEn ? STEPS_EN : STEPS_JA;
  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700">{steps[1]}</span>
        </div>
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-xs ${i === 1 ? "text-blue-600 font-semibold" : i < 1 ? "text-green-600" : "text-slate-300"}`}>
              {i < 1 && <span>✓</span>}
              {i === 1 && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />}
              {s}
              {i < steps.length - 1 && <span className="text-slate-200 ml-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Slow warning */}
      {slow && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {isEn ? "Taking longer than usual…" : "少し時間がかかっています…"}
        </div>
      )}

      {/* Skeleton cards */}
      <SkeletonBlock className="h-52" />
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-32" />
    </div>
  );
}

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

  const gMapsUrl   = buildGoogleMapsUrl(coords.lat, coords.lng);
  const svUrl      = buildStreetViewUrl(coords.lat, coords.lng);
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
          { url: gMapsUrl,   label: isEn ? "Google Maps" : "Google Maps" },
          { url: svUrl,      label: isEn ? "Street View (where available)" : "ストリートビュー（対応地域のみ）" },
          { url: hazardUrl,  label: isEn ? "Hazard map" : "ハザードマップ" },
          { url: jshisUrl,   label: isEn ? "J-SHIS" : "J-SHIS地震ハザード" },
          { url: gsiLandUrl, label: isEn ? "GSI terrain" : "地形分類（GSI）" },
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
  initialType?: PropertyType | null;
  isEn: boolean;
  locale: string;
  embedded?: boolean; // when true, strips outer max-w wrapper (used inside ResearchClient)
}

export function AreaClient({ initialLat, initialLng, initialType, isEn, locale, embedded }: Props) {
  const router = useRouter();
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLng !== null
      ? { lat: initialLat, lng: initialLng }
      : null
  );
  const [result,       setResult]      = useState<AreaResult | null>(null);
  const [runError,     setRunError]    = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();
  const [propertyType, setPropertyType] = useState<PropertyType>(initialType ?? "mansion");
  const [slowLoad,     setSlowLoad]     = useState(false);
  const [timedOut,     setTimedOut]     = useState(false);

  // Show "slow" warning after 10s, timeout error after 15s
  useEffect(() => {
    if (!isPending) { setSlowLoad(false); setTimedOut(false); return; }
    const slowTimer    = setTimeout(() => setSlowLoad(true),  10_000);
    const timeoutTimer = setTimeout(() => setTimedOut(true),  15_000);
    return () => { clearTimeout(slowTimer); clearTimeout(timeoutTimer); };
  }, [isPending]);

  const runAnalysis = useCallback((lat: number, lng: number) => {
    console.log("[U18] runAnalysis start", { lat, lng });
    setCoords({ lat, lng });
    setResult(null);
    setRunError(null);
    startTransition(async () => {
      try {
        const res = await analyzeArea(lat, lng);
        console.log("[U18] analyzeArea returned", { ok: res.ok });
        setResult(res);
      } catch (err) {
        console.error("[U18] analyzeArea threw", err);
        setRunError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    });
  }, []);

  // ── Auto-run on initial coords (useEffect — not useState — to avoid calling
  //    startTransition during render, which React does not support) ─────────────
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    if (initialLat !== null && initialLng !== null) {
      runAnalysis(initialLat, initialLng);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    runAnalysis(lat, lng);
  }, [runAnalysis]);

  const handleAddPropertyDetails = useCallback(() => {
    const base = coords ? `?lat=${coords.lat}&lng=${coords.lng}&type=${propertyType}` : "";
    router.push(`/${locale}/research${base}`);
  }, [coords, locale, propertyType, router]);

  // Client-side price filtering by propertyType (9-8)
  const filteredPrices = useMemo(() => {
    if (!result || !result.ok) return [];
    const requiredType = TYPE_FILTER[propertyType];
    return result.allTransactions
      .filter((r) => r.type === requiredType && r.tradePrice > 0)
      .map((r) => Math.round(r.tradePrice / 10000));
  }, [result, propertyType]);

  // Show skeleton whenever result is not yet available — covers the brief window
  // between mount and useEffect firing, plus the actual pending state
  const showSkeleton = (!result && !runError && !timedOut) || (isPending && !timedOut);

  return (
    <div className={embedded ? "space-y-4" : "max-w-2xl mx-auto px-4 py-10"}>

      {/* Standalone-only: page header */}
      {!embedded && (
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
      )}

      {/* Standalone-only: map to tap/re-select location */}
      {!embedded && (
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
      )}

      {/* Loading skeleton — shown until result (or error) arrives */}
      {showSkeleton && <AreaSkeleton isEn={isEn} slow={slowLoad} />}

      {/* Timeout error */}
      {timedOut && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold">{isEn ? "Request timed out" : "タイムアウトしました"}</p>
            <p className="text-xs mt-1">{isEn ? "The server took too long to respond. Please try again." : "サーバーの応答に時間がかかりすぎています。再度お試しください。"}</p>
          </div>
        </div>
      )}

      {/* Network / unexpected error */}
      {runError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold">{isEn ? "Analysis failed" : "分析に失敗しました"}</p>
            <p className="text-xs mt-1">{runError}</p>
          </div>
        </div>
      )}

      {/* Server-returned error */}
      {result && !result.ok && !isPending && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
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

          {/* Property type tab switcher */}
          <div className="flex gap-2">
            {(["mansion", "house"] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPropertyType(pt)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  propertyType === pt
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {pt === "mansion" ? (isEn ? "🏢 Apartment" : "🏢 マンション") : (isEn ? "🏠 House" : "🏠 戸建")}
              </button>
            ))}
          </div>

          <PriceHistogram prices={filteredPrices} isEn={isEn} />
          <DisasterSummary result={result} isEn={isEn} />

          {result.population && (
            <PopulationChart
              result={{
                ok: true,
                coords: result.coords,
                coordOverrideUsed: false,
                originalCoords: null,
                input: { address: "", price: 0, area: 0, builtYear: 2000, mode: "home", propertyType: "mansion" },
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
                fallbackFilledFields: [],
              }}
              isEn={isEn}
            />
          )}

          {/* CTA to full research (embedded mode: open property form; standalone: navigate) */}
          {!embedded && (
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
          )}
        </div>
      )}
    </div>
  );
}
