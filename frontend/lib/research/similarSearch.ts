import { unstable_cache } from "next/cache";
import type { TransactionRecord } from "@/types/api";
import type { SimilarTx, PropertyType } from "@/types/research";

const TYPE_FILTER: Record<PropertyType, string> = {
  mansion:  "中古マンション等",
  house:    "宅地(土地と建物)",
  forest:   "林地",
  farmland: "農地",
};

// ── Mansion / House ───────────────────────────────────────────────────────────

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

// ── Forest / Farmland ─────────────────────────────────────────────────────────

export type ForestStage = "city_3yr" | "pref_3yr" | "pref_5yr";

export const FOREST_STAGE_LABELS: Record<ForestStage, string> = {
  city_3yr: "同一市区町村・直近3年",
  pref_3yr: "同一都道府県・直近3年（市区町村では不足のため拡大）",
  pref_5yr: "同一都道府県・直近5年（さらに拡大）",
};

export interface ForestStagedResult {
  similar: SimilarTx[];
  forestStage: ForestStage | null;
  forestStageLabel: string | null;
}

/** Extract 4-digit year from period string like "2023年第1四半期" */
function periodToYear(period: string): number | null {
  const m = period.match(/^(\d{4})年/);
  return m ? parseInt(m[1], 10) : null;
}

/** Filter forest/farmland records — buildingYear condition skipped */
export function filterForestRecords(
  records: TransactionRecord[],
  propertyType: "forest" | "farmland",
  inputArea: number | undefined,
  minYear: number,
  municipalityCode?: string
): SimilarTx[] {
  const requiredType = TYPE_FILTER[propertyType];
  const areaTolerance = propertyType === "forest" ? 0.5 : 0.3;

  return records
    .filter((r) => {
      if (!r.area || r.tradePrice <= 0) return false;
      if (r.type !== requiredType) return false;
      if (municipalityCode && r.municipalityCode !== municipalityCode) return false;

      // Period year filter
      const yr = periodToYear(r.period ?? "");
      if (yr === null || yr < minYear) return false;

      // Area check — skipped if inputArea not provided
      if (inputArea) {
        const areaOk = Math.abs(r.area - inputArea) / inputArea <= areaTolerance;
        if (!areaOk) return false;
      }

      return true;
    })
    .map(
      (r): SimilarTx => ({
        price: Math.round(r.tradePrice / 10000),
        area: r.area!,
        year: periodToYear(r.period ?? "") ?? 0,
        period: r.period ?? "",
      })
    );
}

// XIT001 raw record (subset of fields we need)
interface XIT001Raw {
  Type: string;
  MunicipalityCode: string;
  Prefecture: string;
  Municipality: string;
  DistrictName: string;
  TradePrice: string;
  Area: string;
  BuildingYear: string;
  Period: string;
}

function normalizeRaw(raw: XIT001Raw): TransactionRecord {
  return {
    priceCategory: "",
    type: raw.Type,
    region: "",
    municipalityCode: raw.MunicipalityCode,
    prefecture: raw.Prefecture,
    municipality: raw.Municipality,
    districtName: raw.DistrictName,
    tradePrice: parseFloat(raw.TradePrice) || 0,
    pricePerUnit: null,
    floorPlan: null,
    area: parseFloat(raw.Area) || null,
    unitPrice: null,
    landShape: null,
    frontage: null,
    roadBreadth: null,
    totalFloorArea: null,
    buildingYear: null,
    structure: null,
    use: "",
    purpose: null,
    direction: null,
    classification: null,
    cityPlanning: "",
    coverageRatio: null,
    floorAreaRatio: null,
    period: raw.Period,
    renovation: null,
    remarks: null,
    timeToNearestStation: null,
  };
}

/** Fetch XIT001 for one prefecture+year. Cached 30 days. */
const _fetchPrefYear = unstable_cache(
  async (prefCode: string, year: number): Promise<TransactionRecord[]> => {
    const base = (process.env.MLIT_API_BASE_URL ?? "").replace(/\/$/, "");
    const key  = process.env.MLIT_API_KEY ?? "";
    if (!base || !key) return [];

    try {
      const res = await fetch(
        `${base}/XIT001?area=47&pref=${prefCode}&year=${year}`,
        {
          headers: { "Ocp-Apim-Subscription-Key": key },
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (!res.ok) return [];
      const data = await res.json() as { status: string; data: XIT001Raw[] };
      if (data.status !== "OK") return [];
      return data.data.map(normalizeRaw);
    } catch {
      return [];
    }
  },
  ["xit001-pref-year"],
  { revalidate: 30 * 24 * 3600 }
);

/** Fetch prefCode records across years with max 2-concurrent requests */
async function fetchPrefRecords(prefCode: string, years: number[]): Promise<TransactionRecord[]> {
  const all: TransactionRecord[] = [];
  for (let i = 0; i < years.length; i += 2) {
    const batch = years.slice(i, i + 2);
    const results = await Promise.all(batch.map((y) => _fetchPrefYear(prefCode, y)));
    for (const r of results) all.push(...r);
  }
  return all;
}

/**
 * Forest/farmland staged search.
 * Stage 1: same city × last 3 years (uses already-fetched records)
 * Stage 2: same prefecture × last 3 years (XIT001 pref call)
 * Stage 3: same prefecture × last 5 years (XIT001 pref call)
 * Threshold: 3 records (forest transactions are sparse).
 */
export async function forestSimilarSearch(
  existingRecords: TransactionRecord[],
  cityCode: string | null,
  currentYear: number,
  inputArea?: number,
  propertyType: "forest" | "farmland" = "forest"
): Promise<ForestStagedResult> {
  const minYear3 = currentYear - 3;
  const minYear5 = currentYear - 5;

  // Stage 1: same city × last 3 years
  if (cityCode) {
    const s1 = filterForestRecords(existingRecords, propertyType, inputArea, minYear3, cityCode);
    if (s1.length >= 3) {
      return { similar: s1, forestStage: "city_3yr", forestStageLabel: FOREST_STAGE_LABELS.city_3yr };
    }
  }

  const prefCode = cityCode?.slice(0, 2) ?? null;
  if (!prefCode) {
    // No pref code → can't expand; return what we have from stage1
    const fallback = cityCode
      ? filterForestRecords(existingRecords, propertyType, inputArea, minYear5, cityCode)
      : [];
    return { similar: fallback, forestStage: fallback.length > 0 ? "city_3yr" : null, forestStageLabel: fallback.length > 0 ? FOREST_STAGE_LABELS.city_3yr : null };
  }

  // Stage 2: same prefecture × last 3 years
  const pref3years = [currentYear - 1, currentYear - 2, currentYear - 3];
  const pref3Records = await fetchPrefRecords(prefCode, pref3years);
  const s2 = filterForestRecords(pref3Records, propertyType, inputArea, minYear3);
  if (s2.length >= 3) {
    return { similar: s2, forestStage: "pref_3yr", forestStageLabel: FOREST_STAGE_LABELS.pref_3yr };
  }

  // Stage 3: same prefecture × last 5 years (add 2 more years)
  const extra2years = [currentYear - 4, currentYear - 5];
  const extraRecords = await fetchPrefRecords(prefCode, extra2years);
  const allPref5 = [...pref3Records, ...extraRecords];
  const s3 = filterForestRecords(allPref5, propertyType, inputArea, minYear5);

  return {
    similar: s3,
    forestStage: s3.length > 0 ? "pref_5yr" : null,
    forestStageLabel: s3.length > 0 ? FOREST_STAGE_LABELS.pref_5yr : null,
  };
}
