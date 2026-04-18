"use client";

import { useState } from "react";
import type { PropertyInput, PropertyMode } from "@/types/research";
import { UrlInput } from "./UrlInput";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";
import { PropertyInputSchema } from "@/lib/schemas/propertyInput";

interface Props {
  onSubmit: (input: PropertyInput) => void;
  loading: boolean;
  isEn: boolean;
}

const currentYear = new Date().getFullYear();

interface FieldErrors {
  address?: string;
  price?: string;
  area?: string;
  builtYear?: string;
}

export function PropertyForm({ onSubmit, loading, isEn }: Props) {
  const [address,   setAddress]   = useState("");
  const [price,     setPrice]     = useState("");
  const [area,      setArea]      = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [mode,      setMode]      = useState<PropertyMode>("home");
  const [errors,    setErrors]    = useState<FieldErrors>({});

  const t = {
    modeHome:     isEn ? "Home Purchase"     : "自宅購入",
    modeInvest:   isEn ? "Investment"        : "投資物件",
    addressLabel: isEn ? "Address"           : "住所",
    addressPh:    isEn ? "e.g. 1-19-11 Jinnan, Shibuya-ku, Tokyo" : "例: 東京都渋谷区神南1-19-11",
    priceLabel:   isEn ? "Price (¥10k)"      : "価格（万円）",
    areaLabel:    isEn ? "Floor area (㎡)"   : "専有面積（㎡）",
    yearLabel:    isEn ? "Year built"        : "建築年",
    yearPh:       isEn ? "e.g. 2000"         : "例: 2000",
    submit:       isEn ? "Analyze"           : "調査する",
    analyzing:    isEn ? "Analyzing…"        : "分析中…",
  };

  const handleParsed = (data: ParsedPropertyData) => {
    if (data.address)   setAddress(data.address);
    if (data.price)     setPrice(String(data.price));
    if (data.area)      setArea(String(data.area));
    if (data.builtYear) setBuiltYear(String(data.builtYear));
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = PropertyInputSchema.safeParse({
      address, price, area, builtYear, mode,
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

    onSubmit(result.data);
  };

  const inputCls = (hasError?: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-slate-300 bg-white"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* URL auto-fill */}
      <UrlInput onParsed={handleParsed} isEn={isEn} />

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

      {/* Address */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {t.addressLabel}
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t.addressPh}
          className={inputCls(!!errors.address)}
          required
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
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000"
            min={1}
            step="any"
            className={inputCls(!!errors.price)}
            required
          />
          {errors.price && (
            <p className="text-xs text-red-600 mt-1">{errors.price}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.areaLabel}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="70"
            min={0.01}
            step="any"
            className={inputCls(!!errors.area)}
            required
          />
          {errors.area && (
            <p className="text-xs text-red-600 mt-1">{errors.area}</p>
          )}
        </div>
      </div>

      {/* Built year */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {t.yearLabel}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={builtYear}
          onChange={(e) => setBuiltYear(e.target.value)}
          placeholder={t.yearPh}
          min={1900}
          max={currentYear}
          step="1"
          className={inputCls(!!errors.builtYear)}
          required
        />
        {errors.builtYear && (
          <p className="text-xs text-red-600 mt-1">{errors.builtYear}</p>
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
