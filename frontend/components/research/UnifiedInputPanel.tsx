"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Navigation, Search, MapPin, Loader2, AlertCircle,
  BarChart3, Check, Clock, AlertTriangle,
} from "lucide-react";
import { PropertyForm } from "./PropertyForm";
import type { PropertyFormHandle } from "./PropertyForm";
import type { PropertyInput, PropertyMode, PropertyType } from "@/types/research";

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 };

type GeoState    = "idle" | "requesting" | "error";
type StepStatus  = "pending" | "active" | "done";
type SearchState = "idle" | "waiting" | "searching" | "done" | "error";
type ToastType   = "info" | "success" | "error";

interface Props {
  isEn: boolean;
  propertyType: PropertyType;
  onPropertyTypeChange: (t: PropertyType) => void;
  onPropertySubmit: (input: PropertyInput) => void;
  onAreaAnalyze: (lat: number, lng: number) => void;
  isPending: boolean;
  initialCenter?: { lat: number; lng: number } | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function haptic(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(3000) }
    );
    const data = await res.json();
    return (data?.results?.lv01Nm as string | undefined) ?? null;
  } catch { return null; }
}

async function geocodeQuery(q: string): Promise<{ lat: number; lng: number; title: string } | null> {
  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`
    );
    const json = await res.json();
    if (!json?.[0]?.geometry?.coordinates) return null;
    const [lng, lat] = json[0].geometry.coordinates as [number, number];
    const title = (json[0]?.properties?.title as string | undefined) ?? q;
    return { lat, lng, title };
  } catch { return null; }
}

// ── StepBadge ─────────────────────────────────────────────────────────────────
function StepBadge({ number, status }: { number: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 transition-all duration-200">
        <Check className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-teal-200 ring-offset-1 transition-all duration-200">
        {number}
      </span>
    );
  }
  return (
    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 text-xs font-bold flex items-center justify-center flex-shrink-0 transition-all duration-200">
      {number}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }: { toast: { msg: string; type: ToastType } }) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2 z-50 animate-fade-in whitespace-nowrap ${
        toast.type === "info"    ? "bg-blue-600 text-white" :
        toast.type === "success" ? "bg-green-600 text-white" :
                                   "bg-red-600 text-white"
      }`}
    >
      {toast.type === "info"    && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {toast.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
      {toast.type === "error"   && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span>{toast.msg}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function UnifiedInputPanel({
  isEn,
  propertyType,
  onPropertyTypeChange,
  onPropertySubmit,
  onAreaAnalyze,
  isPending,
  initialCenter,
}: Props) {
  const [mapCenter,          setMapCenter]          = useState(initialCenter ?? DEFAULT_CENTER);
  const [formCoords,         setFormCoords]         = useState<{ lat: number; lng: number } | null>(initialCenter ?? null);
  const [searchVal,          setSearchVal]          = useState("");
  const [searchState,        setSearchState]        = useState<SearchState>("idle");
  const [geoState,           setGeoState]           = useState<GeoState>("idle");
  const [geoError,           setGeoError]           = useState<string | null>(null);
  const [resolvedAddress,    setResolvedAddress]    = useState<string | null>(null);
  const [hasPropertyDetails, setHasPropertyDetails] = useState(false);
  const [mode,               setMode]               = useState<PropertyMode>("home");
  // Step completion tracking
  const [typeSelected,       setTypeSelected]       = useState(false);
  const [modeSelected,       setModeSelected]       = useState(false);
  const [locationSelected,   setLocationSelected]   = useState(initialCenter !== null);
  // Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef      = useRef<PropertyFormHandle | null>(null);

  // Step statuses
  const step1Status: StepStatus = typeSelected ? "done" : "active";
  const step2Status: StepStatus = typeSelected ? (modeSelected ? "done" : "active") : "pending";
  // step3 is done when location is selected; active when prior steps done; pending otherwise
  // locationSelected can be true from initialCenter even before type/mode are tapped
  const step3Status: StepStatus = locationSelected ? "done" : ((typeSelected && modeSelected) ? "active" : "pending");
  const step4Status: StepStatus = hasPropertyDetails ? "done" : "pending";

  const showToast = useCallback((msg: string, type: ToastType, duration = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  const handleGeolocate = useCallback(async () => {
    if (geoState === "requesting") return;
    haptic();

    const isHttps =
      typeof window === "undefined" ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";

    if (!isHttps) {
      setGeoError(isEn ? "Location requires HTTPS." : "位置情報の取得にはHTTPS接続が必要です。");
      setGeoState("error");
      return;
    }
    if (!navigator.geolocation) {
      setGeoError(isEn ? "Geolocation not supported." : "位置情報がサポートされていません。");
      setGeoState("error");
      return;
    }

    if ("permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        if (perm.state === "denied") {
          setGeoError(isEn ? "Location permission denied. Check browser settings." : "位置情報の許可が必要です。ブラウザ設定を確認してください。");
          setGeoState("error");
          return;
        }
      } catch { /* not supported — proceed */ }
    }

    setGeoState("requesting");
    setGeoError(null);
    showToast(isEn ? "Getting your location…" : "現在地を取得中…", "info", 5000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(coords);
        setFormCoords(coords);
        setGeoState("idle");
        setLocationSelected(true);
        haptic([10, 50, 10]);
        showToast(isEn ? "Location set ✓" : "現在地を取得しました ✓", "success", 2000);
        const addr = await reverseGeocode(coords.lat, coords.lng);
        setResolvedAddress(addr ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      },
      (err) => {
        let msg = isEn ? "Could not get location. Try address search." : "取得できませんでした。住所検索をお試しください。";
        if (err.code === GeolocationPositionError.PERMISSION_DENIED)
          msg = isEn ? "Location permission denied." : "位置情報の許可が必要です。";
        if (err.code === GeolocationPositionError.TIMEOUT)
          msg = isEn ? "Location timed out. Try address search." : "タイムアウトしました。住所検索をお試しください。";
        setGeoError(msg);
        setGeoState("error");
        showToast(msg, "error", 5000);
      },
      { timeout: 4000, enableHighAccuracy: false, maximumAge: 60_000 }
    );
  }, [geoState, isEn, showToast]);

  // ── Address search ───────────────────────────────────────────────────────────
  const runGeocode = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setSearchState("searching");
    try {
      const result = await geocodeQuery(q);
      if (result) {
        setMapCenter({ lat: result.lat, lng: result.lng });
        setFormCoords({ lat: result.lat, lng: result.lng });
        setResolvedAddress(result.title);
        setLocationSelected(true);
        setSearchState("done");
        // Reset "done" indicator after 2s
        setTimeout(() => setSearchState("idle"), 2000);
      } else {
        setSearchState("error");
        setTimeout(() => setSearchState("idle"), 3000);
      }
    } catch {
      setSearchState("error");
      setTimeout(() => setSearchState("idle"), 3000);
    }
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearchVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSearchState("idle");
      return;
    }
    setSearchState("waiting");
    debounceRef.current = setTimeout(() => runGeocode(val), 800);
  }, [runGeocode]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runGeocode(searchVal);
    }
  }, [searchVal, runGeocode]);

  // When PropertyForm resolves an address, sync the map
  const handleCoordsResolved = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setResolvedAddress(null);
    setLocationSelected(true);
  }, []);

  // Main CTA
  const handleMainCTA = useCallback(() => {
    haptic(10);
    if (hasPropertyDetails) {
      formRef.current?.submitForm();
    } else {
      onAreaAnalyze(mapCenter.lat, mapCenter.lng);
    }
  }, [hasPropertyDetails, mapCenter, onAreaAnalyze]);

  const isGeoActive = geoState === "requesting";

  const previewItems = isEn
    ? ["🌊 Hazard map (flood, landslide, tsunami)", "📊 Population trends & forecast", "🏘️ Nearby property price range"]
    : ["🌊 ハザードマップ（洪水・土砂・津波）", "📊 人口推移・将来予測", "🏘️ 周辺物件の相場"];

  return (
    <div className="space-y-5">

      {/* Toast overlay */}
      {toast && <Toast toast={toast} />}

      {/* ── STEP 1: Property type ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <StepBadge number={1} status={step1Status} />
          <h2 className="text-sm font-semibold text-slate-800">
            {isEn ? "What are you researching?" : "何を調べますか?"}
          </h2>
          <span className="text-xs text-red-400 font-medium ml-0.5">*</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["mansion", "house"] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => {
                haptic();
                onPropertyTypeChange(pt);
                setTypeSelected(true);
              }}
              className={`py-3 rounded-xl text-sm font-semibold transition-all duration-100 border-2 active:scale-95 ${
                propertyType === pt
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {pt === "mansion" ? (isEn ? "🏢 Apartment" : "🏢 マンション") : (isEn ? "🏠 House" : "🏠 戸建")}
            </button>
          ))}
        </div>
      </section>

      {/* ── STEP 2: Purpose / mode ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <StepBadge number={2} status={step2Status} />
          <h2 className="text-sm font-semibold text-slate-800">
            {isEn ? "What is the purpose?" : "どんな目的ですか?"}
          </h2>
          <span className="text-xs text-red-400 font-medium ml-0.5">*</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["home", "investment"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                haptic();
                setMode(m);
                setModeSelected(true);
              }}
              className={`py-3 rounded-xl text-sm font-semibold transition-all duration-100 border-2 active:scale-95 ${
                mode === m
                  ? m === "home"
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-amber-500 bg-amber-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {m === "home" ? (isEn ? "🏠 Home purchase" : "🏠 自宅購入") : (isEn ? "💼 Investment" : "💼 投資物件")}
            </button>
          ))}
        </div>
      </section>

      {/* ── STEP 3: Location ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <StepBadge number={3} status={step3Status} />
          <h2 className="text-sm font-semibold text-slate-800">
            {isEn ? "Where?" : "どこを調べますか?"}
          </h2>
          <span className="text-xs text-red-400 font-medium ml-0.5">*</span>
        </div>

        {/* Action bar: geo + address search */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={isGeoActive}
            title={isEn ? "Use current location" : "現在地を使用"}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-100 flex-shrink-0 active:scale-95 ${
              geoState === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : isGeoActive
                ? "border-blue-200 bg-blue-50 text-blue-600 cursor-wait opacity-80"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isGeoActive
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Navigation className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isGeoActive ? (isEn ? "Getting…" : "取得中…") : (isEn ? "My location" : "現在地")}
            </span>
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={isEn ? "Search area or address… (Enter to search)" : "エリアや住所で検索…（Enterで即検索）"}
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {/* Search state indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {searchState === "waiting" && (
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              )}
              {searchState === "searching" && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              )}
              {searchState === "done" && (
                <Check className="w-4 h-4 text-green-500" />
              )}
              {searchState === "error" && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Search hint for short input */}
        {searchVal.length > 0 && searchVal.trim().length < 2 && (
          <p className="text-xs text-slate-400 mb-2">
            {isEn ? "Enter 2+ characters to search" : "2文字以上入力すると検索します"}
          </p>
        )}

        {/* Geo error (inline, not toast) */}
        {geoState === "error" && geoError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {geoError}
            <button
              type="button"
              onClick={() => { setGeoState("idle"); setGeoError(null); }}
              className="ml-auto text-red-600 hover:text-red-800 underline"
            >
              {isEn ? "Dismiss" : "閉じる"}
            </button>
          </div>
        )}

        {/* Map */}
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden [--research-map-h:280px] sm:[--research-map-h:360px]">
          <ResearchMap
            mode="explore"
            lat={mapCenter.lat}
            lng={mapCenter.lng}
            onCenter={(lat, lng) => {
              setMapCenter({ lat, lng });
              setResolvedAddress(null);
              setLocationSelected(true);
            }}
          />
        </div>

        <p className="text-xs text-slate-400 text-center mt-1.5">
          {isEn ? "Drag the map to select an area" : "地図をドラッグしてエリアを選択"}
        </p>

        {/* Selected location display */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 flex items-center gap-2 mt-3">
          <MapPin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500">
              {isEn ? "Selected location" : "選択中のエリア"}
            </p>
            <p className="text-xs text-slate-700 truncate font-medium">
              {resolvedAddress ?? `${mapCenter.lat.toFixed(5)}, ${mapCenter.lng.toFixed(5)}`}
            </p>
          </div>
        </div>
      </section>

      {/* ── Preview list ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-xs font-semibold text-blue-800 mb-2">
          {isEn ? "This analysis includes:" : "このエリアでわかること"}
        </p>
        <ul className="space-y-1">
          {previewItems.map((item) => (
            <li key={item} className="text-xs text-blue-700">{item}</li>
          ))}
        </ul>
        {hasPropertyDetails && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <p className="text-xs text-blue-800 font-medium">
              {isEn ? "＋ Property details detected:" : "＋ 物件情報あり:"}
            </p>
            <ul className="space-y-0.5 mt-1">
              {[
                isEn ? "🎯 Comprehensive score (A–E)" : "🎯 総合判定スコア（A〜E）",
                isEn ? "📉 Price comparison & transaction data" : "📉 価格比較・過去取引データ",
              ].map((item) => (
                <li key={item} className="text-xs text-blue-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Main CTA ────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleMainCTA}
        disabled={isPending}
        className="w-full flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60 transition-all duration-100 active:scale-[0.98] shadow-sm"
      >
        {isPending ? (
          <>
            <span className="flex items-center gap-2 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEn ? "Analyzing…" : "分析中…"}
            </span>
            <span className="text-xs opacity-80 font-normal">
              {isEn ? "This takes about 10 seconds" : "10秒ほどかかります"}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-sm font-bold">
              {hasPropertyDetails ? <BarChart3 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              {hasPropertyDetails
                ? (isEn ? "Analyze this property" : "この物件を分析する")
                : (isEn ? "View area info" : "このエリアを調べる")}
            </span>
            <span className="text-xs opacity-80 font-normal">
              {hasPropertyDetails
                ? (isEn ? "Price comparison · risk · future outlook score" : "相場・リスク・将来性スコアを表示")
                : (isEn ? "Hazard · population · nearby prices" : "ハザード・人口・周辺相場を確認")}
            </span>
          </>
        )}
      </button>

      {/* Hint */}
      {!hasPropertyDetails && (
        <p className="text-xs text-slate-400 text-center -mt-2">
          {isEn
            ? "💡 Add property details below to get a full score (A–E)"
            : "💡 下に物件情報を入力すると総合判定スコア（A〜E）も表示されます"}
        </p>
      )}

      {/* ── STEP 4: Property details (collapsible) ───────────────────────────── */}
      <section>
        <details className="group">
          <summary
            onClick={() => haptic(5)}
            className="flex items-center gap-2 cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors select-none active:scale-[0.99]"
          >
            <StepBadge number={4} status={step4Status} />
            <span className="text-sm font-semibold text-slate-700 flex-1">
              {hasPropertyDetails
                ? (isEn ? "Property details (entered)" : "物件情報（入力済み）")
                : (isEn ? "Property details — optional" : "物件情報・詳細判定（任意）")}
            </span>
            <span className="text-xs text-slate-400 font-normal group-open:hidden">
              {isEn ? "tap to expand" : "タップで展開"}
            </span>
          </summary>

          <div className="mt-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <PropertyForm
              ref={formRef}
              onSubmit={onPropertySubmit}
              loading={isPending}
              isEn={isEn}
              prefillCoords={formCoords}
              propertyType={propertyType}
              onPropertyTypeChange={onPropertyTypeChange}
              mode={mode}
              onModeChange={setMode}
              showLocationInput={false}
              onCoordsResolved={handleCoordsResolved}
              onDetailsChange={setHasPropertyDetails}
              showSubmitButton={false}
              showTypeSelectors={false}
            />
          </div>
        </details>
      </section>

    </div>
  );
}
