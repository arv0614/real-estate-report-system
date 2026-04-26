"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { analyzeProperty } from "@/app/[locale]/research/actions";
import type { PropertyInput, AnalyzeResult, PropertyType } from "@/types/research";
import { SimilarChart } from "./SimilarChart";
import { ScoreCard } from "./ScoreCard";
import { SeismicCard } from "./SeismicCard";
import { ShareResearch } from "./ShareResearch";
import { NearbyComparisons } from "./NearbyComparisons";
import { calcPropertyScore } from "@/lib/scoring";
import { haversineMeters, formatDistance } from "@/lib/geo/haversine";
import { useAuth } from "@/lib/useAuth";
import { saveResearchSession } from "@/lib/researchHistory";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { perfLog } from "@/lib/debug/perfLog";
import { TopReasons } from "./TopReasons";
import { ExternalMaps } from "./ExternalMaps";
import { SearchConditionCard } from "./SearchConditionCard";
import { AreaClient } from "./AreaClient";
import { UnifiedInputPanel } from "./UnifiedInputPanel";
import { PopulationChart } from "./PopulationChart";

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

// ── View state ────────────────────────────────────────────────────────────────
type ViewMode = "input" | "result";
type ResultKind = "property" | "area";

// ── Staged loading messages ───────────────────────────────────────────────────
const LOADING_MSGS_JA = [
  "住所を確認中…",
  "取引データを取得中…",
  "地震・地形データを確認中…",
  "スコアを計算中…",
];
const LOADING_MSGS_EN = [
  "Geocoding address…",
  "Fetching transaction data…",
  "Checking seismic & terrain data…",
  "Calculating score…",
];

function DataDisclaimer({ isEn }: { isEn: boolean }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
      {isEn
        ? "⚠️ This report aggregates public data for reference only. It does not guarantee accuracy or completeness. Always conduct on-site verification and consult a licensed real estate professional before making any purchase, rental, or investment decision."
        : "⚠️ このレポートは公的機関のデータを集計した参考情報であり、正確性・完全性を保証するものではありません。物件の購入・賃貸・投資等の最終判断は、必ず現地確認および宅地建物取引士等の専門家にご相談ください。"}
    </div>
  );
}

