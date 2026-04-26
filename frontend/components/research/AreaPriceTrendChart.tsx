"use client";

import {
  Line, LineChart, Bar, BarChart,
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

interface PeriodData {
  label: string;
  sortKey: number;
  avgTradePrice: number;
  avgUnitPrice: number | null;
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

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Array.from(groups.entries())
    .map(([period, recs]) => {
      const prices = recs.map((r) => r.tradePrice).filter((p) => p > 0);
      const unitPrices = recs
        .map((r) => r.unitPrice)
        .filter((v): v is number => v !== null && v > 0);
      return {
        label: periodLabel(period),
        sortKey: periodSortKey(period),
        avgTradePrice: Math.round(avg(prices) / 10000),
        avgUnitPrice: unitPrices.length ? Math.round(avg(unitPrices) / 10000) : null,
        count: recs.length,
      };
    })
    .filter((d) => d.count >= 2 && d.sortKey > 0)
    .sort((a, b) => a.sortKey - b.sortKey);
}

const TRADE_COLOR = "#14b8a6";
const UNIT_COLOR  = "#f97316";

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

  const hasUnitPrice = data.some((d) => d.avgUnitPrice !== null);
  const removedCount = records.length - filtered.length;
  const priceLbl    = isEn ? "Avg. price"   : "平均取引価格";
  const unitPriceLbl = isEn ? "Avg. unit price" : "平均㎡単価";

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

      <ResponsiveContainer width="100%" height={220}>
        {hasUnitPrice ? (
          <LineChart data={data} margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
            <YAxis yAxisId="trade" orientation="left" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}万`} width={52} />
            <YAxis yAxisId="unit" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}万/㎡`} width={60} />
            <Tooltip
              formatter={(value, name) => name === priceLbl ? [`${value}万円`, name] : [`${value}万円/㎡`, name]}
              contentStyle={{ fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="trade" type="monotone" dataKey="avgTradePrice" name={priceLbl} stroke={TRADE_COLOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line yAxisId="unit" type="monotone" dataKey="avgUnitPrice" name={unitPriceLbl} stroke={UNIT_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}万`} width={52} />
            <Tooltip formatter={(value) => [`${value}万円`, priceLbl]} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="avgTradePrice" name={priceLbl} fill={TRADE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 text-center mt-1">
        {isEn ? "※ Periods with ≥2 transactions only · MLIT real estate data" : "※ 各期2件以上のデータのみ表示 · 国交省不動産取引価格情報"}
      </p>
    </div>
  );
}
