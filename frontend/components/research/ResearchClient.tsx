"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { analyzeProperty } from "@/app/[locale]/research/actions";
import type { PropertyInput, AnalyzeResult, PropertyType } from "@/types/research";
import { PropertyForm } from "./PropertyForm";
import { SimilarChart } from "./SimilarChart";
import { ScoreCard } from "./ScoreCard";
import { SeismicCard } from "./SeismicCard";
import { PopulationChart } from "./PopulationChart";
import { ShareResearch } from "./ShareResearch";
import { NearbyComparisons } from "./NearbyComparisons";
import { calcPropertyScore } from "@/lib/scoring";
import { haversineMeters, formatDistance } from "@/lib/geo/haversine";
import { useAuth } from "@/lib/useAuth";
import { saveResearchSession } from "@/lib/researchHistory";
import { MapPin, Navigation, Search, AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

// ── TopMode state machine ─────────────────────────────────────────────────────
export type TopMode = "select" | "property-form" | "map-explore" | "result";

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

// ── Auto-fill warning badge ───────────────────────────────────────────────────
function AutoFillWarning({
  result,
  isEn,
  onReenter,
}: {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
  onReenter: () => void;
}) {
  const fieldLabels: Record<string, string> = {
    price:     isEn ? "Price"      : "価格",
    area:      isEn ? "Floor area" : "専有面積",
    builtYear: isEn ? "Year built" : "建築年",
  };
  const fieldValues: Record<string, string> = {
    price:     `${result.input.price?.toLocaleString()}万円`,
    area:      `${result.input.area}㎡`,
    builtYear: `${result.input.builtYear}年`,
  };

  return (
    <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-5">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-yellow-900">
            {isEn
              ? "Note: Some values are area medians, not your property's actual data"
              : "注意: 一部の情報はエリア中央値で算出しています"}
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            {isEn
              ? "These are estimated from nearby transactions and may not reflect your property."
              : "近隣の取引データから推計した参考値です。実際の物件とは異なる場合があります。"}
          </p>
        </div>
      </div>

      <ul className="mb-4 space-y-1">
        {result.autoFilledFields.map((field) => (
          <li key={field} className="text-xs text-yellow-800 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
            <span className="font-medium">{fieldLabels[field] ?? field}:</span>
            <span>{fieldValues[field] ?? "—"}</span>
            <span className="text-yellow-600">（エリア中央値）</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-yellow-700 mb-3">
        {isEn
          ? "For an accurate assessment, please enter your property's actual values."
          : "正確な判定のため、物件情報を入力してから再度調査してください。"}
      </p>

      <button
        type="button"
        onClick={onReenter}
        className="text-sm font-semibold text-yellow-700 underline hover:text-yellow-800 transition-colors"
      >
        {isEn ? "Enter accurate values and re-analyze →" : "正確な情報で再調査する →"}
      </button>
    </div>
  );
}

// ── Select screen ─────────────────────────────────────────────────────────────
interface SelectScreenProps {
  isEn: boolean;
  locale: string;
  onSelectA: () => void;
  onSelectB: () => void;
}

function SelectScreen({ isEn, locale, onSelectA, onSelectB }: SelectScreenProps) {
  const router = useRouter();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleGeoCard = () => {
    const isHttps =
      typeof window === "undefined" ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";

    if (!isHttps) {
      setGeoError(isEn ? "Location requires HTTPS" : "位置情報の取得にはHTTPS接続が必要です");
      return;
    }
    if (!navigator.geolocation) {
      setGeoError(isEn ? "Geolocation not supported" : "位置情報がサポートされていません");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        router.push(`/${locale}/research/area?lat=${lat}&lng=${lng}`);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setGeoError(isEn
            ? "Location permission denied. Please check browser settings."
            : "ブラウザの位置情報が許可されていません。設定を確認してください。");
        } else {
          setGeoError(isEn ? "Could not get current location." : "現在地を取得できませんでした。");
        }
      },
      { timeout: 10_000 }
    );
  };

  const cards = [
    {
      key: "a",
      icon: "🏠",
      title: isEn ? "Analyze a property" : "物件を判定する",
      desc:  isEn ? "Compare price, risk & future outlook" : "価格・リスク・将来性を分析",
      onClick: onSelectA,
      loading: false,
    },
    {
      key: "b",
      icon: "🗺️",
      title: isEn ? "Explore an area" : "エリアを探す",
      desc:  isEn ? "Browse market trends on the map" : "地図でエリアの特性を確認",
      onClick: onSelectB,
      loading: false,
    },
    {
      key: "c",
      icon: geoLoading ? null : "📍",
      title: isEn ? "Where I am now" : "今いる場所を調べる",
      desc:  isEn ? "View area info for your current location" : "現在地のエリア情報を表示",
      onClick: handleGeoCard,
      loading: geoLoading,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={card.loading}
            className="flex items-center gap-4 w-full text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-wait group"
          >
            <span className="text-3xl flex-shrink-0 w-10 flex items-center justify-center">
              {card.loading
                ? <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                : card.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                {card.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{card.desc}</p>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
          </button>
        ))}
      </div>

      {geoError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {geoError}
        </p>
      )}
    </div>
  );
}

// ── Map-first explore panel ───────────────────────────────────────────────────
interface ExplorePanel {
  isEn: boolean;
  locale: string;
  propertyType: PropertyType;
  onPropertyTypeChange: (t: PropertyType) => void;
  onSwitchToForm: (lat: number, lng: number) => void;
}

function MapExplorePanel({ isEn, locale, propertyType, onPropertyTypeChange, onSwitchToForm }: ExplorePanel) {
  const router = useRouter();
  const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 };
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [searchVal, setSearchVal] = useState("");
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(val)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json?.[0]?.geometry?.coordinates) {
          const [lng, lat] = json[0].geometry.coordinates as [number, number];
          setCenter({ lat, lng });
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 700);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

  const handleAreaInfo = () => {
    router.push(`/${locale}/research/area?lat=${center.lat}&lng=${center.lng}&type=${propertyType}`);
  };

  const typeLbl = {
    mansion: isEn ? "🏢 Apartment" : "🏢 マンション",
    house:   isEn ? "🏠 House"    : "🏠 戸建",
  };

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="flex gap-2">
        {(["mansion", "house"] as const).map((pt) => (
          <button
            key={pt}
            type="button"
            onClick={() => onPropertyTypeChange(pt)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border-2 ${
              propertyType === pt
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {typeLbl[pt]}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={isEn ? "Search address…" : "住所で検索…"}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={geoLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex-shrink-0"
          title={isEn ? "Use my location" : "現在地を使用"}
        >
          <Navigation className={`w-4 h-4 ${geoLoading ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">{isEn ? "My location" : "現在地"}</span>
        </button>
      </div>

      {/* Map */}
      <div
        className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        style={{ "--research-map-h": "320px" } as React.CSSProperties}
      >
        <ResearchMap
          mode="explore"
          lat={center.lat}
          lng={center.lng}
          onCenter={(lat, lng) => setCenter({ lat, lng })}
        />
      </div>

      <p className="text-xs text-slate-500 text-center">
        {isEn
          ? "Pan the map to the area you want to explore"
          : "調べたいエリアに地図を移動してください"}
      </p>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAreaInfo}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          {isEn ? "View area info" : "この地点のエリア情報を見る"}
        </button>
        <button
          type="button"
          onClick={() => onSwitchToForm(center.lat, center.lng)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          {isEn ? "Analyze a property here →" : "この地点で物件を判定 →"}
        </button>
      </div>
    </div>
  );
}

// ── Back button ───────────────────────────────────────────────────────────────
function BackButton({ onClick, isEn }: { onClick: () => void; isEn: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
    >
      <ChevronLeft className="w-4 h-4" />
      {isEn ? "Back to menu" : "選び直す"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  isEn: boolean;
  locale: string;
  initialTopMode?: TopMode;
  initialPrefillCoords?: { lat: number; lng: number } | null;
  initialPropertyType?: PropertyType;
}

export function ResearchClient({
  isEn,
  locale,
  initialTopMode = "select",
  initialPrefillCoords = null,
  initialPropertyType = "mansion",
}: Props) {
  const [topMode,       setTopMode]      = useState<TopMode>(initialTopMode);
  const [result,        setResult]       = useState<AnalyzeResult | null>(null);
  const [isPending,     startTransition] = useTransition();
  const [dragCoords,    setDragCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [reanalyzing,   setReanalyzing]  = useState(false);
  const [prefillCoords, setPrefillCoords] = useState<{ lat: number; lng: number } | null>(initialPrefillCoords);
  const [propertyType,  setPropertyType] = useState<PropertyType>(initialPropertyType);
  const lastInputRef = useRef<PropertyInput | null>(null);
  const mapRef       = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  const handleSubmit = useCallback((input: PropertyInput) => {
    lastInputRef.current = input;
    setDragCoords(null);
    startTransition(async () => {
      const res = await analyzeProperty(input);
      setResult(res);
      if (res.ok) {
        setTopMode("result");
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

  const handleMapDrag = useCallback((lat: number, lng: number) => {
    setDragCoords({ lat, lng });
  }, []);

  const handleReanalyze = useCallback(() => {
    if (!lastInputRef.current || !dragCoords) return;
    const inputWithOverride: PropertyInput = {
      ...lastInputRef.current,
      coordOverride: dragCoords,
    };
    setReanalyzing(true);
    startTransition(async () => {
      const res = await analyzeProperty(inputWithOverride);
      setResult(res);
      setDragCoords(null);
      setReanalyzing(false);
    });
  }, [dragCoords]);

  const handleResetDrag = useCallback(() => {
    setDragCoords(null);
  }, []);

  const handleScrollToMap = useCallback(() => {
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSwitchToForm = useCallback((lat: number, lng: number) => {
    setPrefillCoords({ lat, lng });
    setTopMode("property-form");
  }, []);

  const handleBackToSelect = useCallback(() => {
    setTopMode("select");
    setResult(null);
    setPrefillCoords(null);
    setDragCoords(null);
  }, []);

  const handleNewSearch = useCallback(() => {
    setTopMode("select");
    setResult(null);
    setPrefillCoords(null);
    setDragCoords(null);
    lastInputRef.current = null;
  }, []);

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-10"
      style={{ "--research-map-h": "280px" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isEn ? "Property Research (β)" : "物件リサーチ（β）"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEn
            ? "Explore an area on the map or enter property details for a full analysis."
            : "地図でエリアを探すか、物件情報を入力して相場・リスク・将来性を分析します。"}
        </p>
      </div>

      {/* ── SELECT ── */}
      {topMode === "select" && (
        <SelectScreen
          isEn={isEn}
          locale={locale}
          onSelectA={() => setTopMode("property-form")}
          onSelectB={() => setTopMode("map-explore")}
        />
      )}

      {/* ── PROPERTY-FORM ── */}
      {topMode === "property-form" && (
        <>
          <BackButton onClick={handleBackToSelect} isEn={isEn} />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <PropertyForm
              onSubmit={handleSubmit}
              loading={isPending}
              isEn={isEn}
              prefillCoords={prefillCoords}
              propertyType={propertyType}
              onPropertyTypeChange={setPropertyType}
            />
          </div>

          {isPending && <StagedLoader isEn={isEn} />}

          {result && !result.ok && !isPending && (
            <div className="mt-8 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {result.error}
            </div>
          )}
        </>
      )}

      {/* ── MAP-EXPLORE ── */}
      {topMode === "map-explore" && (
        <>
          <BackButton onClick={handleBackToSelect} isEn={isEn} />
          <MapExplorePanel
            isEn={isEn}
            locale={locale}
            propertyType={propertyType}
            onPropertyTypeChange={setPropertyType}
            onSwitchToForm={handleSwitchToForm}
          />
        </>
      )}

      {/* ── RESULT ── */}
      {topMode === "result" && result && result.ok && !isPending && (
        <div className="space-y-4">
          {/* Geocode confirmation banner */}
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <div className="font-semibold mb-0.5">
                {isEn ? "Address confirmed" : "住所を確認しました"}
              </div>
              <div className="text-green-700">
                {result.coordOverrideUsed
                  ? isEn
                    ? `Map-selected point: ${result.coords.lat.toFixed(6)}, ${result.coords.lng.toFixed(6)}`
                    : `地図上で指定した地点: ${result.coords.lat.toFixed(6)}, ${result.coords.lng.toFixed(6)}`
                  : `${isEn ? "Coordinates" : "座標"}: ${result.coords.lat.toFixed(6)}, ${result.coords.lng.toFixed(6)}`
                }
              </div>
              {result.totalFetched > 0 && (
                <div className="text-green-700 mt-0.5">
                  {isEn
                    ? `${result.totalFetched} nearby transactions found (${result.similar.length} similar)`
                    : `周辺取引${result.totalFetched}件取得（類似物件${result.similar.length}件）`}
                </div>
              )}
            </div>
          </div>

          {/* Map with draggable marker */}
          <div ref={mapRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <ResearchMap
              mode="pin"
              lat={result.coords.lat}
              lng={result.coords.lng}
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
                      result.coords.lat, result.coords.lng,
                      dragCoords.lat,    dragCoords.lng
                    );
                    return isEn
                      ? `(${formatDistance(dist)} from original address)`
                      : `（元住所から${formatDistance(dist)}）`;
                  })()}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleResetDrag}
                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                  >
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
                      : (isEn ? "Re-analyze at this point" : "この地点で再調査する")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Auto-fill warning */}
          {result.autoFilledFields.length > 0 && (
            <AutoFillWarning
              result={result}
              isEn={isEn}
              onReenter={() => setTopMode("property-form")}
            />
          )}

          {/* Score card */}
          <ScoreCard result={result} isEn={isEn} onScrollToMap={handleScrollToMap} />

          {/* Nearby comparison points */}
          <NearbyComparisons result={result} isEn={isEn} />

          {/* Box plot chart */}
          {result.similar.length >= 3 && (
            <SimilarChart result={result} isEn={isEn} />
          )}

          {/* Seismic & terrain */}
          <SeismicCard result={result} isEn={isEn} />

          {/* Population trend */}
          <PopulationChart result={result} isEn={isEn} />

          {/* Share buttons */}
          {(() => {
            const s = calcPropertyScore(
              result.input.price ?? 0,
              result.similar.map((t) => t.price),
              result.hazard,
              result.input.mode,
              result.seismic,
              result.terrain,
              result.population
            );
            return (
              <ShareResearch
                grade={s.total.status === "ok" ? s.total.grade : "—"}
                score={s.total.status === "ok" ? s.total.score : 0}
                address={result.input.address}
                isEn={isEn}
                autoFilled={result.autoFilledFields.length > 0}
                propertyType={result.input.propertyType}
              />
            );
          })()}

          {result.similar.length === 0 && result.totalFetched > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              {isEn
                ? "No similar transactions matched even with widened filters. Try adjusting the input values."
                : "条件を広げても類似物件が見つかりませんでした。入力値を調整してみてください。"}
            </div>
          )}

          {/* New search CTA */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleNewSearch}
              className="w-full py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {isEn ? "← Analyze another property" : "← 別の物件を調べる"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
