"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import type { PropertyInput, PropertyMode, PropertyType } from "@/types/research";
import { UrlInput } from "./UrlInput";
import { LocationInput } from "./LocationInput";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";
import { PropertyInputSchema } from "@/lib/schemas/propertyInput";
import { fetchAreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";

interface Props {
  onSubmit: (input: PropertyInput) => void;
  loading: boolean;
  isEn: boolean;
  prefillCoords?: { lat: number; lng: number } | null;
  prefillPropertyType?: PropertyType | null;
  propertyType: PropertyType;
  onPropertyTypeChange: (t: PropertyType) => void;
}

const currentYear = new Date().getFullYear();

interface FieldErrors {
  address?: string;
  price?: string;
  area?: string;
  builtYear?: string;
}

interface AutoFilledState {
  price: boolean;
  area: boolean;
  builtYear: boolean;
}

// Client-side geocode via GSI (used for address-blur trigger)
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
  } catch {
    return null;
  }
}

export function PropertyForm({
  onSubmit,
  loading,
  isEn,
  prefillCoords,
  prefillPropertyType,
  propertyType,
  onPropertyTypeChange,
}: Props) {
  const [address,   setAddress]   = useState("");
  const [price,     setPrice]     = useState("");
  const [area,      setArea]      = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [mode,      setMode]      = useState<PropertyMode>("home");
  const [errors,    setErrors]    = useState<FieldErrors>({});

  // U8: auto-fill state
  const [autoFilled, setAutoFilled] = useState<AutoFilledState>({
    price: false, area: false, builtYear: false,
  });
  const [coordsForDefaults, setCoordsForDefaults] = useState<{ lat: number; lng: number } | null>(null);

  // Caching & debounce refs
  const cacheRef     = useRef(new Map<string, AreaDefaults>());
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef   = useRef<string | null>(null);
  const fetchingRef  = useRef(false);

  // Sync prefillPropertyType when map tab pushes a type
  useEffect(() => {
    if (prefillPropertyType) onPropertyTypeChange(prefillPropertyType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillPropertyType]);

  // Apply medians to empty fields, mark them as auto-filled
  const applyDefaults = useCallback((defaults: AreaDefaults) => {
    if (defaults.sampleSize < 5) return;
    setPrice((v) => {
      if (!v && defaults.priceMedian !== null) {
        setAutoFilled((prev) => ({ ...prev, price: true }));
        return String(defaults.priceMedian);
      }
      return v;
    });
    setArea((v) => {
      if (!v && defaults.areaMedian !== null) {
        setAutoFilled((prev) => ({ ...prev, area: true }));
        return String(defaults.areaMedian);
      }
      return v;
    });
    setBuiltYear((v) => {
      if (!v && defaults.builtYearMedian !== null) {
        setAutoFilled((prev) => ({ ...prev, builtYear: true }));
        return String(defaults.builtYearMedian);
      }
      return v;
    });
  }, []);

  const fetchDefaultsIfNeeded = useCallback(async (lat: number, lng: number, pt: PropertyType) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${pt}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    if (cacheRef.current.has(key)) {
      applyDefaults(cacheRef.current.get(key)!);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const defaults = await fetchAreaDefaults(lat, lng, pt);
      cacheRef.current.set(key, defaults);
      applyDefaults(defaults);
    } catch {
      // silent failure — user enters manually
    } finally {
      fetchingRef.current = false;
    }
  }, [applyDefaults]);

  // Trigger auto-fill when prefillCoords arrives
  useEffect(() => {
    if (prefillCoords) {
      setCoordsForDefaults(prefillCoords);
      fetchDefaultsIfNeeded(prefillCoords.lat, prefillCoords.lng, propertyType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCoords?.lat, prefillCoords?.lng]);

  // Re-run defaults when propertyType changes and we already have coords
  useEffect(() => {
    if (coordsForDefaults) {
      lastKeyRef.current = null; // force re-fetch for new type
      fetchDefaultsIfNeeded(coordsForDefaults.lat, coordsForDefaults.lng, propertyType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  // Address blur: geocode then fetch defaults (debounced, min 5 chars)
  const handleAddressBlur = useCallback(() => {
    if (address.length < 5) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const coords = await geocodeAddressClient(address);
      if (coords) {
        setCoordsForDefaults(coords);
        fetchDefaultsIfNeeded(coords.lat, coords.lng, propertyType);
      }
    }, 600);
  }, [address, propertyType, fetchDefaultsIfNeeded]);

  // Handle data from UrlInput or LocationInput
  const handleParsed = useCallback((data: ParsedPropertyData) => {
    if (data.address)   setAddress(data.address);
    if (data.price)     setPrice(String(data.price));
    if (data.area)      setArea(String(data.area));
    if (data.builtYear) setBuiltYear(String(data.builtYear));
    if (data.propertyType) onPropertyTypeChange(data.propertyType);
    setErrors({});

    // If LocationInput passes coords, use them for defaults
    if (data.coordOverride) {
      setCoordsForDefaults(data.coordOverride);
      fetchDefaultsIfNeeded(data.coordOverride.lat, data.coordOverride.lng, data.propertyType ?? propertyType);
    } else if (data.address) {
      // Geocode the parsed address after a short delay
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const coords = await geocodeAddressClient(data.address!);
        if (coords) {
          setCoordsForDefaults(coords);
          fetchDefaultsIfNeeded(coords.lat, coords.lng, data.propertyType ?? propertyType);
        }
      }, 600);
    }
  }, [propertyType, onPropertyTypeChange, fetchDefaultsIfNeeded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = PropertyInputSchema.safeParse({
      address, price, area, builtYear, mode, propertyType,
    });

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
    });
  };

  const t = {
    modeHome:     isEn ? "Home Purchase"     : "自宅購入",
    modeInvest:   isEn ? "Investment"        : "投資物件",
    typeHouse:    isEn ? "🏠 House"          : "🏠 戸建",
    typeMansion:  isEn ? "🏢 Apartment"      : "🏢 マンション",
    addressLabel: isEn ? "Address"           : "住所",
    addressPh:    isEn ? "e.g. 1-19-11 Jinnan, Shibuya-ku, Tokyo" : "例: 東京都渋谷区神南1-19-11",
    priceLabel:   isEn ? "Price (¥10k)"      : "価格（万円）",
    areaLabel:    propertyType === "house"
      ? (isEn ? "Total floor area (㎡)" : "延床面積（㎡）")
      : (isEn ? "Floor area (㎡)" : "専有面積（㎡）"),
    yearLabel:    isEn ? "Year built"        : "建築年",
    yearPh:       isEn ? "e.g. 2000"         : "例: 2000",
    submit:       isEn ? "Analyze"           : "調査する",
    analyzing:    isEn ? "Analyzing…"        : "分析中…",
    autoHint:     isEn
      ? "⚠️ This is an area median, not your property's actual value. Please enter the real value."
      : "⚠️ エリア中央値で自動入力されました。あなたの検討物件の実際の値を入力してください。",
    optionalHint: isEn
      ? "💡 Leave blank to auto-fill with area median"
      : "💡 空欄でも調査できます（エリア中央値で補完）",
  };

  // CSS helpers for auto-filled vs normal inputs
  const inputCls = (hasError?: boolean, isAuto?: boolean) => {
    if (hasError) return "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition border-red-400 bg-red-50";
    if (isAuto)   return "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition border-yellow-300 bg-yellow-50";
    return "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition border-slate-300 bg-white";
  };

  const AutoBadge = () => (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" />
      {isEn ? "Auto" : "自動"}
    </span>
  );

  const hasAnyAutoFill = autoFilled.price || autoFilled.area || autoFilled.builtYear;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Prefill coords notice */}
      {prefillCoords && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
          <span>📍</span>
          {isEn
            ? `Location pre-set from map: ${prefillCoords.lat.toFixed(5)}, ${prefillCoords.lng.toFixed(5)}`
            : `地図で選択した地点を使用: ${prefillCoords.lat.toFixed(5)}, ${prefillCoords.lng.toFixed(5)}`}
        </div>
      )}

      {/* URL auto-fill */}
      <UrlInput onParsed={handleParsed} isEn={isEn} />

      {/* Location auto-fill (U7) */}
      <LocationInput onParsed={handleParsed} isEn={isEn} />

      {/* Mode selector */}
      <div className="flex gap-2">
        {(["home", "investment"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border-2 ${
              mode === m
                ? m === "home"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-amber-500 bg-amber-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {m === "home" ? t.modeHome : t.modeInvest}
          </button>
        ))}
      </div>

      {/* Property type selector (9-2) */}
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
            {pt === "mansion" ? t.typeMansion : t.typeHouse}
          </button>
        ))}
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {t.addressLabel}
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={handleAddressBlur}
          placeholder={t.addressPh}
          className={inputCls(!!errors.address)}
        />
        {errors.address && (
          <p className="text-xs text-red-600 mt-1">{errors.address}</p>
        )}
      </div>

      {/* Price + Area */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.priceLabel}
            {autoFilled.price && <AutoBadge />}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              if (autoFilled.price) setAutoFilled((prev) => ({ ...prev, price: false }));
            }}
            placeholder={hasAnyAutoFill ? "" : "5000"}
            min={1}
            step="any"
            className={inputCls(!!errors.price, autoFilled.price)}
          />
          {autoFilled.price && (
            <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t.autoHint.replace("⚠️ ", "")}
            </p>
          )}
          {errors.price && !autoFilled.price && (
            <p className="text-xs text-red-600 mt-1">{errors.price}</p>
          )}
          {!price && !autoFilled.price && (
            <p className="text-xs text-slate-400 mt-1">{t.optionalHint}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.areaLabel}
            {autoFilled.area && <AutoBadge />}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              if (autoFilled.area) setAutoFilled((prev) => ({ ...prev, area: false }));
            }}
            placeholder={hasAnyAutoFill ? "" : "70"}
            min={0.01}
            step="any"
            className={inputCls(!!errors.area, autoFilled.area)}
          />
          {autoFilled.area && (
            <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t.autoHint.replace("⚠️ ", "")}
            </p>
          )}
          {errors.area && !autoFilled.area && (
            <p className="text-xs text-red-600 mt-1">{errors.area}</p>
          )}
          {!area && !autoFilled.area && (
            <p className="text-xs text-slate-400 mt-1">{t.optionalHint}</p>
          )}
        </div>
      </div>

      {/* Built year */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {t.yearLabel}
          {autoFilled.builtYear && <AutoBadge />}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={builtYear}
          onChange={(e) => {
            setBuiltYear(e.target.value);
            if (autoFilled.builtYear) setAutoFilled((prev) => ({ ...prev, builtYear: false }));
          }}
          placeholder={hasAnyAutoFill ? "" : t.yearPh}
          min={1900}
          max={currentYear}
          step="1"
          className={inputCls(!!errors.builtYear, autoFilled.builtYear)}
        />
        {autoFilled.builtYear && (
          <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t.autoHint.replace("⚠️ ", "")}
          </p>
        )}
        {errors.builtYear && !autoFilled.builtYear && (
          <p className="text-xs text-red-600 mt-1">{errors.builtYear}</p>
        )}
        {!builtYear && !autoFilled.builtYear && (
          <p className="text-xs text-slate-400 mt-1">{t.optionalHint}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
          mode === "investment"
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t.analyzing}
          </span>
        ) : (
          t.submit
        )}
      </button>
    </form>
  );
}
