"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { PropertyInput, PropertyMode, PropertyType } from "@/types/research";
import { UrlInput } from "./UrlInput";
import { LocationInput } from "./LocationInput";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";
import { PropertyInputSchema } from "@/lib/schemas/propertyInput";
import { fetchAreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";
import { fetchDefaultsIfNeeded as _fetchDefaultsIfNeeded, makeDefaultsCacheKey, type DefaultsCacheState } from "@/lib/research/defaultsCache";
import { FALLBACK_DEFAULTS } from "@/lib/research/fallbackDefaults";

interface Props {
  onSubmit: (input: PropertyInput) => void;
  loading: boolean;
  isEn: boolean;
  prefillCoords?: { lat: number; lng: number } | null;
  propertyType: PropertyType;
  onPropertyTypeChange: (t: PropertyType) => void;
}

const currentYear = new Date().getFullYear();

interface FieldErrors { address?: string; price?: string; area?: string; builtYear?: string; }
interface AutoFilledState { price: boolean; area: boolean; builtYear: boolean; }

async function geocodeAddressClient(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const [lng, lat] = data[0].geometry.coordinates as [number, number];
    return { lat, lng };
  } catch { return null; }
}

export function PropertyForm({ onSubmit, loading, isEn, prefillCoords, propertyType, onPropertyTypeChange }: Props) {
  const [address,   setAddress]   = useState("");
  const [price,     setPrice]     = useState("");
  const [area,      setArea]      = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [mode,      setMode]      = useState<PropertyMode>("home");
  const [errors,    setErrors]    = useState<FieldErrors>({});
  const [autoFilled,    setAutoFilled]    = useState<AutoFilledState>({ price: false, area: false, builtYear: false });
  const [fallbackFilled, setFallbackFilled] = useState<AutoFilledState>({ price: false, area: false, builtYear: false });
  const [coordsForDefaults, setCoordsForDefaults] = useState<{ lat: number; lng: number } | null>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [defaultsError,   setDefaultsError]   = useState<string | null>(null);

  const cacheStateRef = useRef<DefaultsCacheState>({ cache: new Map(), lastKey: null, fetching: false });
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply national fallback medians when area data is unavailable
  const applyFallbackDefaults = useCallback((pt: PropertyType) => {
    const fb = FALLBACK_DEFAULTS[pt];
    setPrice((v)      => { if (!v) { setFallbackFilled((p) => ({ ...p, price: true }));     return String(fb.priceMedian);     } return v; });
    setArea((v)       => { if (!v) { setFallbackFilled((p) => ({ ...p, area: true }));      return String(fb.areaMedian);      } return v; });
    setBuiltYear((v)  => { if (!v) { setFallbackFilled((p) => ({ ...p, builtYear: true })); return String(fb.builtYearMedian); } return v; });
  }, []);

  const applyDefaults = useCallback((defaults: AreaDefaults) => {
    if (defaults.sampleSize >= 5) {
      // Area median — clear any prior fallback marks for fields being overwritten
      setPrice((v)     => { if (!v && defaults.priceMedian !== null)     { setAutoFilled((p) => ({ ...p, price: true }));     setFallbackFilled((p) => ({ ...p, price: false }));     return String(defaults.priceMedian);     } return v; });
      setArea((v)      => { if (!v && defaults.areaMedian !== null)      { setAutoFilled((p) => ({ ...p, area: true }));      setFallbackFilled((p) => ({ ...p, area: false }));      return String(defaults.areaMedian);      } return v; });
      setBuiltYear((v) => { if (!v && defaults.builtYearMedian !== null) { setAutoFilled((p) => ({ ...p, builtYear: true })); setFallbackFilled((p) => ({ ...p, builtYear: false })); return String(defaults.builtYearMedian); } return v; });
    } else {
      // No local data — use national reference
      applyFallbackDefaults(propertyType);
    }
  }, [propertyType, applyFallbackDefaults]);

  // Also apply fallback when fetch errors out
  useEffect(() => {
    if (defaultsError) {
      applyFallbackDefaults(propertyType);
      setDefaultsError(null); // suppress error banner — fallback handles it
    }
  }, [defaultsError, propertyType, applyFallbackDefaults]);

  const fetchDefaultsIfNeeded = useCallback(async (lat: number, lng: number, pt: PropertyType) => {
    await _fetchDefaultsIfNeeded(lat, lng, pt, cacheStateRef.current, {
      applyDefaults,
      setLoading: setDefaultsLoading,
      setError: setDefaultsError,
      fetchFn: fetchAreaDefaults,
    });
  }, [applyDefaults]);

  useEffect(() => {
    if (prefillCoords) {
      setCoordsForDefaults(prefillCoords);
      fetchDefaultsIfNeeded(prefillCoords.lat, prefillCoords.lng, propertyType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCoords?.lat, prefillCoords?.lng]);

  useEffect(() => {
    if (coordsForDefaults) {
      fetchDefaultsIfNeeded(coordsForDefaults.lat, coordsForDefaults.lng, propertyType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  const handleAddressBlur = useCallback(() => {
    if (address.length < 5) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const coords = await geocodeAddressClient(address);
      if (coords) { setCoordsForDefaults(coords); fetchDefaultsIfNeeded(coords.lat, coords.lng, propertyType); }
    }, 600);
  }, [address, propertyType, fetchDefaultsIfNeeded]);

  const handleParsed = useCallback((data: ParsedPropertyData) => {
    if (data.address)      setAddress(data.address);
    if (data.price)        setPrice(String(data.price));
    if (data.area)         setArea(String(data.area));
    if (data.builtYear)    setBuiltYear(String(data.builtYear));
    if (data.propertyType) onPropertyTypeChange(data.propertyType);
    setErrors({});
    if (data.coordOverride) {
      setCoordsForDefaults(data.coordOverride);
      fetchDefaultsIfNeeded(data.coordOverride.lat, data.coordOverride.lng, data.propertyType ?? propertyType);
    } else if (data.address) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const coords = await geocodeAddressClient(data.address!);
        if (coords) { setCoordsForDefaults(coords); fetchDefaultsIfNeeded(coords.lat, coords.lng, data.propertyType ?? propertyType); }
      }, 600);
    }
  }, [propertyType, onPropertyTypeChange, fetchDefaultsIfNeeded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = PropertyInputSchema.safeParse({ address, price, area, builtYear, mode, propertyType });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const err of result.error.issues) {
        const field = err.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      }
      setErrors(fieldErrors);
      return;
    }
    onSubmit({
      ...result.data,
      ...(prefillCoords ? { coordOverride: prefillCoords } : {}),
      ...(coordsForDefaults && !prefillCoords ? { coordOverride: coordsForDefaults } : {}),
      autoFilled: {
        price:     autoFilled.price     || undefined,
        area:      autoFilled.area      || undefined,
        builtYear: autoFilled.builtYear || undefined,
      },
      fallbackFilled: {
        price:     fallbackFilled.price     || undefined,
        area:      fallbackFilled.area      || undefined,
        builtYear: fallbackFilled.builtYear || undefined,
      },
    });
  };

  const t = {
    modeHome:    isEn ? "🏠 Home"       : "🏠 自宅購入",
    modeInvest:  isEn ? "💼 Investment" : "💼 投資物件",
    typeMansion: isEn ? "🏢 Apartment"  : "🏢 マンション",
    typeHouse:   isEn ? "🏠 House"      : "🏠 戸建",
    orLabel:     isEn ? "or"            : "または",
    manualLabel: isEn ? "Manual entry"  : "手動入力",
    addrLabel:   isEn ? "Address *"     : "住所 *",
    addrPh:      isEn ? "e.g. 1-19-11 Jinnan, Shibuya-ku, Tokyo" : "例: 東京都渋谷区神南1-19-11",
    priceLabel:  isEn ? "Price (¥10k)"  : "価格（万円）",
    areaLabel:   propertyType === "house" ? (isEn ? "Total floor area (㎡)" : "延床面積（㎡）") : (isEn ? "Floor area (㎡)" : "専有面積（㎡）"),
    yearLabel:   isEn ? "Year built"    : "建築年",
    yearPh:      isEn ? "e.g. 2000"     : "例: 2000",
    submit:      isEn ? "Analyze"       : "判定する",
    analyzing:   isEn ? "Analyzing…"   : "分析中…",
    autoHint:      isEn ? "Area median — enter actual value for accuracy" : "エリア中央値です。実際の値を入力すると精度が上がります",
    fallbackHint:  isEn ? "National reference (no local data) — enter actual value for accuracy" : "全国参考値（エリアデータなし）。実際の値を入力すると精度が上がります",
    fallbackBanner:isEn
      ? "⚠️ No local area data — using national reference medians. Results will be less accurate than usual."
      : "⚠️ このエリアの取引データが不足しています。全国参考値（中古マンション全国中央値相当）で分析します。実際の物件情報を入力すると精度が上がります。",
    optHint:       isEn ? "💡 Leave blank to auto-fill with area median" : "💡 空欄はエリア中央値で補完されます",
    loadingHint:   isEn ? "Fetching area median…" : "エリア中央値を取得中…",
    errorHint:     isEn ? "Could not load area median. Enter manually." : "エリア中央値を取得できませんでした。手動で入力してください。",
  };

  const inputCls = (hasErr?: boolean, isAuto?: boolean) => {
    if (hasErr)  return "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
    if (isAuto)  return "w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white";
    return "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  };

  const AutoBadge = () => (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" />
      {isEn ? "Area median" : "中央値"}
    </span>
  );

  const FallbackBadge = () => (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" />
      {isEn ? "National ref." : "全国参考値"}
    </span>
  );

  const hasFallback = fallbackFilled.price || fallbackFilled.area || fallbackFilled.builtYear;
  const hasAny = autoFilled.price || autoFilled.area || autoFilled.builtYear || hasFallback;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* prefill coords notice */}
      {prefillCoords && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
          <span>📍</span>
          {isEn
            ? `Location from map: ${prefillCoords.lat.toFixed(5)}, ${prefillCoords.lng.toFixed(5)}`
            : `地図の地点を使用: ${prefillCoords.lat.toFixed(5)}, ${prefillCoords.lng.toFixed(5)}`}
        </div>
      )}

      {/* URL auto-fill */}
      <UrlInput onParsed={handleParsed} isEn={isEn} />

      {/* Divider: or */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">{t.orLabel}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Location auto-fill */}
      <LocationInput onParsed={handleParsed} isEn={isEn} />

      {/* Divider: manual entry */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-500 font-semibold">{t.manualLabel}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Mode + Type selectors */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {(["home", "investment"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`py-2 rounded-xl text-sm font-semibold transition-colors border-2 ${
                mode === m
                  ? m === "home" ? "border-blue-600 bg-blue-600 text-white" : "border-amber-500 bg-amber-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}>
              {m === "home" ? t.modeHome : t.modeInvest}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["mansion", "house"] as const).map((pt) => (
            <button key={pt} type="button" onClick={() => onPropertyTypeChange(pt)}
              className={`py-2 rounded-xl text-sm font-semibold transition-colors border-2 ${
                propertyType === pt
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}>
              {pt === "mansion" ? t.typeMansion : t.typeHouse}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">{t.addrLabel}</label>
        <input type="text" value={address}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={handleAddressBlur}
          placeholder={t.addrPh}
          className={inputCls(!!errors.address)} />
        {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
      </div>

      {/* Defaults loading banner */}
      {defaultsLoading && !hasAny && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          {t.loadingHint}
        </div>
      )}

      {/* Fallback banner — shown when local data is unavailable */}
      {hasFallback && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5 text-xs text-orange-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-orange-500" />
          <p className="leading-relaxed">{t.fallbackBanner}</p>
        </div>
      )}

      {/* Price + Area */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {t.priceLabel}
            {autoFilled.price    && <AutoBadge />}
            {fallbackFilled.price && <FallbackBadge />}
            {defaultsLoading && !price && <Loader2 className="inline w-3 h-3 ml-1 animate-spin text-blue-400" />}
          </label>
          <input type="number" inputMode="decimal" value={price}
            onChange={(e) => { setPrice(e.target.value); setAutoFilled((p) => ({ ...p, price: false })); setFallbackFilled((p) => ({ ...p, price: false })); }}
            placeholder={defaultsLoading && !price ? t.loadingHint : hasAny ? "" : "5000"}
            min={1} step="any"
            className={inputCls(!!errors.price, autoFilled.price || fallbackFilled.price)} />
          {autoFilled.price
            ? <p className="text-xs text-yellow-700 mt-0.5">{t.autoHint}</p>
            : fallbackFilled.price
              ? <p className="text-xs text-orange-700 mt-0.5">{t.fallbackHint}</p>
              : errors.price ? <p className="text-xs text-red-600 mt-0.5">{errors.price}</p>
              : !price && !defaultsLoading && <p className="text-xs text-slate-400 mt-0.5">{t.optHint}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {t.areaLabel}
            {autoFilled.area    && <AutoBadge />}
            {fallbackFilled.area && <FallbackBadge />}
            {defaultsLoading && !area && <Loader2 className="inline w-3 h-3 ml-1 animate-spin text-blue-400" />}
          </label>
          <input type="number" inputMode="decimal" value={area}
            onChange={(e) => { setArea(e.target.value); setAutoFilled((p) => ({ ...p, area: false })); setFallbackFilled((p) => ({ ...p, area: false })); }}
            placeholder={defaultsLoading && !area ? t.loadingHint : hasAny ? "" : "70"}
            min={0.01} step="any"
            className={inputCls(!!errors.area, autoFilled.area || fallbackFilled.area)} />
          {autoFilled.area
            ? <p className="text-xs text-yellow-700 mt-0.5">{t.autoHint}</p>
            : fallbackFilled.area
              ? <p className="text-xs text-orange-700 mt-0.5">{t.fallbackHint}</p>
              : errors.area ? <p className="text-xs text-red-600 mt-0.5">{errors.area}</p>
              : !area && !defaultsLoading && <p className="text-xs text-slate-400 mt-0.5">{t.optHint}</p>}
        </div>
      </div>

      {/* Built year */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          {t.yearLabel}
          {autoFilled.builtYear    && <AutoBadge />}
          {fallbackFilled.builtYear && <FallbackBadge />}
          {defaultsLoading && !builtYear && <Loader2 className="inline w-3 h-3 ml-1 animate-spin text-blue-400" />}
        </label>
        <input type="number" inputMode="decimal" value={builtYear}
          onChange={(e) => { setBuiltYear(e.target.value); setAutoFilled((p) => ({ ...p, builtYear: false })); setFallbackFilled((p) => ({ ...p, builtYear: false })); }}
          placeholder={defaultsLoading && !builtYear ? t.loadingHint : hasAny ? "" : t.yearPh}
          min={1900} max={currentYear} step="1"
          className={inputCls(!!errors.builtYear, autoFilled.builtYear || fallbackFilled.builtYear)} />
        {autoFilled.builtYear
          ? <p className="text-xs text-yellow-700 mt-0.5">{t.autoHint}</p>
          : fallbackFilled.builtYear
            ? <p className="text-xs text-orange-700 mt-0.5">{t.fallbackHint}</p>
            : errors.builtYear ? <p className="text-xs text-red-600 mt-0.5">{errors.builtYear}</p>
            : !builtYear && !defaultsLoading && <p className="text-xs text-slate-400 mt-0.5">{t.optHint}</p>}
      </div>

      <button type="submit" disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all shadow-sm disabled:opacity-60 ${
          mode === "investment" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
        }`}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t.analyzing}
          </span>
        ) : t.submit}
      </button>
    </form>
  );
}
