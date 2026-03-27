import axios from "axios";
import { config } from "../config";
import { reverseGeocode } from "../utils/geocode";
import { latLngToTile } from "../utils/tile";

// ============================================================
// 国交省 不動産情報ライブラリAPI レスポンス型
// 数値フィールドもすべて文字列、空文字 "" は null 扱い
// ============================================================
interface MlitRawRecord {
  PriceCategory: string;        // 価格情報区分
  Type: string;                 // 種類
  Region: string;               // 地域
  MunicipalityCode: string;     // 市区町村コード
  Prefecture: string;           // 都道府県名
  Municipality: string;         // 市区町村名
  DistrictName: string;         // 地区名
  DistrictCode: string;         // 地区コード
  TradePrice: string;           // 取引価格（円）
  PricePerUnit: string;         // 坪単価
  FloorPlan: string;            // 間取り
  Area: string;                 // 面積（㎡）
  UnitPrice: string;            // ㎡単価（円）
  LandShape: string;            // 土地形状
  Frontage: string;             // 間口（m）
  Breadth: string;              // 前面道路：幅員（m）
  TotalFloorArea: string;       // 延床面積（㎡）
  BuildingYear: string;         // 建築年（"YYYY年" 形式）
  Structure: string;            // 建物構造
  Use: string;                  // 用途
  Purpose: string;              // 今後の利用目的
  Direction: string;            // 前面道路：方位
  Classification: string;       // 前面道路：種類
  CityPlanning: string;         // 都市計画
  CoverageRatio: string;        // 建ぺい率（%）
  FloorAreaRatio: string;       // 容積率（%）
  Period: string;               // 取引時期
  Renovation: string;           // 改装
  Remarks: string;              // 取引の事情等
}

// アプリ内で使う正規化済み型
export interface TransactionRecord {
  priceCategory: string;
  type: string;
  region: string;
  municipalityCode: string;
  prefecture: string;
  municipality: string;
  districtName: string;
  tradePrice: number;            // 円
  pricePerUnit: number | null;   // 円/坪
  floorPlan: string | null;
  area: number | null;           // ㎡
  unitPrice: number | null;      // 円/㎡
  landShape: string | null;
  frontage: number | null;       // m
  roadBreadth: number | null;    // 前面道路幅員（m）
  totalFloorArea: number | null; // ㎡
  buildingYear: number | null;   // 西暦年
  structure: string | null;
  use: string;
  purpose: string | null;
  direction: string | null;
  classification: string | null;
  cityPlanning: string;
  coverageRatio: number | null;  // %
  floorAreaRatio: number | null; // %
  period: string;
  renovation: string | null;
  remarks: string | null;
}

export interface MlitApiResponse {
  status: string;
  cityCode: string;
  years: number[];
  data: TransactionRecord[];
}

// ============================================================
// ヘルパー
// ============================================================

/** 空文字や null を null に統一 */
function nullify(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  return v;
}

/** 文字列数値 → number。空文字・非数値は null */
function toNum(v: string | null | undefined): number | null {
  const s = nullify(v);
  if (s === null) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** "2015年" → 2015, 空文字 → null */
function parseBuildingYear(raw: string | null | undefined): number | null {
  const s = nullify(raw);
  if (!s) return null;
  const m = s.match(/(\d{4})年/);
  return m ? parseInt(m[1], 10) : null;
}

/** 取得対象年リスト：前年を基準に直近5年分 */
function getTargetYears(): number[] {
  const baseYear = new Date().getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => baseYear - 4 + i);
}

/** MlitRawRecord → TransactionRecord */
function normalize(raw: MlitRawRecord): TransactionRecord {
  return {
    priceCategory: raw.PriceCategory,
    type: raw.Type,
    region: raw.Region,
    municipalityCode: raw.MunicipalityCode,
    prefecture: raw.Prefecture,
    municipality: raw.Municipality,
    districtName: raw.DistrictName,
    tradePrice: toNum(raw.TradePrice) ?? 0,
    pricePerUnit: toNum(raw.PricePerUnit),
    floorPlan: nullify(raw.FloorPlan),
    area: toNum(raw.Area),
    unitPrice: toNum(raw.UnitPrice),
    landShape: nullify(raw.LandShape),
    frontage: toNum(raw.Frontage),
    roadBreadth: toNum(raw.Breadth),
    totalFloorArea: toNum(raw.TotalFloorArea),
    buildingYear: parseBuildingYear(raw.BuildingYear),
    structure: nullify(raw.Structure),
    use: raw.Use,
    purpose: nullify(raw.Purpose),
    direction: nullify(raw.Direction),
    classification: nullify(raw.Classification),
    cityPlanning: raw.CityPlanning,
    coverageRatio: toNum(raw.CoverageRatio),
    floorAreaRatio: toNum(raw.FloorAreaRatio),
    period: raw.Period,
    renovation: nullify(raw.Renovation),
    remarks: nullify(raw.Remarks),
  };
}

