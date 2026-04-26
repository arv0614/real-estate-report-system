/**
 * e-Stat API: Population trend by municipality using Census (国勢調査) data.
 *
 * Strategy:
 *   Uses five known Census table IDs covering 2000–2020 (5-year intervals).
 *   For each year, fetches population data for the target city and takes the
 *   maximum integer value with unit=人, which corresponds to 総人口 (incl. foreigners).
 *
 * Falls back to null when:
 *   - API key is not set
 *   - Fewer than 2 data points retrieved successfully
 */

const ESTAT_BASE = "https://api.e-stat.go.jp/rest/3.0/app/json";

export interface PopulationPoint {
  year: number;
  population: number;
}

export interface PopulationData {
  cityCode: string;
  cityName: string;
  history: PopulationPoint[];
  /** Annual growth rate as fraction, e.g. -0.015 = -1.5%/yr */
  trend: number;
  proj5: number | null;
  proj10: number | null;
  source: string;
}

// Known Census table IDs (国勢調査, statsCode=00200521) that contain
// municipality-level (市区町村) total population data for cdArea filter.
const CENSUS_YEARS: Array<{ tableId: string; year: number }> = [
  { tableId: "0000032805", year: 2000 },
  { tableId: "0000034066", year: 2005 },
  { tableId: "0003038586", year: 2010 },
  { tableId: "0003149040", year: 2015 },
  { tableId: "0004019302", year: 2020 },
];

interface EStatValueEntry {
  "@area"?: string;
  "@time"?: string;
  "@unit"?: string;
  $: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function annualGrowthRate(points: PopulationPoint[]): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = last.year - first.year;
  if (years === 0 || first.population === 0) return 0;
  return (last.population / first.population) ** (1 / years) - 1;
}

function linearSlope(points: PopulationPoint[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const xs = points.map((p) => p.year);
  const ys = points.map((p) => p.population);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

// ── Census fetch ──────────────────────────────────────────────────────────────

async function fetchCensusPoint(
  tableId: string,
  year: number,
  cityCode: string,
  apiKey: string
): Promise<PopulationPoint | null> {
  const timeCode = `${year}000000`;
  const url =
    `${ESTAT_BASE}/getStatsData?appId=${apiKey}` +
    `&statsDataId=${tableId}&cdArea=${cityCode}&limit=50&lang=J`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 * 24 * 3600 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!raw) return null;
    const values: EStatValueEntry[] = Array.isArray(raw) ? raw : [raw];

    const pops = values
      .filter(
        (v) =>
          v["@area"] === cityCode &&
          v["@time"] === timeCode &&
          v["@unit"] === "人" &&
          /^\d+$/.test(v.$) &&
          parseInt(v.$) > 0
      )
      .map((v) => parseInt(v.$));

    if (pops.length === 0) return null;
    return { year, population: Math.max(...pops) };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";

export type PopulationFailReason =
  | "no_api_key"
  | "no_tables"
  | "api_error"
  | "insufficient_data";

// Inner function takes apiKey as a parameter but is cached only on cityCode
// (apiKey is a fixed server-side env var, not user-specific)
async function _fetchPopulationTrend(
  cityCode: string,
  apiKey: string
): Promise<{ data: PopulationData; failReason: null } | { data: null; failReason: PopulationFailReason }> {

  try {
    const results = await Promise.allSettled(
      CENSUS_YEARS.map(({ tableId, year }) =>
        fetchCensusPoint(tableId, year, cityCode, apiKey)
      )
    );

    const points: PopulationPoint[] = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((p): p is PopulationPoint => p !== null);

    console.info(
      `[populationApi] extracted ${points.length} census points for cityCode=${cityCode}: ` +
        points.map((p) => `${p.year}=${p.population}`).join(", ")
    );

    if (points.length < 2) {
      console.error(
        `[populationApi] insufficient data points (${points.length}) for cityCode=${cityCode}`
      );
      return { data: null, failReason: "insufficient_data" };
    }

    const history = points.sort((a, b) => a.year - b.year);
    const trend = annualGrowthRate(history);
    const slope = linearSlope(history);
    const lastYear = history[history.length - 1].year;
    const lastPop = history[history.length - 1].population;
    const currentYear = new Date().getFullYear();
    const delta = currentYear - lastYear;

    const project = (yearsAhead: number) =>
      Math.round(lastPop + slope * (delta + yearsAhead));

    return {
      data: {
        cityCode,
        cityName: cityCode,
        history,
        trend,
        proj5: project(5),
        proj10: project(10),
        source: "e-Stat 国勢調査（2000–2020）",
      },
      failReason: null,
    };
  } catch (err) {
    console.error(`[populationApi] error for cityCode=${cityCode}:`, err);
    return { data: null, failReason: "api_error" };
  }
}

// Cache keyed on cityCode only — apiKey is a fixed server-side env var.
// Census data (2000-2020) is immutable; 90d revalidate for safety.
const _fetchPopulationTrendCached = unstable_cache(
  _fetchPopulationTrend,
  ["population-trend"],
  { revalidate: 7_776_000, tags: ["population"] }
);
export function fetchPopulationTrend(
  cityCode: string,
  apiKey: string
): ReturnType<typeof _fetchPopulationTrend> {
  if (!apiKey) return Promise.resolve({ data: null, failReason: "no_api_key" as const });
  return _fetchPopulationTrendCached(cityCode, apiKey);
}
