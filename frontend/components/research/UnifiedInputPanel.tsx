"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Navigation, Search, MapPin, Loader2, AlertCircle } from "lucide-react";
import { PropertyForm } from "./PropertyForm";
import type { PropertyInput, PropertyType } from "@/types/research";

const ResearchMap = dynamic(
  () => import("./ResearchMap").then((m) => m.ResearchMap),
  { ssr: false }
);

const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 };

type GeoState = "idle" | "requesting" | "error";

interface Props {
  isEn: boolean;
  propertyType: PropertyType;
  onPropertyTypeChange: (t: PropertyType) => void;
  onPropertySubmit: (input: PropertyInput) => void;
  onAreaAnalyze: (lat: number, lng: number) => void;
  isPending: boolean;
  initialCenter?: { lat: number; lng: number } | null;
}

export function UnifiedInputPanel({
  isEn,
  propertyType,
  onPropertyTypeChange,
  onPropertySubmit,
  onAreaAnalyze,
  isPending,
  initialCenter,
}: Props) {
  const [mapCenter,  setMapCenter]  = useState(initialCenter ?? DEFAULT_CENTER);
  const [formCoords, setFormCoords] = useState<{ lat: number; lng: number } | null>(
    initialCenter ?? null
  );
  const [searchVal,  setSearchVal]  = useState("");
  const [searching,  setSearching]  = useState(false);
  const [geoState,   setGeoState]   = useState<GeoState>("idle");
  const [geoError,   setGeoError]   = useState<string | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Geolocation: updates map directly, no page navigation (U13-2) ────────────
  const handleGeolocate = useCallback(async () => {
    if (geoState === "requesting") return;

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

    // Permissions API pre-check to avoid 8s wait on denied
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(coords);
        setFormCoords(coords);
        setGeoState("idle");
      },
      (err) => {
        let msg = isEn ? "Could not get current location." : "現在地を取得できませんでした。";
        if (err.code === GeolocationPositionError.PERMISSION_DENIED)
          msg = isEn ? "Location permission denied." : "位置情報の許可が必要です。";
        if (err.code === GeolocationPositionError.TIMEOUT)
          msg = isEn ? "Location timed out. Try again." : "タイムアウトしました。再度お試しください。";
        setGeoError(msg);
        setGeoState("error");
      },
      { timeout: 4000, enableHighAccuracy: false, maximumAge: 60_000 }
    );
  }, [geoState, isEn]);

  // ── Address search (debounced, moves map) ────────────────────────────────────
  const handleSearchChange = useCallback((val: string) => {
    setSearchVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(val)}`
        );
        const json = await res.json();
        if (json?.[0]?.geometry?.coordinates) {
          const [lng, lat] = json[0].geometry.coordinates as [number, number];
          const coords = { lat, lng };
          setMapCenter(coords);
          setFormCoords(coords);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 700);
  }, []);

  // When PropertyForm resolves an address, sync the map
  const handleCoordsResolved = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  }, []);

  const isGeoActive = geoState === "requesting";

  return (
    <div className="space-y-4">

      {/* ── Action bar: geo + address search ─────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={isGeoActive}
          title={isEn ? "Use current location" : "現在地を使用"}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex-shrink-0 ${
            geoState === "error"
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : isGeoActive
              ? "border-blue-200 bg-blue-50 text-blue-600 cursor-wait opacity-80"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95"
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
            placeholder={isEn ? "Search area or address…" : "エリアや住所で検索…"}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Geo error */}
      {geoState === "error" && geoError && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {geoError}
          <button
            type="button"
            onClick={() => { setGeoState("idle"); setGeoError(null); }}
            className="ml-auto text-amber-600 hover:text-amber-800 underline"
          >
            {isEn ? "Dismiss" : "閉じる"}
          </button>
        </div>
      )}

      {/* ── Map ──────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden [--research-map-h:280px] sm:[--research-map-h:360px]">
        <ResearchMap
          mode="explore"
          lat={mapCenter.lat}
          lng={mapCenter.lng}
          onCenter={(lat, lng) => setMapCenter({ lat, lng })}
        />
      </div>

      <p className="text-xs text-slate-400 text-center -mt-2">
        {isEn ? "Drag the map to select an area" : "地図をドラッグしてエリアを選択"}
      </p>

      {/* ── Area info CTA (primary) ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onAreaAnalyze(mapCenter.lat, mapCenter.lng)}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors active:scale-[0.99]"
      >
        <MapPin className="w-4 h-4" />
        {isEn ? "View area info for this location" : "このエリアの情報を見る"}
      </button>

      {/* ── Property details (collapsible) ───────────────────────────────────── */}
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors select-none">
          <span>{isEn ? "▷ Property details & full analysis (optional)" : "▷ 物件情報・詳細判定（任意）"}</span>
          <span className="text-xs text-slate-400 font-normal group-open:hidden">{isEn ? "tap to expand" : "タップで展開"}</span>
        </summary>

        <div className="mt-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <PropertyForm
            onSubmit={onPropertySubmit}
            loading={isPending}
            isEn={isEn}
            prefillCoords={formCoords}
            propertyType={propertyType}
            onPropertyTypeChange={onPropertyTypeChange}
            showLocationInput={false}
            onCoordsResolved={handleCoordsResolved}
          />
        </div>
      </details>

    </div>
  );
}