// ============================================================
// API 呼び出し
// ============================================================

/**
 * 国交省 不動産情報ライブラリAPI (XIT001) から取引価格情報を取得
 *
 * 1. GSI リバースジオコーダで lat/lng → 市区町村コード を取得
 * 2. XIT001 に year + city パラメータで問い合わせ
 */
export async function fetchTransactionPrices(
  lat: number,
  lng: number
): Promise<MlitApiResponse> {
  // Step1: 座標から市区町村コードを取得
  const municipality = await reverseGeocode(lat, lng);
  const years = getTargetYears();

  console.log(
    `[MLIT API] 逆ジオコーディング完了: cityCode=${municipality.cityCode} (${municipality.districtName})`
  );
  console.log(`[MLIT API] 取得対象年: ${years.join(", ")}`);

  // Step2: XIT001 を直近5年分並列呼び出し（一部の年が404/エラーでも他の年は返す）
  const url = `${config.mlit.baseUrl}/XIT001`;

  const results = await Promise.allSettled(
    years.map((year) =>
      axios
        .get<{ status: string; data: MlitRawRecord[] }>(url, {
          params: { year, city: municipality.cityCode },
          headers: { "Ocp-Apim-Subscription-Key": config.mlit.apiKey },
          decompress: true,
          timeout: 30000,
        })
        .then((res) => {
          if (res.data.status !== "OK") {
            console.warn(`[MLIT API] year=${year} status=${res.data.status}, skipping`);
            return { year, records: [] as TransactionRecord[] };
          }
          console.log(`[MLIT API] year=${year} → ${res.data.data.length} 件`);
          return { year, records: res.data.data.map(normalize) };
        })
    )
  );

  const allRecords: TransactionRecord[] = [];
  const successYears: number[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value.records.length > 0) {
      allRecords.push(...r.value.records);
      successYears.push(years[i]);
    } else if (r.status === "rejected") {
      console.warn(`[MLIT API] year=${years[i]} failed:`, r.reason?.message ?? String(r.reason));
    }
  }

  console.log(`[MLIT API] 合計: ${allRecords.length} 件 (${successYears.length}年分: ${successYears.join(", ")})`);

  if (allRecords.length === 0) {
    throw new Error("MLIT API: 全取得年でデータが取得できませんでした");
  }

  return {
    status: "OK",
    cityCode: municipality.cityCode,
    years: successYears,
    data: allRecords,
  };
}

// ============================================================
// ハザード情報
// ============================================================

export interface FloodHazard {
  hasRisk: boolean;
  maxDepthRank: number | null;  // 1=0.5m未満 2=0.5〜3m 3=3〜5m 4=5〜10m 5=10〜20m 6=20m以上
  maxDepthLabel: string | null;
}

export interface LandslideHazard {
  hasRisk: boolean;
  phenomena: string[];  // ["土石流", "急傾斜地の崩壊", "地すべり"]
}

export interface HazardInfo {
  flood: FloodHazard;
  landslide: LandslideHazard;
}

const FLOOD_DEPTH_LABELS: Record<number, string> = {
  1: "0.5m未満",
  2: "0.5〜3m",
  3: "3〜5m",
  4: "5〜10m",
  5: "10〜20m",
  6: "20m以上",
};

const LANDSLIDE_PHENOMENA_LABELS: Record<number, string> = {
  1: "土石流",
  2: "急傾斜地の崩壊",
  3: "地すべり",
};

interface GeoJsonFeatureCollection {
  type: string;
  features: Array<{ properties: Record<string, unknown> }>;
}

async function fetchTileGeojson(endpoint: string, x: number, y: number, z: number): Promise<GeoJsonFeatureCollection> {
  const url = `${config.mlit.baseUrl}/${endpoint}`;
  const response = await axios.get<GeoJsonFeatureCollection>(url, {
    params: { response_format: "geojson", z, x, y },
    headers: { "Ocp-Apim-Subscription-Key": config.mlit.apiKey },
    timeout: 15000,
  });
  return response.data;
}

async function fetchFloodHazard(x: number, y: number, z: number): Promise<FloodHazard> {
  const data = await fetchTileGeojson("XKT026", x, y, z);
  if (!data.features.length) return { hasRisk: false, maxDepthRank: null, maxDepthLabel: null };

  const maxRank = Math.max(...data.features.map((f) => Number(f.properties["A31a_205"] ?? 0)));
  return {
    hasRisk: true,
    maxDepthRank: maxRank,
    maxDepthLabel: FLOOD_DEPTH_LABELS[maxRank] ?? null,
  };
}

