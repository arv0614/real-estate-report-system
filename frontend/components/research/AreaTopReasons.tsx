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
    reasons.push({
      icon: riskLevel === "low" || riskLevel === "very_low" ? "🟢" : riskLevel === "moderate" ? "🟡" : "🔴",
      text: isEn
        ? `30-yr earthquake prob.: ${probPct}% (J-SHIS)`
        : `30年地震確率: ${probPct}%（J-SHIS）`,
      sentiment: riskLevel === "low" || riskLevel === "very_low" ? "good" : riskLevel === "moderate" ? "neutral" : "bad",
    });
  }

  if (result.population) {
    const trend = result.population.trend;
    const pct = (trend * 100).toFixed(2);
    const sign = trend >= 0 ? "+" : "";
    reasons.push({
      icon: trend >= 0.005 ? "📈" : trend >= -0.005 ? "➡️" : "📉",
      text: isEn
        ? `Population CAGR: ${sign}${pct}%/yr (e-Stat)`
        : `人口年変化率: ${sign}${pct}%/年（e-Stat）`,
      sentiment: trend >= 0.005 ? "good" : trend >= -0.005 ? "neutral" : "bad",
    });
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
          : "土砂災害警戒区域指定あり（国交省ハザードマップ）",
        sentiment: "bad",
      });
    }
  }

  if (result.terrain?.terrainRisk && result.terrain.terrainClass) {
    const cls = result.terrain.terrainClass;
    const risk = result.terrain.terrainRisk;
    reasons.push({
      icon: risk === "high" ? "⚠️" : "🗾",
      text: isEn
        ? `Terrain: ${cls} (GSI)`
        : `地形分類: ${cls}（国土地理院）`,
      sentiment: risk === "high" ? "bad" : risk === "low" ? "good" : "neutral",
    });
  }

  if (txCount >= 20) {
    reasons.push({
      icon: "🏘️",
      text: isEn
        ? `${txCount} transactions in area (MLIT)`
        : `周辺取引 ${txCount} 件（国交省不動産情報ライブラリ）`,
      sentiment: "good",
    });
  } else if (txCount > 0 && txCount < 5) {
    reasons.push({
      icon: "📊",
      text: isEn
        ? `${txCount} transactions in area (MLIT)`
        : `周辺取引 ${txCount} 件（国交省不動産情報ライブラリ）`,
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
