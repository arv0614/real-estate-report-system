"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { calcTopReasons } from "@/lib/scoring/topReasons";
import type { SeismicData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";

interface Props {
  inputPrice: number;
  similarPrices: number[];
  seismic: SeismicData | null;
  population: PopulationData | null;
  isEn: boolean;
}

export function TopReasons({ inputPrice, similarPrices, seismic, population, isEn }: Props) {
  const reasons = useMemo(
    () => calcTopReasons(inputPrice, similarPrices, seismic, population),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputPrice, JSON.stringify(similarPrices), seismic, population]
  );

  if (reasons.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {isEn ? "Key points" : "注目ポイント"}
      </p>
      <div className="space-y-1.5">
        {reasons.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
            r.sentiment === "good"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}>
            {r.sentiment === "good"
              ? <TrendingUp  className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              : <TrendingDown className="w-4 h-4 flex-shrink-0 text-red-500" />}
            {isEn ? r.textEn : r.textJa}
          </div>
        ))}
      </div>
    </div>
  );
}