async function fetchLandslideHazard(x: number, y: number, z: number): Promise<LandslideHazard> {
  const data = await fetchTileGeojson("XKT029", x, y, z);
  if (!data.features.length) return { hasRisk: false, phenomena: [] };

  const phenomenaSet = new Set<string>();
  for (const f of data.features) {
    const code = Number(f.properties["A33_001"]);
    const label = LANDSLIDE_PHENOMENA_LABELS[code];
    if (label) phenomenaSet.add(label);
  }
  return { hasRisk: true, phenomena: Array.from(phenomenaSet) };
}

/**
 * 洪水浸水想定区域 (XKT026) と土砂災害警戒区域 (XKT029) を並列取得
 * タイルベースAPIのため lat/lng → z=15 タイル座標に変換して問い合わせ
 */
export async function fetchHazardInfo(lat: number, lng: number): Promise<HazardInfo> {
  const { x, y, z } = latLngToTile(lat, lng, 15);
  const [flood, landslide] = await Promise.all([
    fetchFloodHazard(x, y, z).catch(() => ({ hasRisk: false, maxDepthRank: null, maxDepthLabel: null } as FloodHazard)),
    fetchLandslideHazard(x, y, z).catch(() => ({ hasRisk: false, phenomena: [] } as LandslideHazard)),
  ]);
  return { flood, landslide };
}

export function getMockHazardData(): HazardInfo {
  return {
    flood: { hasRisk: true, maxDepthRank: 2, maxDepthLabel: "0.5〜3m" },
    landslide: { hasRisk: false, phenomena: [] },
  };
}

// ============================================================
// 生活環境情報
// ============================================================

export interface EnvironmentInfo {
  zoning: {
    useArea: string | null;       // 用途地域名
    coverageRatio: string | null; // 建ぺい率
    floorAreaRatio: string | null;// 容積率
  };
  schools: {
    elementary: string | null;    // 小学校区名
    juniorHigh: string | null;    // 中学校区名
  };
  medical: {
    count: number;
    facilities: Array<{ name: string; type: string }>;
  };
  station: {
    name: string | null;
    operator: string | null;
    dailyPassengers: number | null;
  };
}

/** 用途地域 (XKT002): 最頻出の用途地域を返す */
async function fetchZoning(x: number, y: number, z: number): Promise<EnvironmentInfo["zoning"]> {
  const data = await fetchTileGeojson("XKT002", x, y, z);
  if (!data.features.length) return { useArea: null, coverageRatio: null, floorAreaRatio: null };

  // タイル内に複数ポリゴン存在する可能性があるため最頻出を採用
  const tally: Record<string, { count: number; coverage: string; floor: string }> = {};
  for (const f of data.features) {
    const area = String(f.properties["use_area_ja"] ?? "").trim();
    if (!area) continue;
    if (!tally[area]) {
      tally[area] = {
        count: 0,
        coverage: String(f.properties["u_building_coverage_ratio_ja"] ?? "").trim(),
        floor: String(f.properties["u_floor_area_ratio_ja"] ?? "").trim(),
      };
    }
    tally[area].count++;
  }

  const dominant = Object.entries(tally).sort((a, b) => b[1].count - a[1].count)[0];
  if (!dominant) return { useArea: null, coverageRatio: null, floorAreaRatio: null };

  return {
    useArea: dominant[0],
    coverageRatio: dominant[1].coverage || null,
    floorAreaRatio: dominant[1].floor || null,
  };
}

/** 学区 (XKT004 小学校 / XKT005 中学校): 最初のフィーチャー */
async function fetchSchools(x: number, y: number, z: number): Promise<EnvironmentInfo["schools"]> {
  const [elem, jh] = await Promise.all([
    fetchTileGeojson("XKT004", x, y, z).catch(() => ({ type: "FeatureCollection", features: [] })),
    fetchTileGeojson("XKT005", x, y, z).catch(() => ({ type: "FeatureCollection", features: [] })),
  ]);
  const elemName = elem.features[0]?.properties["A27_004_ja"];
  const jhName   = jh.features[0]?.properties["A32_004_ja"];
  return {
    elementary: elemName ? String(elemName) : null,
    juniorHigh: jhName ? String(jhName) : null,
  };
}

/** 医療機関 (XKT010): 件数 + 施設リスト先頭5件 */
async function fetchMedical(x: number, y: number, z: number): Promise<EnvironmentInfo["medical"]> {
  const data = await fetchTileGeojson("XKT010", x, y, z);
  return {
    count: data.features.length,
    facilities: data.features.slice(0, 5)
      .map((f) => ({
        name: String(f.properties["P04_002_ja"] ?? "").trim(),
        type: String(f.properties["P04_001_name_ja"] ?? "").trim(),
      }))
      .filter((f) => f.name),
  };
}

