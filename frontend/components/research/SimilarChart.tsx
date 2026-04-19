"use client";

import type { AnalyzeResult } from "@/types/research";

interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

function calcBoxStats(values: number[]): BoxStats | null {
  if (values.length < 3) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q1 = s[Math.floor(n * 0.25)];
  const median = s[Math.floor(n * 0.5)];
  const q3 = s[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const min = s.find((v) => v >= lowerFence) ?? s[0];
  const max = [...s].reverse().find((v) => v <= upperFence) ?? s[n - 1];
  return { min, q1, median, q3, max, count: n };
}

// Distribution histogram buckets
function buildHistogram(values: number[], min: number, max: number, buckets = 8) {
  if (values.length === 0 || max <= min) return [];
  const size = (max - min) / buckets;
  return Array.from({ length: buckets }, (_, i) => {
    const lo = min + i * size;
    const hi = lo + size;
    const count = values.filter((v) => v >= lo && (i === buckets - 1 ? v <= hi : v < hi)).length;
    return { lo: Math.round(lo), hi: Math.round(hi), count };
  });
}

interface BoxPlotSVGProps {
  stats: BoxStats;
  userPrice: number;
  isEn: boolean;
}

function BoxPlotSVG({ stats, userPrice, isEn }: BoxPlotSVGProps) {
  const W = 120;
  const H = 320;
  const PX = 20; // horizontal padding
  const PY = 20; // vertical padding
  const CX = W / 2;
  const BW = 44; // box width
  const plotH = H - PY * 2;

  const lo = Math.min(stats.min, userPrice) * 0.97;
  const hi = Math.max(stats.max, userPrice) * 1.03;

  const scaleY = (v: number) => PY + plotH - ((v - lo) / (hi - lo)) * plotH;

  const yMin = scaleY(stats.min);
  const yQ1 = scaleY(stats.q1);
  const yMedian = scaleY(stats.median);
  const yQ3 = scaleY(stats.q3);
  const yMax = scaleY(stats.max);
  const yUser = scaleY(userPrice);

  const isAboveMedian = userPrice >= stats.median;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="flex-shrink-0"
      role="img"
      aria-label={isEn ? "Box plot of similar transactions" : "類似物件の箱ひげ図"}
    >
      {/* Whisker: min → Q1 */}
      <line x1={CX} y1={yMin} x2={CX} y2={yQ1} stroke="#94a3b8" strokeWidth={1.5} />
      {/* Cap min */}
      <line x1={CX - 8} y1={yMin} x2={CX + 8} y2={yMin} stroke="#94a3b8" strokeWidth={1.5} />
      {/* Whisker: Q3 → max */}
      <line x1={CX} y1={yQ3} x2={CX} y2={yMax} stroke="#94a3b8" strokeWidth={1.5} />
      {/* Cap max */}
      <line x1={CX - 8} y1={yMax} x2={CX + 8} y2={yMax} stroke="#94a3b8" strokeWidth={1.5} />

      {/* Box body Q1→Q3 */}
      <rect
        x={CX - BW / 2}
        y={yQ3}
        width={BW}
        height={Math.max(yQ1 - yQ3, 2)}
        rx={3}
        fill="#bfdbfe"
        stroke="#3b82f6"
        strokeWidth={1.5}
      />

      {/* Median line */}
      <line
        x1={CX - BW / 2}
        y1={yMedian}
        x2={CX + BW / 2}
        y2={yMedian}
        stroke="#2563eb"
        strokeWidth={2.5}
      />

      {/* User price star marker */}
      <text
        x={CX + BW / 2 + 6}
        y={yUser + 5}
        fontSize={18}
        textAnchor="start"
        dominantBaseline="middle"
        fill={isAboveMedian ? "#ef4444" : "#16a34a"}
      >
        ★
      </text>

      {/* Price labels */}
      {[
        { y: yMax, v: stats.max, label: isEn ? "Max" : "最大" },
        { y: yQ3, v: stats.q3, label: "Q3" },
        { y: yMedian, v: stats.median, label: isEn ? "Med" : "中央" },
        { y: yQ1, v: stats.q1, label: "Q1" },
        { y: yMin, v: stats.min, label: isEn ? "Min" : "最小" },
      ].map(({ y, v, label }) => (
        <g key={label}>
          <text x={CX - BW / 2 - 4} y={y} fontSize={8} textAnchor="end" dominantBaseline="middle" fill="#64748b">
            {label}
          </text>
          <text x={PX - 4} y={y} fontSize={8} textAnchor="end" dominantBaseline="middle" fill="#475569">
            {v.toLocaleString()}
          </text>
        </g>
      ))}

      {/* User price label */}
      <text
        x={CX + BW / 2 + 26}
        y={yUser + 5}
        fontSize={8}
        textAnchor="start"
        dominantBaseline="middle"
        fill={isAboveMedian ? "#ef4444" : "#16a34a"}
      >
        {userPrice.toLocaleString()}
        {isEn ? "¥10k" : "万"}
      </text>
    </svg>
  );
}

