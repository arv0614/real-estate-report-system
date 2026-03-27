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
  isPdfExporting?: boolean;
}

/** "YYYY年第N四半期" → ソートキー（降順用に大きい値=新しい） */
function periodSortKey(period: string): number {
  const m = period.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 4 + parseInt(m[2]) : 0;
}

export function TransactionTable({ records, isPdfExporting = false }: Props) {
  const [filter, setFilter] = useState<Filter>("すべて");
  const [page, setPage] = useState(0);

  // フィルタ変更時にページをリセット
  function handleFilterChange(f: Filter) {
    setFilter(f);
    setPage(0);
  }

  const sortedFiltered = useMemo(() => {
    const base = filter === "すべて" ? records : records.filter((r) => r.type === filter);
    return [...base].sort((a, b) => periodSortKey(b.period) - periodSortKey(a.period));
  }, [records, filter]);

  const totalPages = Math.ceil(sortedFiltered.length / PAGE_SIZE);

  // PDF出力中は常に1ページ目（最新20件）を強制表示
  const effectivePage = isPdfExporting ? 0 : page;

  const displayed = useMemo(
    () => sortedFiltered.slice(effectivePage * PAGE_SIZE, (effectivePage + 1) * PAGE_SIZE),
    [sortedFiltered, effectivePage]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            取引事例一覧
            <span className="ml-2 text-sm font-normal text-slate-500">
              （{page * PAGE_SIZE + 1}〜{Math.min((page + 1) * PAGE_SIZE, sortedFiltered.length)} 件表示 / 全 {sortedFiltered.length} 件）
            </span>
          </CardTitle>

          {!isPdfExporting && (
            <div className="flex flex-wrap gap-1">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleFilterChange(t)}
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
          )}
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

        {/* ページネーション（PDF出力時は非表示） */}
        {totalPages > 1 && !isPdfExporting && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← 前へ
            </button>
            <span className="text-xs text-slate-500">
              {page + 1} / {totalPages} ページ
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              次へ →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
