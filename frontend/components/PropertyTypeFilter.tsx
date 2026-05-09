"use client";

import { useTranslations, useLocale } from "next-intl";

// MLIT API が返す `r.type` の値（言語非依存・常に日本語文字列）。
// "すべて" は API 値ではなく "未フィルタ" センチネル。
export const ALL_TYPE = "すべて";
export type PropertyTypeValue = string;

/**
 * 既知の MLIT 種別のラベルキー（TransactionTable 名前空間の filter*）と
 * チップ用アイコン。未知の種別は生文字列で表示する（API が新種別を増やしても壊れない）。
 */
const KNOWN_TYPE_META: Record<string, { labelKey: string; icon: string }> = {
  [ALL_TYPE]:           { labelKey: "filterAll",          icon: "📦" },
  "中古マンション等":   { labelKey: "filterCondoUsed",    icon: "🏢" },
  "宅地(土地と建物)":   { labelKey: "filterLandBuilding", icon: "🏡" },
  "宅地(土地)":         { labelKey: "filterLand",         icon: "📐" },
  "農地":               { labelKey: "filterFarm",         icon: "🌾" },
  "林地":               { labelKey: "filterForest",       icon: "🌲" },
};

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

  // 既知種別の優先順位（"すべて" 直後に並べたい順）。未知種別は KNOWN にないため
  // 後段の自動ソートで件数順に末尾へ追加される。
  const KNOWN_ORDER = [
    "中古マンション等",
    "宅地(土地と建物)",
    "宅地(土地)",
    "農地",
    "林地",
  ];

  // 実データに含まれる種別だけを動的に列挙し、件数順で安定ソート。
  // 既知種別は KNOWN_ORDER の優先度を維持、未知種別は件数降順で末尾。
  const dataTypeEntries = Object.entries(typeBreakdown).filter(([, c]) => c > 0);
  dataTypeEntries.sort(([a, ca], [b, cb]) => {
    const ai = KNOWN_ORDER.indexOf(a);
    const bi = KNOWN_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1; // 既知 a を前
    if (bi !== -1) return 1;  // 既知 b を前
    return cb - ca;           // 両方未知: 件数降順
  });

  // "すべて" を先頭、続けて実データ種別。
  const chips: Array<{ value: string; count: number }> = [
    { value: ALL_TYPE, count: totalCount },
    ...dataTypeEntries.map(([value, count]) => ({ value, count })),
  ];

  function labelFor(value: string): string {
    const meta = KNOWN_TYPE_META[value];
    if (meta) return tType(meta.labelKey as Parameters<typeof tType>[0]);
    return value; // 未知種別はそのまま表示
  }
  function iconFor(value: string): string {
    return KNOWN_TYPE_META[value]?.icon ?? "🏷️";
  }

  const isAll = selected === ALL_TYPE;
  const selectedLabel = labelFor(selected);

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
        {chips.map((c) => {
          const isSelected = selected === c.value;
          const label = labelFor(c.value);
          return (
            <button
              key={c.value}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(c.value)}
              className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <span aria-hidden className="text-sm leading-none">{iconFor(c.value)}</span>
              <span>{label}</span>
              <span
                className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-full ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                }`}
              >
                {numFmt(c.count)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
