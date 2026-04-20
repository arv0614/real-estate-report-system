"use client";

import { AlertTriangle, MapPin, RefreshCw } from "lucide-react";
import type { AnalyzeResult } from "@/types/research";

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
  onReenter: () => void;
}

type FieldFill = "area" | "fallback" | "user";

export function SearchConditionCard({ result, isEn, onReenter }: Props) {
  const { input, autoFilledFields, fallbackFilledFields, coordOverrideUsed, coords } = result;

  const typeLbl = input.propertyType === "house"
    ? (isEn ? "🏠 House" : "🏠 戸建")
    : (isEn ? "🏢 Apartment" : "🏢 マンション");
  const modeLbl = input.mode === "investment"
    ? (isEn ? "Investment" : "投資物件")
    : (isEn ? "Home purchase" : "自宅購入");

  const fieldFill = (field: string): FieldFill => {
    if (fallbackFilledFields?.includes(field)) return "fallback";
    if (autoFilledFields.includes(field))       return "area";
    return "user";
  };

  const rows: Array<{ label: string; value: string; fill: FieldFill }> = [
    {
      label: isEn ? "Address" : "住所",
      value: coordOverrideUsed
        ? (isEn ? `📍 Map point: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : `📍 地図で指定した地点: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        : input.address,
      fill: "user",
    },
    {
      label: isEn ? "Type / Mode" : "種別・用途",
      value: `${typeLbl} · ${modeLbl}`,
      fill: "user",
    },
    {
      label: isEn ? "Price" : "価格",
      value: input.price ? `${input.price.toLocaleString()}万円` : "—",
      fill: fieldFill("price"),
    },
    {
      label: input.propertyType === "house" ? (isEn ? "Total floor area" : "延床面積") : (isEn ? "Floor area" : "専有面積"),
      value: input.area ? `${input.area}㎡` : "—",
      fill: fieldFill("area"),
    },
    {
      label: isEn ? "Year built" : "建築年",
      value: input.builtYear ? `${input.builtYear}年` : "—",
      fill: fieldFill("builtYear"),
    },
  ];

  const hasFallback = fallbackFilledFields?.length > 0;
  const hasAutoFill = autoFilledFields.length > 0;
  const hasEstimated = hasAutoFill || hasFallback;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {isEn ? "Search conditions" : "調査条件"}
            </span>
          </div>
          {hasFallback && (
            <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
              <AlertTriangle className="w-3 h-3" />
              {isEn ? "Using national reference values" : "全国参考値を使用"}
            </span>
          )}
          {!hasFallback && hasAutoFill && (
            <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
              <AlertTriangle className="w-3 h-3" />
              {isEn ? "Some values estimated" : "一部推計値を含む"}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-start gap-3 text-xs py-1 rounded-lg ${
              row.fill === "area" ? "bg-yellow-50 px-2 -mx-2" :
              row.fill === "fallback" ? "bg-orange-50 px-2 -mx-2" : ""
            }`}
          >
            <span className="text-slate-400 w-20 flex-shrink-0 pt-0.5">{row.label}</span>
            <div className="flex items-center gap-1.5 flex-1 flex-wrap">
              <span className={`font-medium ${
                row.fill === "area" ? "text-yellow-800" :
                row.fill === "fallback" ? "text-orange-800" :
                "text-slate-800"
              }`}>
                {row.value}
              </span>
              {row.fill === "area" && (
                <span className="flex items-center gap-0.5 text-yellow-700 bg-yellow-100 border border-yellow-200 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {isEn ? "Area median" : "エリア中央値"}
                </span>
              )}
              {row.fill === "fallback" && (
                <span className="flex items-center gap-0.5 text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {isEn ? "National reference" : "全国参考値"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={onReenter}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isEn ? "Change conditions and re-analyze" : "条件を変えて再調査する"}
        </button>
      </div>
    </div>
  );
}
