import type { TransactionRecord } from "@/types/api";
import type { SimilarTx, PropertyType } from "@/types/research";

const TYPE_FILTER: Record<PropertyType, string> = {
  mansion: "中古マンション等",
  house:   "宅地(土地と建物)",
};

export type SearchRange = "strict" | "city" | "wide";

export const SEARCH_RANGE_LABELS: Record<SearchRange, string> = {
  strict: "同一地区・条件一致",
  city: "市区町村全域（周辺不足のため拡大）",
  wide: "タイル全域・条件緩和（市区町村でも不足のため拡大）",
};

interface StageFilter {
  range: SearchRange;
  ageTolerance: number;
  areaTolerance: number;
  districtName?: string;
  municipalityCode?: string;
}

function filterRecords(
  records: TransactionRecord[],
  inputAge: number,
  inputArea: number,
  currentYear: number,
  filter: StageFilter,
  propertyType: PropertyType
): SimilarTx[] {
  const requiredType = TYPE_FILTER[propertyType];
  return records
    .filter((r) => {
      if (!r.area || r.tradePrice <= 0) return false;
      if (r.type !== requiredType) return false;

      // Location filter
      if (filter.districtName && r.districtName !== filter.districtName) return false;
      if (filter.municipalityCode && r.municipalityCode !== filter.municipalityCode) return false;

      // Area tolerance
      const areaOk = Math.abs(r.area - inputArea) / inputArea <= filter.areaTolerance;

      // Age tolerance
      const rAge = r.buildingYear ? currentYear - r.buildingYear : null;
      const ageOk = rAge !== null && Math.abs(rAge - inputAge) <= filter.ageTolerance;

      return areaOk && ageOk;
    })
    .map(
      (r): SimilarTx => ({
        price: Math.round(r.tradePrice / 10000),
        area: r.area!,
        year: r.buildingYear ?? currentYear - inputAge,
        period: r.period ?? "",
      })
    );
}

export interface StagedSearchResult {
  similar: SimilarTx[];
  searchRange: SearchRange | null;
  searchRangeLabel: string | null;
}

export function stagedSimilarSearch(
  records: TransactionRecord[],
  inputAge: number,
  inputArea: number,
  currentYear: number,
  districtName: string | null,
  municipalityCode: string | null,
  propertyType: PropertyType = "mansion"
): StagedSearchResult {
  const stages: StageFilter[] = [
    {
      range: "strict",
      ageTolerance: 5,
      areaTolerance: 0.2,
      ...(districtName ? { districtName } : {}),
    },
    {
      range: "city",
      ageTolerance: 5,
      areaTolerance: 0.2,
      ...(municipalityCode ? { municipalityCode } : {}),
    },
    {
      range: "wide",
      ageTolerance: 10,
      areaTolerance: 0.3,
    },
  ];

  for (const stage of stages) {
    // Skip district/city stages if we lack the key to filter by
    if (stage.range === "strict" && !districtName) continue;
    if (stage.range === "city" && !municipalityCode) continue;

    const results = filterRecords(records, inputAge, inputArea, currentYear, stage, propertyType);
    if (results.length >= 5) {
      return {
        similar: results,
        searchRange: stage.range,
        searchRangeLabel: SEARCH_RANGE_LABELS[stage.range],
      };
    }
  }

  // None of the stages hit ≥5 — return wide results (even if < 5) for display
  const fallback = filterRecords(records, inputAge, inputArea, currentYear, {
    range: "wide",
    ageTolerance: 10,
    areaTolerance: 0.3,
  }, propertyType);

  return {
    similar: fallback,
    searchRange: fallback.length > 0 ? "wide" : null,
    searchRangeLabel: fallback.length > 0 ? SEARCH_RANGE_LABELS.wide : null,
  };
}
