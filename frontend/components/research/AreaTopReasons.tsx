"use client";

import type { AreaSummaryResult } from "@/app/[locale]/research/area/areaActions";

interface Reason {
  icon: string;
  text: string;
  sentiment: "good" | "neutral" | "bad";
}

function extractReasons(result: AreaSummaryResult, txCount: number, isEn: boolean): Reason[] {
  const reasons: Reason[] = [];

  if (result.seismic) {
    const { riskLevel, probPct } = result.seismic;
    if (riskLevel === "low" || riskLevel === "very_low") {
      reasons.push({
        icon: "🟢",
        text: isEn
          ? `30-yr earthquake prob.: ${probPct}% (J-SHIS — relatively low)`
          : `30年地震確率: ${probPct}%（J-SHIS データ上、相対的に低い）`,
        sentiment: "good",
      });
    } else if (riskLevel === "moderate") {
      reasons.push({
        icon: "🟡",
        text: isEn
          ? `30-yr earthquake prob.: ${probPct}% (J-SHIS — moderate)`
          : `30年地震確率: ${probPct}%（J-SHIS データ上、中程度）`,
        sentiment: "neutral",
      });
    } else {
      reasons.push({
        icon: "🔴",
        text: isEn
          ? `30-yr earthquake prob.: ${probPct}% (J-SHIS — relatively high)`
          : `30年地震確率: ${probPct}%（J-SHIS データ上、相対的に高い）`,
        sentiment: "bad",
      });
    }
  }

  if (result.population) {
    const trend = result.population.trend;
    const pct = (trend * 100).toFixed(2);
    const sign = trend >= 0 ? "+" : "";
    if (trend >= 0.005) {
      reasons.push({
        icon: "📈",
        text: isEn
          ? `Population CAGR: ${sign}${pct}%/yr (e-Stat — increasing)`
          : `人口年変化率: ${sign}${pct}%/年（e-Stat — 増加傾向）`,
        sentiment: "good",
      });
    } else if (trend >= -0.005) {
      reasons.push({
        icon: "➡️",
        text: isEn
          ? `Population CAGR: ${sign}${pct}%/yr (e-Stat — stable)`
          : `人口年変化率: ${sign}${pct}%/年（e-Stat — 横ばい）`,
        sentiment: "neutral",
      });
    } else {
      reasons.push({
        icon: "📉",
        text: isEn
          ? `Population CAGR: ${sign}${pct}%/yr (e-Stat — declining)`
          : `人口年変化率: ${sign}${pct}%/年（e-Stat — 減少傾向）`,
        sentiment: "bad",
      });
    }
  }

  if (result.hazard) {
    const rank = result.hazard.flood.maxDepthRank ?? 0;
    if (rank === 0) {
      reasons.push({
        icon: "💧",
        text: isEn
          ? "Outside flood hazard zone (MLIT hazard map)"
          : "洪水ハザード区域外（国交省ハザードマップ）",
        sentiment: "good",
      });
    } else if (rank >= 3) {
      reasons.push({
        icon: "🌊",
        text: isEn
          ? `Flood depth rank ${rank} (MLIT hazard map)`
          : `洪水浸水ランク ${rank}（国交省ハザードマップ）`,
        sentiment: "bad",
      });
    }
    if (result.hazard.landslide.hasRisk) {
      reasons.push({
        icon: "⛰️",
        text: isEn
          ? "Landslide risk area designated (MLIT hazard map)"
          : "土砂災害警戒区域に指定あり（国交省ハザードマップ）",
        sentiment: "bad",
      });
    }
  }

  if (result.terrain?.terrainRisk) {
    const risk = result.terrain.terrainRisk;
    const cls = result.terrain.terrainClass ?? "";
    if (risk === "low") {
      reasons.push({
        icon: "🗾",
        text: isEn
          ? `Terrain: ${cls || "low risk"} (GSI terrain classification)`
          : `地形分類: ${cls || "低リスク地形"}（国土地理院）`,
        sentiment: "good",
      });
    } else if (risk === "high") {
      reasons.push({
        icon: "⚠️",
        text: isEn
          ? `Terrain: ${cls || "high risk"} (GSI terrain classification)`
          : `地形分類: ${cls || "高リスク地形"}（国土地理院）`,
        sentiment: "bad",
      });
    }
  }

  if (txCount >= 20) {
    reasons.push({
      icon: "🏘️",
      text: isEn
        ? `${txCount} transactions in area (MLIT real estate data)`
        : `周辺取引 ${txCount} 件（国交省 不動産取引価格情報）`,
      sentiment: "good",
    });
  } else if (txCount > 0 && txCount < 5) {
    reasons.push({
      icon: "📊",
      text: isEn
        ? `${txCount} transactions in area — limited sample (MLIT)`
        : `周辺取引 ${txCount} 件（国交省 — サンプル少数）`,
      sentiment: "neutral",
    });
  }

  return reasons.slice(0, 4);
}

interface Props {
  result: AreaSummaryResult;
  txCount: number;
  isEn: boolean;
}

export function AreaTopReasons({ result, txCount, isEn }: Props) {
  const reasons = extractReasons(result, txCount, isEn);
  if (reasons.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-900 mb-3">
        {isEn ? "Key Area Signals" : "エリアの主な指標"}
      </h3>
      <div className="space-y-2">
        {reasons.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 text-sm px-3 py-2 rounded-xl ${
              r.sentiment === "good"
                ? "bg-green-50 text-green-800"
                : r.sentiment === "bad"
                ? "bg-red-50 text-red-800"
                : "bg-slate-50 text-slate-700"
            }`}
          >
            <span className="text-base flex-shrink-0">{r.icon}</span>
            <span className="font-medium">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
