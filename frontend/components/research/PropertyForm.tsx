"use client";

import { useState } from "react";
import type { PropertyInput, PropertyMode } from "@/types/research";
import { UrlInput } from "./UrlInput";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";

interface Props {
  onSubmit: (input: PropertyInput) => void;
  loading: boolean;
  isEn: boolean;
}

const currentYear = new Date().getFullYear();

export function PropertyForm({ onSubmit, loading, isEn }: Props) {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [mode, setMode] = useState<PropertyMode>("home");

  const handleParsed = (data: ParsedPropertyData) => {
    if (data.address)   setAddress(data.address);
    if (data.price)     setPrice(String(data.price));
    if (data.area)      setArea(String(data.area));
    if (data.builtYear) setBuiltYear(String(data.builtYear));
  };

  const t = {
    modeHome:     isEn ? "Home Purchase" : "自宅購入",
    modeInvest:   isEn ? "Investment"    : "投資物件",
    addressLabel: isEn ? "Address"       : "住所",
    addressPh:    isEn ? "e.g. 1-19-11 Jinnan, Shibuya-ku, Tokyo" : "例: 東京都渋谷区神南1-19-11",
    priceLabel:   isEn ? "Price (¥10k)"  : "価格（万円）",
    areaLabel:    isEn ? "Floor area (㎡)" : "専有面積（㎡）",
    yearLabel:    isEn ? "Year built"    : "建築年",
    yearPh:       isEn ? "e.g. 2000"     : "例: 2000",
    submit:       isEn ? "Analyze"       : "調査する",
    analyzing:    isEn ? "Analyzing…"    : "分析中…",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      address: address.trim(),
      price: Number(price),
      area: Number(area),
      builtYear: Number(builtYear),
      mode,
    });
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

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
          className={inputCls}
          required
        />
      </div>

      {/* Price + Area */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.priceLabel}
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000"
            min={1}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.areaLabel}
          </label>
          <input
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="70"
            min={1}
            step="0.1"
            className={inputCls}
            required
          />
        </div>
      </div>

      {/* Built year */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {t.yearLabel}
        </label>
        <input
          type="number"
          value={builtYear}
          onChange={(e) => setBuiltYear(e.target.value)}
          placeholder={t.yearPh}
          min={1950}
          max={currentYear}
          className={inputCls}
          required
        />
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
