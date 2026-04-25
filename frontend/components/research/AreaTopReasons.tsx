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
      reasons.push({ icon: "🟢", text: isEn ? `Low earthquake risk (${probPct}% in 30 yr)` : `地震リスク低（30年確率 ${probPct}%）`, sentiment: "good" });
    } else if (riskLevel === "moderate") {
      reasons.push({ icon: "🟡", text: isEn ? `Moderate earthquake risk (${probPct}% in 30 yr)` : `地震リスク中（30年確率 ${probPct}%）`, sentiment: "neutral" });
    } else {
      reasons.push({ icon: "🔴", text: isEn ? `High earthquake risk (${probPct}% in 30 yr)` : `地震リスク高（30年確率 ${probPct}%）`, sentiment: "bad" });
    }
  }

  if (result.population) {
    const trend = result.population.trend;
    const pct = (trend * 100).toFixed(1);
    const sign = trend >= 0 ? "+" : "";
    if (trend >= 0.005) {
      reasons.push({ icon: "📈", text: isEn ? `Population growing (${sign}${pct}%/yr)` : `人口増加中（${sign}${pct}%/年）`, sentiment: "good" });
    } else if (trend >= -0.005) {
      reasons.push({ icon: "➡️", text: isEn ? `Stable population (${sign}${pct}%/yr)` : `人口横ばい（${sign}${pct}%/年）`, sentiment: "neutral" });
    } else {
      reasons.push({ icon: "📉", text: isEn ? `Population declining (${sign}${pct}%/yr)` : `人口減少傾向（${sign}${pct}%/年）`, sentiment: "bad" });
    }
  }

  if (result.hazard) {
    const rank = result.hazard.flood.maxDepthRank ?? 0;
    if (rank === 0) {
      reasons.push({ icon: "💧", text: isEn ? "Outside flood hazard zone" : "洪水ハザードゾーン外", sentiment: "good" });
    } else if (rank >= 3) {
      reasons.push({ icon: "🌊", text: isEn ? `Flood risk — depth rank ${rank}` : `洪水リスクあり（浸水ランク ${rank}）`, sentiment: "bad" });
    }
    if (result.hazard.landslide.hasRisk) {
      reasons.push({ icon: "⛰️", text: isEn ? "Landslide risk area" : "土砂災害リスク区域あり", sentiment: "bad" });
    }
  }

  if (result.terrain?.terrainRisk) {
    const risk = result.terrain.terrainRisk;
    const cls = result.terrain.terrainClass ?? "";
    if (risk === "low") {
      reasons.push({ icon: "🗾", text: isEn ? `Low terrain risk${cls ? ` (${cls})` : ""}` : `地形リスク低${cls ? `（${cls}）` : ""}`, sentiment: "good" });
    } else if (risk === "high") {
      reasons.push({ icon: "⚠️", text: isEn ? `High terrain risk${cls ? ` (${cls})` : ""}` : `地形リスク高${cls ? `（${cls}）` : ""}`, sentiment: "bad" });
    }
  }

  if (txCount >= 20) {
    reasons.push({ icon: "🏘️", text: isEn ? `Active market (${txCount} transactions)` : `取引活性（${txCount}件）`, sentiment: "good" });
  } else if (txCount > 0 && txCount < 5) {
    reasons.push({ icon: "📊", text: isEn ? `Limited market data (${txCount} transactions)` : `取引データ少なめ（${txCount}件）`, sentiment: "neutral" });
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
        {isEn ? "Key Area Signals" : "エリアの主な特徴"}
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
