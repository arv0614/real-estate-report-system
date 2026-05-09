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
import { formatPrice, formatUnitPrice, parseArea, resolveUnitPrice } from "@/lib/api";
import type { TransactionRecord } from "@/types/api";
import { ALL_TYPE, type PropertyTypeValue } from "@/components/PropertyTypeFilter";

const COLUMN_COUNT = 9;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface Props {
  records: TransactionRecord[];
  /** ページ全体のグローバル種別フィルタ。"すべて" のときは全種別を表示。 */
  propertyTypeFilter: PropertyTypeValue;
  isPdfExporting?: boolean;
  autoDistrict?: string;
}

/** "YYYY年第N四半期" → ソートキー（大きい値=新しい） */
function periodSortKey(period: string): number {
  const m = period.match(/(\d{4})年第(\d)四半期/);
  return m ? parseInt(m[1]) * 4 + parseInt(m[2]) : 0;
}

// ─── ソート定義 ───────────────────────────────────────────────────────────
type SortKey =
  | "type"
  | "districtName"
  | "tradePrice"
  | "area"
  | "unitPrice"
  | "buildingYear"
  | "structure"
  | "cityPlanning"
  | "period";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

/** 同時に保持できるソート条件の最大数（第一・第二） */
const MAX_SORTS = 2;

/** デフォルトソート: 取引時期 (新しい順) → 築年 (新しい順) のマルチソート */
const DEFAULT_SORTS: Sort[] = [
  { key: "period",       dir: "desc" },
  { key: "buildingYear", dir: "desc" },
];

/** 列キー → レコードからソート用比較値を取り出す。null/undefined は常に末尾に置く。 */
function sortValue(r: TransactionRecord, key: SortKey): number | string | null {
  switch (key) {
    case "type":         return r.type ?? "";
    case "districtName": return r.districtName ?? "";
    case "tradePrice":   return typeof r.tradePrice === "number" ? r.tradePrice : null;
    case "area":         return parseArea(r.area);
    case "unitPrice":    return resolveUnitPrice(r);
    case "buildingYear": return r.buildingYear ?? null;
    case "structure":    return r.structure ?? "";
    case "cityPlanning": return r.cityPlanning ?? "";
    case "period":       return periodSortKey(r.period);
  }
}

function compareSorted(
  a: TransactionRecord,
  b: TransactionRecord,
  key: SortKey,
  dir: SortDir,
): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  // null は常に末尾（昇降に依らない）
  const aNull = av === null || av === "";
  const bNull = bv === null || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), "ja");
  }
  return dir === "asc" ? cmp : -cmp;
}

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  /** マルチソートの全条件。配列順がそのまま優先順位 (0 = primary, 1 = secondary)。 */
  sorts: Sort[];
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
  widthClass?: string;
}

function SortableHead({ label, sortKey, sorts, onClick, align = "left", widthClass }: SortableHeadProps) {
  const idx = sorts.findIndex((s) => s.key === sortKey);
  const active = idx !== -1;
  const isPrimary = idx === 0;
  const dir = active ? sorts[idx].dir : null;
  const arrow = !active ? "↕" : dir === "asc" ? "▲" : "▼";
  const ariaSort = !active ? "none" : dir === "asc" ? "ascending" : "descending";

  // a11y: 第二ソートは aria-sort には載せられない（仕様上 'none' or 'ascending'/'descending'/'other' のみ）。
  // 「2つ目のソート」であることを伝えるため aria-label に "(secondary sort)" 等を追記する。
  const ariaLabel = active
    ? `${label} — ${isPrimary ? "primary" : "secondary"} sort, ${dir === "asc" ? "ascending" : "descending"}`
    : `${label} — sort`;

  return (
    <TableHead
      className={`text-xs ${widthClass ?? ""} ${align === "right" ? "text-right" : ""}`}
      aria-sort={ariaSort as React.AriaAttributes["aria-sort"]}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        aria-label={ariaLabel}
        className={`group inline-flex items-center gap-1 ${
          align === "right" ? "ml-auto" : ""
        } whitespace-nowrap font-semibold transition-colors ${
          active
            ? isPrimary
              ? "text-blue-700"
              : "text-blue-500"
            : "text-slate-700 hover:text-blue-700"
        }`}
      >
        <span>{label}</span>
        <span
          aria-hidden
          className={`text-[10px] tabular-nums leading-none ${
            active
              ? isPrimary ? "text-blue-600" : "text-blue-400"
              : "text-slate-300 group-hover:text-blue-400"
          }`}
        >
          {arrow}
        </span>
        {/* 優先順位バッジ: 第一ソートは塗り、第二ソートは枠線のみで弱く見せる */}
        {active && (
          <span
            aria-hidden
            className={`tabular-nums text-[9px] leading-none rounded-full px-1 py-[1px] font-bold ${
              isPrimary
                ? "bg-blue-600 text-white"
                : "border border-blue-300 text-blue-500 bg-white"
            }`}
            title={isPrimary ? "Primary sort" : "Secondary sort"}
          >
            {idx + 1}
          </span>
        )}
      </button>
    </TableHead>
  );
}

