"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransactionRecord } from "@/types/api";

interface Props {
  records: TransactionRecord[];
}

interface PeriodData {
  label: string;       // "2024 Q1"
  sortKey: number;     // 2024×4+1 = 8097
  avgTradePrice: number; // 万円
  avgUnitPrice: number | null; // 万円/㎡（null = 対象なし）
  count: number;
}

/** "YYYY年第N四半期" → ソートキー */
function periodSortKey(period: string): number {
  const m = period.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 4 + parseInt(m[2]) : 0;
}

/** "YYYY年第N四半期" → "YYYY Q N" */
function periodLabel(period: string): string {
  return period.replace(/(\d{4})年第(\d)四半期/, "$1 Q$2");
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
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

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
        avgUnitPrice: unitPrices.length
          ? Math.round(avg(unitPrices) / 10000)
          : null,
        count: recs.length,
      };
    })
    .filter((d) => d.count >= 2 && d.sortKey > 0)
    .sort((a, b) => a.sortKey - b.sortKey);
}

const TRADE_COLOR = "#3b82f6";
const UNIT_COLOR = "#f97316";

export function PriceTrendChart({ records }: Props) {
  const data = buildChartData(records);
  if (data.length < 2) return null;

  const hasUnitPrice = data.some((d) => d.avgUnitPrice !== null);

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base">
          取引価格推移
          <span className="ml-2 text-sm font-normal text-slate-500">
            （期別平均・{data.length}期分）
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={260}>
          {hasUnitPrice ? (
            <LineChart data={data} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="trade"
                orientation="left"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => `${v}万`}
                width={56}
              />
              <YAxis
                yAxisId="unit"
                orientation="right"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => `${v}万/㎡`}
                width={64}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "平均取引価格"
                    ? [`${value}万円`, name]
                    : [`${value}万円/㎡`, name]
                }
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="trade"
                type="monotone"
                dataKey="avgTradePrice"
                name="平均取引価格"
                stroke={TRADE_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="unit"
                type="monotone"
                dataKey="avgUnitPrice"
                name="平均㎡単価"
                stroke={UNIT_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => `${v}万`}
                width={56}
              />
              <Tooltip
                formatter={(value) => [`${value}万円`, "平均取引価格"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="avgTradePrice"
                name="平均取引価格"
                fill={TRADE_COLOR}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
        <p className="text-xs text-slate-400 text-center mt-1">
          ※ 各期2件以上のデータが存在する期のみ表示
        </p>
      </CardContent>
    </Card>
  );
}