interface HistogramBarProps {
  buckets: ReturnType<typeof buildHistogram>;
  maxCount: number;
}

function HistogramBars({ buckets, maxCount }: HistogramBarProps) {
  return (
    <div className="flex items-end gap-0.5 h-20 flex-1">
      {buckets.map((b, i) => (
        <div
          key={i}
          className="flex-1 bg-blue-200 rounded-t"
          style={{ height: maxCount > 0 ? `${(b.count / maxCount) * 100}%` : "0%" }}
          title={`${b.lo}〜${b.hi}万: ${b.count}件`}
        />
      ))}
    </div>
  );
}

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

export function SimilarChart({ result, isEn }: Props) {
  const { similar, input } = result;
  const prices = similar.map((t) => t.price);
  const stats = calcBoxStats(prices);

  const propertyType = input.propertyType ?? "mansion";
  const t = {
    title:      propertyType === "house"
      ? (isEn ? "Market Price Comparison (Houses)" : "周辺の戸建取引事例")
      : (isEn ? "Market Price Comparison (Apartments)" : "周辺のマンション取引事例"),
    subtitle:   isEn ? "Area ±20% / Age ±5 yrs" : "面積±20% / 築年±5年でフィルタ",
    count:      isEn ? `${similar.length} transactions` : `${similar.length}件の類似取引`,
    noData:     isEn ? "Not enough data for a box plot (need 3+)" : "箱ひげ図を描くのに十分なデータがありません（3件以上必要）",
    median:     isEn ? "Median" : "中央値",
    yourPrice:  isEn ? "Your price" : "入力価格",
    star:       "★",
    wan:        isEn ? "¥10k" : "万円",
    distLabel:  isEn ? "Distribution" : "価格分布",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
          {t.count}
        </span>
      </div>

      {!stats ? (
        <p className="text-sm text-slate-500">{t.noData}</p>
      ) : (
        <div className="space-y-4">
          {/* Chart area */}
          <div className="flex gap-4 items-start">
            <BoxPlotSVG stats={stats} userPrice={input.price ?? 0} isEn={isEn} />

            {/* Legend + distribution */}
            <div className="flex-1 space-y-4 py-5">
              {/* Legend */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-200 border border-blue-400" />
                  <span className="text-slate-600 text-xs">
                    {isEn ? "IQR (Q1–Q3)" : "四分位範囲 (Q1〜Q3)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-blue-600" />
                  <span className="text-slate-600 text-xs">{t.median}: {stats.median.toLocaleString()}{t.wan}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">★</span>
                  <span className="text-slate-600 text-xs">{t.yourPrice}: {(input.price ?? 0).toLocaleString()}{t.wan}</span>
                </div>
              </div>

              {/* Histogram */}
              <div>
                <p className="text-xs text-slate-400 mb-1">{t.distLabel}</p>
                <HistogramBars
                  buckets={buildHistogram(prices, stats.min, stats.max)}
                  maxCount={Math.max(...buildHistogram(prices, stats.min, stats.max).map((b) => b.count))}
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{stats.min.toLocaleString()}</span>
                  <span>{stats.max.toLocaleString()}{isEn ? " ¥10k" : "万"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            {[
              { label: isEn ? "Median" : "中央値", value: stats.median },
              { label: "Q1", value: stats.q1 },
              { label: "Q3", value: stats.q3 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="text-sm font-bold text-slate-800">
                  {value.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 ml-0.5">{t.wan}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
