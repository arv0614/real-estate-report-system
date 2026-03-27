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
  year: number;
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

/** 取得対象年：前年を基準にする（当年データが未整備の場合があるため） */
function getTargetYear(): number {
  return new Date().getFullYear() - 1;
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
  const year = getTargetYear();

  console.log(
    `[MLIT API] 逆ジオコーディング完了: cityCode=${municipality.cityCode} (${municipality.districtName})`
  );

  // Step2: XIT001 呼び出し
  const url = `${config.mlit.baseUrl}/XIT001`;
  const response = await axios.get<{ status: string; data: MlitRawRecord[] }>(
    url,
    {
      params: {
        year,
        city: municipality.cityCode,
      },
      headers: {
        "Ocp-Apim-Subscription-Key": config.mlit.apiKey,
      },
      // レスポンスがgzip圧縮されているため decompress: true が必要
      decompress: true,
      timeout: 30000,
    }
  );

  const raw = response.data;

  if (raw.status !== "OK") {
    throw new Error(`MLIT API returned status: ${raw.status}`);
  }

  console.log(
    `[MLIT API] 取得完了: city=${municipality.cityCode} year=${year} → ${raw.data.length} 件`
  );

  return {
    status: raw.status,
    cityCode: municipality.cityCode,
    year,
    data: raw.data.map(normalize),
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
// モックデータ（APIキーなし・テスト用）
// ============================================================
export function getMockTransactionData(_lat: number, _lng: number): MlitApiResponse {
  const baseUnitPrice = Math.floor(450000 + Math.random() * 200000);
  return {
    status: "mock",
    cityCode: "13122",
    year: 2024,
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
