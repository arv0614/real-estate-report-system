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
import { MapPin, Navigation, Search, AlertTriangle, ChevronLeft, Loader2, ChevronDown } from "lucide-react";
import { TopReasons } from "./TopReasons";
import { ExternalMaps } from "./ExternalMaps";
import { SearchConditionCard } from "./SearchConditionCard";

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

type GeoState = "idle" | "requesting" | "resolving" | "error";

function SelectScreen({ isEn, locale, onSelectA, onSelectB }: SelectScreenProps) {
  const router = useRouter();
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const errMsg = {
    denied:    isEn ? "Location permission denied. Check browser settings." : "位置情報の許可が必要です。ブラウザ設定を確認してください。",
    unavail:   isEn ? "Location unavailable. Check network/GPS." : "位置情報を取得できませんでした。電波状況を確認してください。",
    timeout:   isEn ? "Location timed out. Please try again." : "位置情報の取得がタイムアウトしました。再度お試しください。",
    noSupport: isEn ? "Geolocation not supported." : "位置情報がサポートされていません。",
    https:     isEn ? "Location requires HTTPS." : "位置情報の取得にはHTTPS接続が必要です。",
    generic:   isEn ? "Could not get current location." : "現在地を取得できませんでした。",
  };

  const handleGeoCard = async () => {
    if (geoState === "requesting" || geoState === "resolving") return;

    const isHttps =
      typeof window === "undefined" ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";

    if (!isHttps) { setGeoError(errMsg.https); setGeoState("error"); return; }
    if (!navigator.geolocation) { setGeoError(errMsg.noSupport); setGeoState("error"); return; }

    // Permissions API — pre-check for denied state to avoid 8s wait
    if ("permissions" in navigator) {
      try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state === "denied") {
          setGeoError(errMsg.denied);
          setGeoState("error");
          return;
        }
      } catch { /* unsupported — proceed */ }
    }

    setGeoState("requesting");
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("resolving");
        const { latitude: lat, longitude: lng } = pos.coords;
        router.push(`/${locale}/research/area?lat=${lat}&lng=${lng}`);
      },
      (err) => {
        let msg = errMsg.generic;
        if (err.code === GeolocationPositionError.PERMISSION_DENIED)   msg = errMsg.denied;
        if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE) msg = errMsg.unavail;
        if (err.code === GeolocationPositionError.TIMEOUT)              msg = errMsg.timeout;
        setGeoError(msg);
        setGeoState("error");
      },
      { timeout: 8_000, enableHighAccuracy: false, maximumAge: 60_000 }
    );
  };

  const isGeoActive = geoState === "requesting" || geoState === "resolving";

  const geoStatusText = (() => {
    if (geoState === "requesting") return isEn ? "Getting location… (up to 8s)" : "位置情報を取得中…（最大8秒）";
    if (geoState === "resolving")  return isEn ? "Location found. Loading area…" : "取得完了。エリア情報を読み込み中…";
    return isEn ? "View area info for your current location" : "現在地のエリア情報を表示";
  })();

  const staticCards = [
    {
      key: "a",
      icon: "🏠",
      title: isEn ? "Analyze a property" : "物件を判定する",
      desc:  isEn ? "Compare price, risk & future outlook" : "価格・リスク・将来性を分析",
      onClick: onSelectA,
    },
    {
      key: "b",
      icon: "🗺️",
      title: isEn ? "Explore an area" : "エリアを探す",
      desc:  isEn ? "Browse market trends on the map" : "地図でエリアの特性を確認",
      onClick: onSelectB,
    },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Cards A & B */}
      {staticCards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={card.onClick}
          className="flex items-center gap-4 w-full text-left rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-blue-400 hover:shadow-md active:scale-[0.99] transition-all duration-150 group"
        >
          <span className="text-2xl flex-shrink-0 w-9 flex items-center justify-center">{card.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-700 transition-colors">{card.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{card.desc}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
        </button>
      ))}

      {/* Card C — geo */}
      <button
        type="button"
        onClick={handleGeoCard}
        disabled={isGeoActive}
        className={`flex items-center gap-4 w-full text-left rounded-2xl border px-5 py-4 shadow-sm active:scale-[0.99] transition-all duration-150 group ${
          geoState === "error"
            ? "border-amber-200 bg-amber-50"
            : isGeoActive
              ? "border-blue-200 bg-blue-50 cursor-wait opacity-80"
              : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md"
        }`}
      >
        <span className="text-2xl flex-shrink-0 w-9 flex items-center justify-center">
          {isGeoActive
            ? <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            : geoState === "error"
              ? "✗"
              : "📍"}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base leading-snug transition-colors ${
            geoState === "error" ? "text-amber-800" : isGeoActive ? "text-blue-700" : "text-slate-900 group-hover:text-blue-700"
          }`}>
            {isEn ? "Where I am now" : "今いる場所を調べる"}
          </p>
          <p className={`text-xs mt-0.5 leading-relaxed ${
            geoState === "error" ? "text-amber-700" : isGeoActive ? "text-blue-600" : "text-slate-400"
          }`}>
            {geoState === "error" ? geoError : geoStatusText}
          </p>
        </div>
        {!isGeoActive && geoState !== "error" && (
          <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
        )}
        {geoState === "error" && (
          <span className="text-xs text-amber-600 font-medium flex-shrink-0">
            {isEn ? "Retry" : "再試行"}
          </span>
        )}
      </button>

      {/* Alt route when geo fails */}
      {geoState === "error" && (
        <p className="text-xs text-slate-500 text-center">
          {isEn
            ? <>Or <button type="button" onClick={onSelectB} className="underline hover:text-slate-700">explore on the map</button> instead.</>
            : <>または <button type="button" onClick={onSelectB} className="underline hover:text-slate-700">地図でエリアを探す</button> からお試しください。</>}
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

function MapExplorePanel({ isEn, locale, propertyType, onSwitchToForm }: Omit<ExplorePanel, "onPropertyTypeChange">) {
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

  return (
    <div className="space-y-3">
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

      {/* Map — taller */}
      <div
        className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        style={{ "--research-map-h": "420px" } as React.CSSProperties}
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
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors mb-5"
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      {isEn ? "Back" : "← 選び直す"}
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
  const [detailOpen, setDetailOpen] = useState(false);
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
    setDetailOpen(true);
    setTimeout(() => {
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320); // wait for CSS expand transition
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
            onSwitchToForm={handleSwitchToForm}
          />
        </>
      )}

      {/* ── RESULT ── */}
      {topMode === "result" && result && result.ok && !isPending && (
        <div className="space-y-4">
          {/* Search condition card — topmost */}
          <SearchConditionCard
            result={result}
            isEn={isEn}
            onReenter={() => setTopMode("property-form")}
          />

          {/* Fallback warning banner — shown when national reference values were used */}
          {result.fallbackFilledFields.length > 0 && (
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
                  onClick={() => setTopMode("property-form")}
                  className="mt-2 text-xs font-semibold text-orange-700 underline hover:text-orange-900 transition-colors"
                >
                  {isEn ? "Enter accurate values →" : "正確な情報を入力する →"}
                </button>
              </div>
            </div>
          )}

          {/* Score card — always visible */}
          <ScoreCard result={result} isEn={isEn} onScrollToMap={handleScrollToMap} />

          {/* Top reasons — always visible */}
          <TopReasons
            inputPrice={result.input.price ?? 0}
            similarPrices={result.similar.map((t) => t.price)}
            seismic={result.seismic}
            population={result.population}
            isEn={isEn}
          />

          {/* External maps — always visible */}
          <ExternalMaps lat={result.coords.lat} lng={result.coords.lng} isEn={isEn} />

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

            <div
              className={`grid transition-all duration-300 ease-in-out ${detailOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
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
                        {result.coordOverrideUsed
                          ? isEn
                            ? `Map point: ${result.coords.lat.toFixed(5)}, ${result.coords.lng.toFixed(5)}`
                            : `地図指定: ${result.coords.lat.toFixed(5)}, ${result.coords.lng.toFixed(5)}`
                          : `${isEn ? "Coords" : "座標"}: ${result.coords.lat.toFixed(5)}, ${result.coords.lng.toFixed(5)}`
                        }
                      </div>
                      {result.totalFetched > 0 && (
                        <div className="mt-0.5">
                          {isEn
                            ? `${result.totalFetched} transactions found (${result.similar.length} similar)`
                            : `周辺取引${result.totalFetched}件（類似${result.similar.length}件）`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Map with draggable marker */}
                  <div ref={mapRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                              ? `(${formatDistance(dist)} from original)`
                              : `（元住所から${formatDistance(dist)}）`;
                          })()}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button type="button" onClick={handleResetDrag} className="text-xs text-slate-500 hover:text-slate-700 underline">
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

                  {result.similar.length === 0 && result.totalFetched > 0 && (
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

          {/* ActionBar */}
          <div className="space-y-3 pt-2">
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
