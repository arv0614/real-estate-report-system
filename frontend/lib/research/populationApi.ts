/**
 * e-Stat API: Population trend by municipality.
 *
 * Strategy:
 *   1. getStatsList to find the most recent 住民基本台帳 (Resident Registry) tables
 *      for the target city code.
 *   2. getStatsData for each found table to extract population values.
 *   3. Build year→population time series, calculate linear trend, project 5/10 years.
 *
 * Falls back to null when:
 *   - API key is not set
 *   - Rate limit or HTTP error
 *   - Insufficient data points (< 2 years)
 */

const ESTAT_BASE = "https://api.e-stat.go.jp/rest/3.0/app/json";

export interface PopulationPoint {
  year: number;
  population: number;
}

export interface PopulationData {
  cityCode: string;
  cityName: string;
  history: PopulationPoint[];   // sorted by year ascending
  /** Annual growth rate, e.g. -0.015 = -1.5%/year */
  trend: number;
  proj5: number | null;
  proj10: number | null;
  source: string;
}

// ── Internal types ────────────────────────────────────────────────────────────

interface EStatTableInfo {
  "@id": string;
  STAT_NAME: { "@code": string; "$": string };
  TABLE_NAME: { "$": string };
  SURVEY_DATE: string;
}

interface EStatValueEntry {
  "@cat01"?: string;
  "@area"?: string;
  "@time"?: string;
  $: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Convert e-Stat time code to year (e.g. "2022000000" → 2022) */
function timeCodeToYear(code: string): number | null {
  const m = code.match(/^(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

/** Linear regression → slope (units/year) */
function linearTrend(points: PopulationPoint[]): number {
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

/** Annual growth rate as fraction (e.g. -0.012) from history */
function annualGrowthRate(points: PopulationPoint[]): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = last.year - first.year;
  if (years === 0 || first.population === 0) return 0;
  // CAGR
  return (last.population / first.population) ** (1 / years) - 1;
}

// ── e-Stat API calls ──────────────────────────────────────────────────────────

async function getStatsList(cityCode: string, apiKey: string): Promise<EStatTableInfo[]> {
  const url =
    `${ESTAT_BASE}/getStatsList?appId=${apiKey}` +
    `&searchWord=%E4%BD%8F%E6%B0%91%E5%9F%BA%E6%9C%AC%E5%8F%B0%E5%B8%B3` + // 住民基本台帳
    `&cdArea=${cityCode}&statsField=02&limit=8&lang=J`;

  const res = await fetch(url, {
    next: { revalidate: 7 * 24 * 3600 },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];

  const data = await res.json();
  const raw = data.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF;
  if (!raw) return [];
  // Normalise: single item comes as object, multiple as array
  return Array.isArray(raw) ? raw : [raw];
}

async function getStatsData(
  statsDataId: string,
  cityCode: string,
  apiKey: string
): Promise<PopulationPoint | null> {
  const url =
    `${ESTAT_BASE}/getStatsData?appId=${apiKey}` +
    `&statsDataId=${statsDataId}&cdArea=${cityCode}&limit=50&lang=J`;

  const res = await fetch(url, {
    next: { revalidate: 7 * 24 * 3600 },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const statData = data.GET_STATS_DATA?.STATISTICAL_DATA;
  if (!statData) return null;

  // Find 総人口 cat01 code from CLASS_INF
  const classObjs: Array<{ "@id": string; CLASS: unknown }> =
    statData.CLASS_INF?.CLASS_OBJ ?? [];
  const cat01Obj = classObjs.find((c) => c["@id"] === "cat01");
  const classes = cat01Obj
    ? Array.isArray(cat01Obj.CLASS)
      ? (cat01Obj.CLASS as Array<{ "@code": string; "@name": string }>)
      : [cat01Obj.CLASS as { "@code": string; "@name": string }]
    : [];

  const totalPop = classes.find(
    (c) => c["@name"].includes("総人口") || c["@name"].includes("人口（男女計）")
  );
  const cat01Code = totalPop?.["@code"];

  // Extract population value
  const values: EStatValueEntry[] = statData.DATA_INF?.VALUE ?? [];
  const entry = values.find(
    (v) =>
      (!cat01Code || v["@cat01"] === cat01Code) &&
      v["@area"] === cityCode &&
      v.$ &&
      !isNaN(Number(v.$))
  );
  if (!entry) return null;

  // Parse year from table SURVEY_DATE or time dimension
  const timeObj = classObjs.find((c) => c["@id"] === "time");
  const timeClasses = timeObj
    ? Array.isArray(timeObj.CLASS)
      ? (timeObj.CLASS as Array<{ "@code": string }>)
      : [timeObj.CLASS as { "@code": string }]
    : [];
  const timeCode = entry["@time"] ?? timeClasses[0]?.["@code"] ?? "";
  const year = timeCodeToYear(timeCode);
  if (!year) return null;

  return { year, population: parseInt(entry.$) };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PopulationFailReason =
  | "no_api_key"
  | "no_tables"
  | "api_error"
  | "insufficient_data";

export async function fetchPopulationTrend(
  cityCode: string,
  apiKey: string
): Promise<{ data: PopulationData; failReason: null } | { data: null; failReason: PopulationFailReason }> {
  if (!apiKey) {
    return { data: null, failReason: "no_api_key" };
  }

  try {
    const tables = await getStatsList(cityCode, apiKey);
    if (tables.length === 0) {
      console.error(`[populationApi] getStatsList returned 0 tables for cityCode=${cityCode}`);
      return { data: null, failReason: "no_tables" };
    }

    console.info(`[populationApi] found ${tables.length} tables for cityCode=${cityCode}`);

    // Sort by survey date descending, take up to 8 most recent
    const sorted = tables
      .filter((t) => t.SURVEY_DATE)
      .sort((a, b) => b.SURVEY_DATE.localeCompare(a.SURVEY_DATE))
      .slice(0, 8);

    // Fetch data for each table in parallel
    const results = await Promise.allSettled(
      sorted.map((t) => getStatsData(t["@id"], cityCode, apiKey))
    );

    const points: PopulationPoint[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        // Avoid duplicate years
        if (!points.find((p) => p.year === r.value!.year)) {
          points.push(r.value);
        }
      }
    }

    console.info(`[populationApi] extracted ${points.length} population points for cityCode=${cityCode}`);

    if (points.length < 2) {
      console.error(`[populationApi] insufficient data points (${points.length}) for cityCode=${cityCode}`);
      return { data: null, failReason: "insufficient_data" };
    }

    const history = points.sort((a, b) => a.year - b.year);
    const trend = annualGrowthRate(history);
    const slope = linearTrend(history);
    const lastYear = history[history.length - 1].year;
    const lastPop = history[history.length - 1].population;
    const currentYear = new Date().getFullYear();
    const delta = currentYear - lastYear;

    // Linear projection from last known point
    const project = (yearsAhead: number) =>
      Math.round(lastPop + slope * (delta + yearsAhead));

    // Derive city name from first table if available
    const cityName = sorted[0]?.STAT_NAME?.["$"] ?? cityCode;

    return {
      data: {
        cityCode,
        cityName,
        history,
        trend,
        proj5: project(5),
        proj10: project(10),
        source: "e-Stat 住民基本台帳",
      },
      failReason: null,
    };
  } catch (err) {
    console.error(`[populationApi] error for cityCode=${cityCode}:`, err);
    return { data: null, failReason: "api_error" };
  }
}