export function TransactionTable({
  records,
  propertyTypeFilter,
  isPdfExporting = false,
  autoDistrict,
}: Props) {
  const t = useTranslations("TransactionTable");
  const locale = useLocale();
  const [districtFilter, setDistrictFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  // マルチソート: 配列の先頭が第一ソート、2要素目が第二ソート。
  // デフォルト: 取引時期 (新しい順) → 築年 (新しい順)
  const [sorts, setSorts] = useState<Sort[]>(DEFAULT_SORTS);

  useEffect(() => {
    setDistrictFilter(autoDistrict ?? "");
    setPage(0);
  }, [autoDistrict]);

  // グローバル種別フィルタが変わったらページもリセット（薄いレイヤだが UX 改善）
  useEffect(() => {
    setPage(0);
  }, [propertyTypeFilter]);

  function handleSort(key: SortKey) {
    setSorts((prev) => {
      // 同じ列を再クリック: 第一ソートの方向だけトグル、第二ソートは保持
      if (prev[0]?.key === key) {
        const toggled: Sort = { key, dir: prev[0].dir === "asc" ? "desc" : "asc" };
        return [toggled, ...prev.slice(1)];
      }
      // 別列クリック: 新キーを第一ソートに昇格、直前の第一ソートを第二ソートへ降格、
      // 古い第二ソートは破棄（MAX_SORTS=2 で打ち切る）。
      const old0 = prev[0];
      const next: Sort[] = [{ key, dir: "desc" }];
      if (old0) next.push(old0);
      return next.slice(0, MAX_SORTS);
    });
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
    // ① グローバル種別フィルタ + 地区フィルタ
    const base = records.filter((r) => {
      const typeMatch = propertyTypeFilter === ALL_TYPE || r.type === propertyTypeFilter;
      const districtMatch = districtFilter === "" || r.districtName === districtFilter;
      return typeMatch && districtMatch;
    });
    // ② sorts 配列の順に第一→第二と評価。それでも同値なら period DESC を最終フォールバック。
    return [...base].sort((a, b) => {
      for (const s of sorts) {
        const cmp = compareSorted(a, b, s.key, s.dir);
        if (cmp !== 0) return cmp;
      }
      // ユーザー指定ソートで決着しない場合の暗黙のフォールバック
      return periodSortKey(b.period) - periodSortKey(a.period);
    });
  }, [records, propertyTypeFilter, districtFilter, sorts]);

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

              {/* 地区名フィルター（種別フィルタはページ上部の PropertyTypeFilter に統合済み） */}
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
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <SortableHead label={t("colType")}      sortKey="type"         sorts={sorts} onClick={handleSort} widthClass="w-28" />
                <SortableHead label={t("colDistrict")}  sortKey="districtName" sorts={sorts} onClick={handleSort} widthClass="w-24" />
                <SortableHead label={t("colPrice")}     sortKey="tradePrice"   sorts={sorts} onClick={handleSort} widthClass="w-28" align="right" />
                <SortableHead label={t("colArea")}      sortKey="area"         sorts={sorts} onClick={handleSort} widthClass="w-20" align="right" />
                <SortableHead label={t("colUnitPrice")} sortKey="unitPrice"    sorts={sorts} onClick={handleSort} widthClass="w-28" align="right" />
                <SortableHead label={t("colBuildYear")} sortKey="buildingYear" sorts={sorts} onClick={handleSort} widthClass="w-20" />
                <SortableHead label={t("colStructure")} sortKey="structure"    sorts={sorts} onClick={handleSort} widthClass="w-16" />
                <SortableHead label={t("colCityPlan")}  sortKey="cityPlanning" sorts={sorts} onClick={handleSort} widthClass="w-32" />
                <SortableHead label={t("colPeriod")}    sortKey="period"       sorts={sorts} onClick={handleSort} widthClass="w-28" />
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
                      {(() => {
                        // 宅地(土地) 以外は tradePrice/area で動的算出。
                        // resolveUnitPrice() がロジックを一元化している。
                        const u = resolveUnitPrice(r);
                        return u ? formatUnitPrice(u, locale).replace("/㎡", "") : "—";
                      })()}
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
