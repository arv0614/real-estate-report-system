"use client";

import {
  Line, LineChart,
  CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TransactionRecord } from "@/types/api";

interface Props {
  records: TransactionRecord[];
  isEn: boolean;
}

// IQR-based outlier removal on tradePrice
function removeOutliers(recs: TransactionRecord[]): TransactionRecord[] {
  if (recs.length < 4) return recs;
  const prices = recs.map((r) => r.tradePrice).sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)];
  const q3 = prices[Math.floor(prices.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return recs.filter((r) => r.tradePrice >= lo && r.tradePrice <= hi);
}

function periodSortKey(period: string): number {
  const m = period.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 4 + parseInt(m[2]) : 0;
}

function periodLabel(period: string): string {
  return period.replace(/(\d{4})年第(\d)四半期/, "$1 Q$2");
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface PeriodData {
  label: string;
  sortKey: number;
  medianPrice: number;
  medianPricePerSqm: number | null;
  count: number;
}

function buildChartData(records: TransactionRecord[]): PeriodData[] {
  const groups = new Map<string, TransactionRecord[]>();
  for (const r of records) {
    if (!r.period) continue;
    const arr = groups.get(r.period) ?? [];
    arr.push(r);
    groups.set(r.period, arr);
  }

  return Array.from(groups.entries())
    .map(([period, recs]) => {
      const prices = recs.map((r) => r.tradePrice).filter((p) => p > 0);
      const unitPrices = recs
        .filter((r) => r.area && r.area > 0 && r.tradePrice > 0)
        .map((r) => r.tradePrice / r.area!);
      return {
        label: periodLabel(period),
        sortKey: periodSortKey(period),
        medianPrice: Math.round(median(prices) / 10000),
        medianPricePerSqm: unitPrices.length >= 2
          ? Math.round(median(unitPrices) / 10000 * 10) / 10
          : null,
        count: recs.length,
      };
    })
    .filter((d) => d.count >= 2 && d.sortKey > 0)
    .sort((a, b) => a.sortKey - b.sortKey);
}

const PRICE_COLOR    = "#0d9488"; // teal-600
const UNIT_PRC_COLOR = "#0284c7"; // sky-600

export function AreaPriceTrendChart({ records, isEn }: Props) {
  if (records.length < 10) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          {isEn ? "Price Trend" : "価格推移"}
        </h3>
        <p className="text-xs text-slate-400">
          {isEn
            ? `Not enough data (${records.length} transactions — minimum 10 needed)`
            : `サンプル数不足（${records.length}件 — 10件以上必要）`}
        </p>
      </div>
    );
  }

  const filtered = removeOutliers(records);
  const data = buildChartData(filtered);

  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          {isEn ? "Price Trend" : "価格推移"}
        </h3>
        <p className="text-xs text-slate-400">
          {isEn ? "Insufficient quarterly data to show trend" : "四半期データが不足しているため推移を表示できません"}
        </p>
      </div>
    );
  }

  const hasUnitPrice = data.some((d) => d.medianPricePerSqm !== null);
  const removedCount = records.length - filtered.length;
  const priceLbl    = isEn ? "Median price (¥10k)"    : "物件価格中央値（万円）";
  const unitPriceLbl = isEn ? "Median unit price (¥10k/㎡)" : "平米単価中央値（万円/㎡）";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          {isEn ? "Price Trend" : "価格推移"}
        </h3>
        <p className="text-xs text-slate-500">
          {isEn
            ? `${filtered.length} transactions · ${data.length} quarters`
            : `${filtered.length}件 · ${data.length}期分`}
          {removedCount > 0 && (
            <span className="ml-1 text-slate-400">
              {isEn ? `(${removedCount} outliers removed)` : `（外れ値${removedCount}件除外）`}
            </span>
          )}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="left"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v) => `${v.toLocaleString()}`}
            width={56}
            unit="万"
          />
          {hasUnitPrice && (
            <YAxis
              yAxisId="unit"
              orientation="right"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v) => `${v}`}
              width={52}
              unit="万/㎡"
            />
          )}
          <Tooltip
            formatter={(value, name) =>
              name === priceLbl
                ? [`${Number(value).toLocaleString()}万円`, name]
                : [`${value}万円/㎡`, name]
            }
            contentStyle={{ fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="medianPrice"
            name={priceLbl}
            stroke={PRICE_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          {hasUnitPrice && (
            <Line
              yAxisId="unit"
              type="monotone"
              dataKey="medianPricePerSqm"
              name={unitPriceLbl}
              stroke={UNIT_PRC_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-400 text-center mt-1">
        {isEn
          ? "※ Periods with ≥2 transactions only · MLIT 不動産情報ライブラリ"
          : "※ 各期2件以上のデータのみ表示 · 国交省不動産情報ライブラリ"}
      </p>
    </div>
  );
}
