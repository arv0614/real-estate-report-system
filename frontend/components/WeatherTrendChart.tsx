"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeatherMonthly } from "@/types/api";

interface Props {
  monthly: WeatherMonthly[];
}

const COLOR_MAX = "#ef4444";   // 最高気温（赤系）
const COLOR_MIN = "#3b82f6";   // 最低気温（青系）
const COLOR_SUN = "#f59e0b";   // 日照時間（オレンジ系）

export function WeatherTrendChart({ monthly }: Props) {
  const t = useTranslations("WeatherInfo");
  const locale = useLocale();
  if (!monthly || monthly.length === 0) return null;

  const labelMax = t("chartMaxTemp");
  const labelMin = t("chartMinTemp");
  const labelSun = t("chartSunshine");
  const tempUnit = t("tempUnit");
  const hourUnit = t("annualSunshineUnit");

  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });

  const data = monthly.map((m) => ({
    label: monthFormat.format(new Date(2025, m.month - 1, 1)),
    avgMaxTemp: m.avgMaxTemp,
    avgMinTemp: m.avgMinTemp,
    sunshineHours: m.sunshineHours,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-2 pb-3 pt-3">
      <h4 className="text-sm font-semibold text-slate-700 px-2 mb-2 flex items-center gap-2">
        <span>📈</span>
        {t("trendTitle")}
      </h4>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval={0}
          />
          <YAxis
            yAxisId="temp"
            orientation="left"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => `${v}${tempUnit}`}
            width={48}
          />
          <YAxis
            yAxisId="sun"
            orientation="right"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => `${v}${hourUnit}`}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === labelSun) return [`${value} ${hourUnit}`, name];
              return [`${value} ${tempUnit}`, name];
            }}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="sun"
            dataKey="sunshineHours"
            name={labelSun}
            fill={COLOR_SUN}
            fillOpacity={0.4}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="avgMaxTemp"
            name={labelMax}
            stroke={COLOR_MAX}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="avgMinTemp"
            name={labelMin}
            stroke={COLOR_MIN}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 text-center mt-1">{t("trendNote")}</p>
    </div>
  );
}
