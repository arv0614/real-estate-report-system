"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, formatUnitPrice } from "@/lib/api";
import type { TransactionRecord } from "@/types/api";

const TYPE_FILTERS = ["すべて", "宅地(土地と建物)", "宅地(土地)", "中古マンション等", "農地", "林地"] as const;
type Filter = (typeof TYPE_FILTERS)[number];

const COLUMN_COUNT = 9;
const PAGE_SIZE = 20;

interface Props {
  records: TransactionRecord[];
}

export function TransactionTable({ records }: Props) {
  const [filter, setFilter] = useState<Filter>("すべて");

  const filtered = useMemo(
    () => (filter === "すべて" ? records : records.filter((r) => r.type === filter)),
    [records, filter]
  );

  const displayed = useMemo(() => filtered.slice(0, PAGE_SIZE), [filtered]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            取引事例一覧
            <span className="ml-2 text-sm font-normal text-slate-500">
              （{displayed.length} 件表示 / 全 {filtered.length} 件）
            </span>
          </CardTitle>

          <div className="flex flex-wrap gap-1">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  filter === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs w-28">種別</TableHead>
                <TableHead className="text-xs w-24">地区名</TableHead>
                <TableHead className="text-xs text-right w-28">取引価格</TableHead>
                <TableHead className="text-xs text-right w-20">面積(㎡)</TableHead>
                <TableHead className="text-xs text-right w-28">㎡単価</TableHead>
                <TableHead className="text-xs w-20">築年</TableHead>
                <TableHead className="text-xs w-16">構造</TableHead>
                <TableHead className="text-xs w-32">都市計画</TableHead>
                <TableHead className="text-xs w-28">取引時期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="text-center text-slate-400 py-8">
                    該当するデータがありません
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map((r, i) => (
                  <TableRow
                    key={`${r.municipalityCode}-${r.districtName}-${r.tradePrice}-${r.period}-${i}`}
                    className="text-xs"
                  >
                    <TableCell>
                      <span className="inline-block max-w-[6.5rem] truncate" title={r.type}>
                        {r.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{r.districtName || "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPrice(r.tradePrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.area?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {r.unitPrice ? formatUnitPrice(r.unitPrice).replace("円/㎡", "") : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-600">
                      {r.buildingYear ? `${r.buildingYear}年` : "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">{r.structure ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      <span className="inline-block max-w-[7.5rem] truncate" title={r.cityPlanning}>
                        {r.cityPlanning}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{r.period}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <p className="text-xs text-slate-400 text-center py-3">
            ※ 先頭 {PAGE_SIZE} 件を表示（全 {filtered.length} 件）
          </p>
        )}
      </CardContent>
    </Card>
  );
}