/** 最寄り駅 (XKT015): 乗降客数が最大の駅 */
async function fetchStation(x: number, y: number, z: number): Promise<EnvironmentInfo["station"]> {
  const data = await fetchTileGeojson("XKT015", x, y, z);
  if (!data.features.length) return { name: null, operator: null, dailyPassengers: null };

  // 乗降客数 S12_009 が最大のフィーチャーを採用
  const best = data.features.reduce((a, b) =>
    Number(b.properties["S12_009"] ?? 0) > Number(a.properties["S12_009"] ?? 0) ? b : a
  );
  return {
    name: String(best.properties["S12_001_ja"] ?? "").trim() || null,
    operator: String(best.properties["S12_002_ja"] ?? "").trim() || null,
    dailyPassengers: Number(best.properties["S12_009"]) || null,
  };
}

/**
 * 生活環境情報を並列取得
 * XKT002: 用途地域 / XKT004: 小学校区 / XKT005: 中学校区
 * XKT010: 医療機関 / XKT015: 最寄り駅
 */
export async function fetchEnvironmentInfo(lat: number, lng: number): Promise<EnvironmentInfo> {
  const { x, y, z } = latLngToTile(lat, lng, 15);
  const fallbackZoning  = { useArea: null, coverageRatio: null, floorAreaRatio: null };
  const fallbackSchools = { elementary: null, juniorHigh: null };
  const fallbackMedical = { count: 0, facilities: [] };
  const fallbackStation = { name: null, operator: null, dailyPassengers: null };

  const [zoning, schools, medical, station] = await Promise.all([
    fetchZoning(x, y, z).catch(() => fallbackZoning),
    fetchSchools(x, y, z).catch(() => fallbackSchools),
    fetchMedical(x, y, z).catch(() => fallbackMedical),
    fetchStation(x, y, z).catch(() => fallbackStation),
  ]);

  return { zoning, schools, medical, station };
}

export function getMockEnvironmentData(): EnvironmentInfo {
  return {
    zoning: { useArea: "第一種住居地域", coverageRatio: "60%", floorAreaRatio: "200%" },
    schools: { elementary: "○○小学校", juniorHigh: "○○中学校" },
    medical: { count: 8, facilities: [
      { name: "○○クリニック", type: "診療所" },
      { name: "△△病院", type: "病院" },
    ]},
    station: { name: "××駅", operator: "○○電鉄", dailyPassengers: 45000 },
  };
}

// ============================================================
// モックデータ（APIキーなし・テスト用）
// ============================================================
export function getMockTransactionData(_lat: number, _lng: number): MlitApiResponse {
  const baseUnitPrice = Math.floor(450000 + Math.random() * 200000);
  return {
    status: "mock",
    cityCode: "13122",
    years: [2020, 2021, 2022, 2023, 2024],
    data: [
      {
        priceCategory: "不動産取引価格情報",
        type: "宅地(土地と建物)",
        region: "住宅地",
        municipalityCode: "13122",
        prefecture: "東京都",
        municipality: "葛飾区",
        districtName: "青戸",
        tradePrice: baseUnitPrice * 65,
        pricePerUnit: null,
        floorPlan: "2LDK",
        area: 65.5,
        unitPrice: baseUnitPrice,
        landShape: "ほぼ長方形",
        frontage: 6.0,
        roadBreadth: 5.0,
        totalFloorArea: 65.5,
        buildingYear: 2018,
        structure: "RC",
        use: "住宅",
        purpose: "住宅",
        direction: "南",
        classification: "区道",
        cityPlanning: "第１種住居地域",
        coverageRatio: 60,
        floorAreaRatio: 200,
        period: "2024年第1四半期",
        renovation: "改築済み",
        remarks: null,
      },
      {
        priceCategory: "不動産取引価格情報",
        type: "中古マンション等",
        region: "住宅地",
        municipalityCode: "13122",
        prefecture: "東京都",
        municipality: "葛飾区",
        districtName: "亀有",
        tradePrice: (baseUnitPrice - 30000) * 48,
        pricePerUnit: null,
        floorPlan: "3LDK",
        area: 48.0,
        unitPrice: baseUnitPrice - 30000,
        landShape: "ほぼ長方形",
        frontage: null,
        roadBreadth: null,
        totalFloorArea: 48.0,
        buildingYear: 2010,
        structure: "RC",
        use: "住宅",
        purpose: "住宅",
        direction: "東",
        classification: null,
        cityPlanning: "近隣商業地域",
        coverageRatio: 80,
        floorAreaRatio: 400,
        period: "2024年第1四半期",
        renovation: null,
        remarks: null,
      },
    ],
  };
}