function StagedLoader({ isEn }: { isEn: boolean }) {
  const msgs = isEn ? LOADING_MSGS_EN : LOADING_MSGS_JA;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    const timer = setInterval(() => {
      setIdx((i) => (i < msgs.length - 1 ? i + 1 : i));
    }, 1800);
    return () => clearInterval(timer);
  }, [msgs.length]);

  return (
    <div className="mt-8 flex items-center gap-3 text-slate-500 bg-white rounded-xl border border-slate-200 p-4">
      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <span className="text-sm transition-all duration-300">{msgs[idx]}</span>
      <span className="ml-auto flex gap-1">
        {msgs.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i <= idx ? "bg-blue-600" : "bg-slate-200"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  isEn: boolean;
  locale: string;
  initialCenter?: { lat: number; lng: number } | null;
  initialPropertyType?: PropertyType;
  initialAction?: "area" | null;
}

export function ResearchClient({
  isEn,
  locale,
  initialCenter = null,
  initialPropertyType = "mansion",
  initialAction = null,
}: Props) {
  const [viewMode,      setViewMode]     = useState<ViewMode>(
    initialAction === "area" && initialCenter ? "result" : "input"
  );
  const [resultKind,    setResultKind]   = useState<ResultKind>(
    initialAction === "area" ? "area" : "property"
  );
  const [propertyResult, setPropertyResult] = useState<AnalyzeResult | null>(null);
  const [areaCoords,    setAreaCoords]   = useState<{ lat: number; lng: number } | null>(
    initialAction === "area" ? initialCenter : null
  );
  const [isPending,     startTransition] = useTransition();
  const [dragCoords,    setDragCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [reanalyzing,   setReanalyzing]  = useState(false);
  const [propertyType,  setPropertyType] = useState<PropertyType>(initialPropertyType);
  const lastInputRef = useRef<PropertyInput | null>(null);
  const mapRef       = useRef<HTMLDivElement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { user } = useAuth();

  const handlePropertySubmit = useCallback((input: PropertyInput) => {
    lastInputRef.current = input;
    setDragCoords(null);
    startTransition(async () => {
      const res = await analyzeProperty(input);
      setPropertyResult(res);
      if (res.ok) {
        setResultKind("property");
        setViewMode("result");
        if (user) {
          saveResearchSession(user.uid, {
            address: input.address,
            lat: res.coords.lat,
            lng: res.coords.lng,
            price: input.price ?? 0,
            area: input.area ?? 0,
            builtYear: input.builtYear ?? new Date().getFullYear(),
            mode: input.mode,
            propertyType: input.propertyType,
          }).catch(() => {});
        }
      }
    });
  }, [user]);

  const handleAreaAnalyze = useCallback((lat: number, lng: number) => {
    console.log("[U18] handleAreaAnalyze", { lat, lng });
    perfLog("handleAreaAnalyze.start", 0, { lat, lng });
    setAreaCoords({ lat, lng });
    setResultKind("area");
    setViewMode("result");
  }, []);

  const handleMapDrag = useCallback((lat: number, lng: number) => {
    setDragCoords({ lat, lng });
  }, []);

  const handleReanalyze = useCallback(() => {
    if (!lastInputRef.current || !dragCoords) return;
    setReanalyzing(true);
    startTransition(async () => {
      const res = await analyzeProperty({ ...lastInputRef.current!, coordOverride: dragCoords });
      setPropertyResult(res);
      setDragCoords(null);
      setReanalyzing(false);
    });
  }, [dragCoords]);

  const handleScrollToMap = useCallback(() => {
    setDetailOpen(true);
    setTimeout(() => {
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320);
  }, []);

  const handleBackToInput = useCallback(() => {
    setViewMode("input");
    setPropertyResult(null);
    setDragCoords(null);
    lastInputRef.current = null;
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" style={{ "--research-map-h": "280px" } as React.CSSProperties}>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isEn ? "Property Research (β)" : "物件リサーチ（β）"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEn
            ? "Explore area data or enter property details for a full analysis."
            : "エリアを地図で探すか、物件情報を入力して相場・リスク・将来性を分析します。"}
        </p>
      </div>

      {/* ── INPUT ── */}
      {viewMode === "input" && (
        <>
          <UnifiedInputPanel
            isEn={isEn}
            propertyType={propertyType}
            onPropertyTypeChange={setPropertyType}
            onPropertySubmit={handlePropertySubmit}
            onAreaAnalyze={handleAreaAnalyze}
            isPending={isPending}
            initialCenter={initialCenter}
          />

          {isPending && <StagedLoader isEn={isEn} />}

          {propertyResult && !propertyResult.ok && !isPending && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {propertyResult.error}
            </div>
          )}
        </>
      )}

      {/* ── RESULT: area ── */}
      {viewMode === "result" && resultKind === "area" && areaCoords && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleBackToInput}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors mb-1"
          >
            ← {isEn ? "Search another area" : "別のエリアを調べる"}
          </button>
          <DataDisclaimer isEn={isEn} />
          <AreaClient
            initialLat={areaCoords.lat}
            initialLng={areaCoords.lng}
            initialType={propertyType}
            isEn={isEn}
            locale={locale}
            embedded={true}
          />
          <DataDisclaimer isEn={isEn} />
        </div>
      )}

      {/* ── RESULT: property ── */}
      {viewMode === "result" && resultKind === "property" && propertyResult && propertyResult.ok && !isPending && (
        <div className="space-y-4">
          {/* Search condition card — topmost */}
          <SearchConditionCard
            result={propertyResult}
            isEn={isEn}
            onReenter={handleBackToInput}
          />

          {/* Fallback warning banner */}
          {propertyResult.fallbackFilledFields.length > 0 && (
            <div className="rounded-xl bg-orange-50 border-2 border-orange-200 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-900 mb-1">
                  {isEn
                    ? "Results based on national reference values"
                    : "このエリアの取引データが不足しています"}
                </p>
                <p className="text-xs text-orange-800 leading-relaxed">
                  {isEn
                    ? "The local area has fewer than 5 transaction samples. Scores below use national median values as a fallback. For more accurate results, enter actual property details."
                    : "近隣の取引事例が 5 件未満のため、全国中央値を使った参考スコアを表示しています。より正確な判定には、実際の物件情報を入力してください。"}
                </p>
                <button
                  type="button"
                  onClick={handleBackToInput}
                  className="mt-2 text-xs font-semibold text-orange-700 underline hover:text-orange-900 transition-colors"
                >
                  {isEn ? "Enter accurate values →" : "正確な情報を入力する →"}
                </button>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <DataDisclaimer isEn={isEn} />

          {/* Score card */}
          <ScoreCard result={propertyResult} isEn={isEn} onScrollToMap={handleScrollToMap} />

          {/* Top reasons */}
          <TopReasons
            inputPrice={propertyResult.input.price ?? 0}
            similarPrices={propertyResult.similar.map((t) => t.price)}
            seismic={propertyResult.seismic}
            population={propertyResult.population}
            isEn={isEn}
          />

          {/* External maps */}
          <ExternalMaps lat={propertyResult.coords.lat} lng={propertyResult.coords.lng} isEn={isEn} />

          {/* DetailedBreakdown — collapsible */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailOpen((o) => !o)}
              aria-expanded={detailOpen}
              className="w-full flex items-center justify-between px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:bg-slate-50 transition-colors"
            >
              <span>{isEn ? "Detailed breakdown" : "詳細データ"}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${detailOpen ? "rotate-180" : ""}`} />
            </button>

            <div className={`grid transition-all duration-300 ease-in-out ${detailOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-slate-200 space-y-4 p-5">
                  {/* Geocode banner */}
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <div className="font-semibold mb-0.5">
                        {isEn ? "Address confirmed" : "住所を確認しました"}
                      </div>
                      <div>
                        {propertyResult.coordOverrideUsed
                          ? isEn
                            ? `Map point: ${propertyResult.coords.lat.toFixed(5)}, ${propertyResult.coords.lng.toFixed(5)}`
                            : `地図指定: ${propertyResult.coords.lat.toFixed(5)}, ${propertyResult.coords.lng.toFixed(5)}`
                          : `${isEn ? "Coords" : "座標"}: ${propertyResult.coords.lat.toFixed(5)}, ${propertyResult.coords.lng.toFixed(5)}`
                        }
                      </div>
                      {propertyResult.totalFetched > 0 && (
                        <div className="mt-0.5">
                          {isEn
                            ? `${propertyResult.totalFetched} transactions found (${propertyResult.similar.length} similar)`
                            : `周辺取引${propertyResult.totalFetched}件（類似${propertyResult.similar.length}件）`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Map with draggable marker */}
                  <div ref={mapRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <ResearchMap
                      mode="pin"
                      lat={propertyResult.coords.lat}
                      lng={propertyResult.coords.lng}
                      onChange={handleMapDrag}
                    />
                    {dragCoords && (
                      <div className="animate-fade-in px-4 py-3 bg-blue-50 border-t border-blue-200 flex items-center justify-between gap-3">
                        <div className="text-xs text-blue-700">
                          <span className="font-semibold">
                            {isEn ? "Marker moved" : "マーカーを移動しました"}
                          </span>
                          {" "}
                          {(() => {
                            const dist = haversineMeters(
                              propertyResult.coords.lat, propertyResult.coords.lng,
                              dragCoords.lat, dragCoords.lng
                            );
                            return isEn
                              ? `(${formatDistance(dist)} from original)`
                              : `（元住所から${formatDistance(dist)}）`;
                          })()}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button type="button" onClick={() => setDragCoords(null)} className="text-xs text-slate-500 hover:text-slate-700 underline">
                            {isEn ? "Reset" : "元に戻す"}
                          </button>
                          <button
                            type="button"
                            onClick={handleReanalyze}
                            disabled={reanalyzing}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {reanalyzing
                              ? (isEn ? "Analyzing…" : "分析中…")
                              : (isEn ? "Re-analyze here" : "この地点で再調査")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nearby comparisons */}
                  <NearbyComparisons result={propertyResult} isEn={isEn} />

                  {/* Box plot */}
                  {propertyResult.similar.length >= 3 && (
                    <SimilarChart result={propertyResult} isEn={isEn} />
                  )}

                  {/* Seismic & terrain */}
                  <SeismicCard result={propertyResult} isEn={isEn} />

                  {/* Population trend */}
                  <PopulationChart result={propertyResult} isEn={isEn} />

                  {propertyResult.similar.length === 0 && propertyResult.totalFetched > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                      {isEn
                        ? "No similar transactions matched even with widened filters."
                        : "条件を広げても類似物件が見つかりませんでした。"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom disclaimer */}
          <DataDisclaimer isEn={isEn} />

          {/* ActionBar */}
          <div className="space-y-3 pt-2">
            {(() => {
              const s = calcPropertyScore(
                propertyResult.input.price ?? 0,
                propertyResult.similar.map((t) => t.price),
                propertyResult.hazard,
                propertyResult.input.mode,
                propertyResult.seismic,
                propertyResult.terrain,
                propertyResult.population
              );
              return (
                <ShareResearch
                  grade={s.total.status === "ok" ? s.total.grade : "—"}
                  score={s.total.status === "ok" ? s.total.score : 0}
                  address={propertyResult.input.address}
                  isEn={isEn}
                  autoFilled={propertyResult.autoFilledFields.length > 0}
                  propertyType={propertyResult.input.propertyType}
                />
              );
            })()}
            <button
              type="button"
              onClick={handleBackToInput}
              className="w-full py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {isEn ? "← Search another location" : "← 別の場所を調べる"}
            </button>
          </div>
        </div>
      )}

      {/* Pending overlay for property analysis from result → re-analysis */}
      {viewMode === "result" && resultKind === "property" && isPending && (
        <StagedLoader isEn={isEn} />
      )}
    </div>
  );
}
