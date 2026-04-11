"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
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

// Filter values stay in Japanese to match API data (r.type is always Japanese from MLIT)
const TYPE_FILTER_VALUES = ["すべて", "宅地(土地と建物)", "宅地(土地)", "中古マンション等", "農地", "林地"] as const;
type FilterValue = (typeof TYPE_FILTER_VALUES)[number];

// Maps Japanese filter values to translation keys
const TYPE_FILTER_KEYS: Record<FilterValue, string> = {
  "すべて": "filterAll",
  "宅地(土地と建物)": "filterLandBuilding",
  "宅地(土地)": "filterLand",
  "中古マンション等": "filterCondoUsed",
  "農地": "filterFarm",
  "林地": "filterForest",
};

const COLUMN_COUNT = 9;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface Props {
  records: TransactionRecord[];
  isPdfExporting?: boolean;
  autoDistrict?: string;
}

/** "YYYY年第N四半期" → ソートキー（降順用に大きい値=新しい） */
function periodSortKey(period: string): number {
  const m = period.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 4 + parseInt(m[2]) : 0;
}

export function TransactionTable({ records, isPdfExporting = false, autoDistrict }: Props) {
  const t = useTranslations("TransactionTable");
  const locale = useLocale();
  const [filter, setFilter] = useState<FilterValue>("すべて");
  const [districtFilter, setDistrictFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  useEffect(() => {
    setDistrictFilter(autoDistrict ?? "");
    setPage(0);
  }, [autoDistrict]);

  function handleFilterChange(f: FilterValue) {
    setFilter(f);
    setPage(0);
  }

  function handleDistrictChange(d: string) {
    setDistrictFilter(d);
    setPage(0);
  }

  const districtOptions = useMemo(() => {
    const names = Array.from(
      new Set(records.map((r) => r.districtName).filter((d): d is string => !!d))
    );
    return names.sort((a, b) => a.localeCompare(b, "ja"));
  }, [records]);

  const sortedFiltered = useMemo(() => {
    const base = records.filter((r) => {
      const typeMatch = filter === "すべて" || r.type === filter;
      const districtMatch = districtFilter === "" || r.districtName === districtFilter;
      return typeMatch && districtMatch;
    });
    return [...base].sort((a, b) => periodSortKey(b.period) - periodSortKey(a.period));
  }, [records, filter, districtFilter]);

  const totalPages = Math.ceil(sortedFiltered.length / pageSize);
  const effectivePage = isPdfExporting ? 0 : page;

  const displayed = useMemo(
    () => sortedFiltered.slice(effectivePage * pageSize, (effectivePage + 1) * pageSize),
    [sortedFiltered, effectivePage, pageSize]
  );

  const fromIndex = sortedFiltered.length === 0 ? 0 : effectivePage * pageSize + 1;
  const toIndex = Math.min((effectivePage + 1) * pageSize, sortedFiltered.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            {t("title")}
            <span className="ml-2 text-sm font-normal text-slate-500">
              {sortedFiltered.length === 0
                ? t("showingZero", { total: sortedFiltered.length })
                : t("showing", { from: fromIndex, to: toIndex, total: sortedFiltered.length })}
            </span>
          </CardTitle>

          {!isPdfExporting && (
            <div className="flex flex-wrap items-center gap-2">
              {/* 表示件数 */}
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) as PageSizeOption); setPage(0); }}
                className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{t("perPage", { n })}</option>
                ))}
              </select>

              {/* 地区名フィルター */}
              <select
                value={districtFilter}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t("allDistricts")}</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* 種別フィルター */}
              <div className="flex flex-wrap gap-1">
                {TYPE_FILTER_VALUES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleFilterChange(tf)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      filter === tf
                        ? "bg-blue-600 text-white border-blue-600"
                        : "text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t(TYPE_FILTER_KEYS[tf] as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs w-28">{t("colType")}</TableHead>
                <TableHead className="text-xs w-24">{t("colDistrict")}</TableHead>
                <TableHead className="text-xs text-right w-28">{t("colPrice")}</TableHead>
                <TableHead className="text-xs text-right w-20">{t("colArea")}</TableHead>
                <TableHead className="text-xs text-right w-28">{t("colUnitPrice")}</TableHead>
                <TableHead className="text-xs w-20">{t("colBuildYear")}</TableHead>
                <TableHead className="text-xs w-16">{t("colStructure")}</TableHead>
                <TableHead className="text-xs w-32">{t("colCityPlan")}</TableHead>
                <TableHead className="text-xs w-28">{t("colPeriod")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="text-center text-slate-400 py-8">
                    {t("noData")}
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
                      {formatPrice(r.tradePrice, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.area?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {r.unitPrice ? formatUnitPrice(r.unitPrice, locale).replace("/㎡", "") : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-600">
                      {r.buildingYear ? t("buildYear", { year: r.buildingYear }) : "—"}
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
              {t("prev")}
            </button>
            <span className="text-xs text-slate-500">
              {t("page", { current: page + 1, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("next")}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
