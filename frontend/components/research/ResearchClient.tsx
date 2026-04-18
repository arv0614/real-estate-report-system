"use client";

import { useState, useTransition } from "react";
import { analyzeProperty } from "@/app/[locale]/research/actions";
import type { PropertyInput, AnalyzeResult } from "@/types/research";
import { PropertyForm } from "./PropertyForm";
import { SimilarChart } from "./SimilarChart";
import { ScoreCard } from "./ScoreCard";
import { SeismicCard } from "./SeismicCard";
import { useAuth } from "@/lib/useAuth";
import { saveResearchSession } from "@/lib/researchHistory";

interface Props {
  isEn: boolean;
}

export function ResearchClient({ isEn }: Props) {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  const handleSubmit = (input: PropertyInput) => {
    startTransition(async () => {
      const res = await analyzeProperty(input);
      setResult(res);

      if (res.ok && user) {
        saveResearchSession(user.uid, {
          address: input.address,
          lat: res.coords.lat,
          lng: res.coords.lng,
          price: input.price,
          area: input.area,
          builtYear: input.builtYear,
          mode: input.mode,
        }).catch(() => {});
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isEn ? "Property Research (β)" : "物件リサーチ（β）"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEn
            ? "Enter the property details to get a market analysis and risk assessment."
            : "住所・価格・面積を入力すると、相場比較・リスク・将来性を30秒で分析します。"}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <PropertyForm onSubmit={handleSubmit} loading={isPending} isEn={isEn} />
      </div>

      {/* Loading */}
      {isPending && (
        <div className="mt-8 flex items-center gap-3 text-slate-500 bg-white rounded-xl border border-slate-200 p-4">
          <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm">
            {isEn
              ? "Geocoding and fetching transaction data…"
              : "住所を確認し、取引データを取得しています…"}
          </span>
        </div>
      )}

      {/* Error */}
      {result && !result.ok && !isPending && (
        <div className="mt-8 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {/* Success: geocode confirmation */}
      {result && result.ok && !isPending && (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <div className="font-semibold mb-0.5">
                {isEn ? "Address confirmed" : "住所を確認しました"}
              </div>
              <div className="text-green-700">
                {isEn ? "Coordinates" : "座標"}: {result.coords.lat.toFixed(6)}, {result.coords.lng.toFixed(6)}
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

          {/* Score card — Task 1-3 */}
          <ScoreCard result={result} isEn={isEn} />

          {/* Box plot chart — Task 1-2 */}
          {result.similar.length >= 3 && (
            <SimilarChart result={result} isEn={isEn} />
          )}

          {/* Seismic & terrain — Task 2-1 */}
          <SeismicCard result={result} isEn={isEn} />

          {result.similar.length === 0 && result.totalFetched > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              {isEn
                ? "No similar transactions matched the filter (area ±20%, age ±5 years). Try adjusting the input values."
                : "条件に合う類似物件が見つかりませんでした（面積±20%・築年±5年）。入力値を調整してみてください。"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
