export interface TransactionRecord {
  priceCategory: string;
  type: string;
  region: string;
  municipalityCode: string;
  prefecture: string;
  municipality: string;
  districtName: string;
  tradePrice: number;
  pricePerUnit: number | null;
  floorPlan: string | null;
  area: number | null;
  unitPrice: number | null;
  landShape: string | null;
  frontage: number | null;
  roadBreadth: number | null;
  totalFloorArea: number | null;
  buildingYear: number | null;
  structure: string | null;
  use: string;
  purpose: string | null;
  direction: string | null;
  classification: string | null;
  cityPlanning: string;
  coverageRatio: number | null;
  floorAreaRatio: number | null;
  period: string;
  renovation: string | null;
  remarks: string | null;
}

export interface ApiData {
  status: string;
  cityCode: string;
  year: number;
  data: TransactionRecord[];
}

export interface TransactionApiResponse {
  source: "api" | "cache" | "mock";
  cacheKey: string | null;
  fetchedAt: string;
  expiresAt: string | null;
  data: ApiData;
}

export interface TransactionSummary {
  totalCount: number;
  avgUnitPrice: number | null;      // 円/㎡ 平均
  avgTradePrice: number;            // 取引価格 平均
  medianTradePrice: number;         // 中央値
  minTradePrice: number;
  maxTradePrice: number;
  typeBreakdown: Record<string, number>; // { "宅地(土地と建物)": 120, ... }
}
