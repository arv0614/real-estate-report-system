"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AnalyzeResult } from "@/types/research";

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

interface ChartPoint {
  year: number;
  actual: number | null;
  projected: number | null;
  label?: string;
}

function buildChartData(
  history: { year: number; population: number }[],
  proj5: number | null,
  proj10: number | null,
  currentYear: number
): ChartPoint[] {
  const points: ChartPoint[] = history.map((p) => ({
    year: p.year,
    actual: p.population,
    projected: null,
  }));

  // Extend from last known year to current year (linear interpolation)
  if (history.length >= 2) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const slope = (last.population - prev.population) / (last.year - prev.year);

    for (let y = last.year + 1; y <= currentYear; y++) {
      if (!points.find((p) => p.year === y)) {
        const interp = Math.round(last.population + slope * (y - last.year));
        points.push({ year: y, actual: null, projected: interp });
      }
    }
  }

  // Add projections
  if (proj5 !== null) {
    const y5 = currentYear + 5;
    if (!points.find((p) => p.year === y5)) {
      points.push({ year: y5, actual: null, projected: proj5, label: "+5年" });
    }
  }
  if (proj10 !== null) {
    const y10 = currentYear + 10;
    if (!points.find((p) => p.year === y10)) {
      points.push({ year: y10, actual: null, projected: proj10, label: "+10年" });
    }
  }

  return points.sort((a, b) => a.year - b.year);
}

function formatPop(v: number): string {
  if (v >= 100000) return `${(v / 10000).toFixed(1)}万`;
  if (v >= 1000)   return `${(v / 1000).toFixed(1)}千`;
  return String(v);
}

export function PopulationChart({ result, isEn }: Props) {
  const { population, input } = result;
  if (!population || population.history.length < 2) return null;

  const currentYear = new Date().getFullYear();
  const chartData = buildChartData(
    population.history,
    population.proj5,
    population.proj10,
    currentYear
  );

  const isDecline = population.trend < 0;
  const isStrongDecline = population.trend < -0.01;
  const trendColor = isDecline ? "#ef4444" : "#16a34a";
  const trendPct = (population.trend * 100).toFixed(2);
  const trendSign = population.trend >= 0 ? "+" : "";

  const t = {
    title:         isEn ? "Population Trend" : "人口動態トレンド（e-Stat）",
    area:          isEn ? "Area"     : "対象エリア",
    source:        isEn ? "Source"   : "出典",
    actual:        isEn ? "Actual"   : "実績",
    projected:     isEn ? "Projected": "推計",
    trend:         isEn ? "Annual growth" : "年平均変化率",
    proj5Label:    isEn ? "5-year projection" : "5年後推計",
    proj10Label:   isEn ? "10-year projection" : "10年後推計",
    vacancyAlert:  isEn
      ? "Caution: significant population decline — elevated vacancy risk (investment mode)"
      : "注意: 人口が大幅に減少傾向。投資モードでは空室リスクを強く反映しています。",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.area}: {population.cityName}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${isDecline ? "text-red-600" : "text-green-600"}`}>
            {trendSign}{trendPct}%
            <span className="text-xs font-normal text-slate-500 ml-0.5">/年</span>
          </div>
          <div className="text-xs text-slate-400">{t.trend}</div>
        </div>
      </div>

      {/* Vacancy risk alert (investment mode + strong decline) */}
      {input.mode === "investment" && isStrongDecline && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <span className="text-lg leading-none flex-shrink-0">⚠️</span>
          <span>{t.vacancyAlert}</span>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v) => String(v)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={formatPop}
            width={42}
          />
          <Tooltip
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              name === "actual" ? t.actual : t.projected,
            ]}
            labelFormatter={(v) => `${v}年`}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend
            formatter={(v) => (v === "actual" ? t.actual : t.projected)}
            wrapperStyle={{ fontSize: 11 }}
          />

          {/* Current year separator */}
          <ReferenceLine
            x={currentYear}
            stroke="#cbd5e1"
            strokeDasharray="4 2"
            label={{ value: isEn ? "Now" : "現在", fill: "#94a3b8", fontSize: 10 }}
          />

          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={trendColor}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={{ r: 2.5, fill: trendColor }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Projection summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t.proj5Label, value: population.proj5 },
          { label: t.proj10Label, value: population.proj10 },
        ].map(({ label, value }) =>
          value !== null ? (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className={`text-sm font-bold ${isDecline ? "text-red-600" : "text-slate-800"}`}>
                {value.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-0.5">人</span>
              </div>
            </div>
          ) : null
        )}
      </div>

      <p className="text-xs text-slate-400">
        {isEn ? `Source: ${population.source}` : `出典: ${population.source}`}
      </p>
    </div>
  );
}
