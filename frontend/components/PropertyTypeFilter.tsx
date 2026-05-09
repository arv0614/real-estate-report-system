"use client";

import { useTranslations, useLocale } from "next-intl";

// MLIT API が返す r.type の値（言語非依存・常に日本語）。
// "すべて" は API 値ではなく "未フィルタ" のセンチネル。
export const PROPERTY_TYPE_FILTERS = [
  { value: "すべて",            labelKey: "filterAll",         icon: "📦" },
  { value: "中古マンション等",   labelKey: "filterCondoUsed",   icon: "🏢" },
  { value: "宅地(土地と建物)",   labelKey: "filterLandBuilding", icon: "🏡" },
  { value: "宅地(土地)",        labelKey: "filterLand",         icon: "📐" },
  { value: "農地",              labelKey: "filterFarm",         icon: "🌾" },
  { value: "林地",              labelKey: "filterForest",       icon: "🌲" },
] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPE_FILTERS)[number]["value"];

export const ALL_TYPE: PropertyTypeValue = "すべて";

interface Props {
  selected: PropertyTypeValue;
  onChange: (v: PropertyTypeValue) => void;
  /** 全レコードから算出した種別ごとの件数（API値→件数） */
  typeBreakdown: Record<string, number>;
  /** 全件数（フィルタ適用前） */
  totalCount: number;
  /** フィルタ適用後の件数（"現在 X 件の統計を表示中" 表示用） */
  filteredCount: number;
}

export function PropertyTypeFilter({
  selected,
  onChange,
  typeBreakdown,
  totalCount,
  filteredCount,
}: Props) {
  const t = useTranslations("PropertyTypeFilter");
  const tType = useTranslations("TransactionTable");
  const locale = useLocale();
  const numFmt = (n: number) =>
    n.toLocaleString(locale === "en" ? "en-US" : locale === "ja" ? "ja-JP" : locale);

  // 実データに含まれる種別だけをチップ化（"すべて" は常に表示）
  const available = PROPERTY_TYPE_FILTERS.filter(
    (f) => f.value === ALL_TYPE || (typeBreakdown[f.value] ?? 0) > 0,
  );

  const selectedDef = PROPERTY_TYPE_FILTERS.find((f) => f.value === selected) ?? PROPERTY_TYPE_FILTERS[0];
  const selectedLabel = tType(selectedDef.labelKey);
  const isAll = selected === ALL_TYPE;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isAll ? "bg-white border-slate-200" : "bg-blue-50/40 border-blue-200"
      }`}
      data-testid="property-type-filter"
    >
      {/* タイトル + 現在表示中の統計スコープ */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <span aria-hidden>🔍</span>
            {t("title")}
          </h2>
          <span className="text-xs text-slate-500 hidden sm:inline">{t("subtitle")}</span>
        </div>
        <div
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            isAll
              ? "bg-slate-100 text-slate-600"
              : "bg-blue-600 text-white shadow-sm"
          }`}
          aria-live="polite"
        >
          {isAll
            ? t("displayingAll", { count: numFmt(totalCount) })
            : t("displayingFiltered", { type: selectedLabel, count: numFmt(filteredCount) })}
        </div>
      </div>

      {/* チップ（タブ）UI */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("ariaLabel")}>
        {available.map((f) => {
          const count = f.value === ALL_TYPE ? totalCount : typeBreakdown[f.value] ?? 0;
          const isSelected = selected === f.value;
          const label = tType(f.labelKey);
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(f.value)}
              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <span aria-hidden className="text-sm leading-none">{f.icon}</span>
              <span>{label}</span>
              <span
                className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                }`}
              >
                {numFmt(count)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
