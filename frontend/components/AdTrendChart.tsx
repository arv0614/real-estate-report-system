"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";

type AdReportItem = {
  id: string;
  date: string;
  summary: string;
  chartUrl: string | null;
  metrics: Record<string, number>;
  createdAt: string | null;
};

type MetricKey = "impressions" | "clicks" | "signups" | "ctr" | "cvr";

const METRICS: {
  key: MetricKey;
  labelKey: string;
  color: string;
  isPct: boolean;
}[] = [
  { key: "impressions", labelKey: "adImpressions", color: "#3b82f6", isPct: false },
  { key: "clicks", labelKey: "adClicks", color: "#10b981", isPct: false },
  { key: "signups", labelKey: "adSignups", color: "#f97316", isPct: false },
  { key: "ctr", labelKey: "adCtr", color: "#8b5cf6", isPct: true },
  { key: "cvr", labelKey: "adCvr", color: "#ec4899", isPct: true },
];

/** "YYYY-MM-DD" → "MM/DD"（不正な値はそのまま返す） */
function shortDate(date: string): string {
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : date;
}

export function AdTrendChart({ items }: { items: AdReportItem[] }) {
  const t = useTranslations("Admin");
  const [metric, setMetric] = useState<MetricKey>("impressions");
  const [open, setOpen] = useState(true);

  // 直近30日分を date 昇順で整形（recharts は左→右に古い順で描画するため）
  const data = useMemo(() => {
    return [...items]
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((r) => ({
        date: shortDate(r.date),
        impressions: r.metrics?.impressions ?? 0,
        clicks: r.metrics?.clicks ?? 0,
        signups: r.metrics?.signups ?? 0,
        ctr: r.metrics?.ctr ?? 0,
        cvr: r.metrics?.cvr ?? 0,
      }));
  }, [items]);

  if (data.length < 2) return null;

  const active = METRICS.find((m) => m.key === metric)!;
  const fmt = (v: number) =>
    active.isPct ? `${(v * 100).toFixed(1)}%` : v.toLocaleString();

  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-bold text-slate-800">
          {t("adTrendTitle", { days: data.length })}
        </span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-2 pb-4 sm:px-4">
          <div className="flex flex-wrap gap-1.5 px-2 pb-3 sm:px-0">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`text-[11px] rounded px-2.5 py-1 border transition-colors ${
                  metric === m.key
                    ? "text-white border-transparent"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
                style={
                  metric === m.key ? { backgroundColor: m.color } : undefined
                }
              >
                {t(m.labelKey)}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={fmt}
                width={56}
              />
              <Tooltip
                formatter={(value) => [fmt(Number(value)), t(active.labelKey)]}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                name={t(active.labelKey)}
                stroke={active.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
