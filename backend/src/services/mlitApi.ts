import axios from "axios";
import { config } from "../config";

export interface TransactionRecord {
  Prefecture: string;
  Municipality: string;
  DistrictName: string;
  TradePrice: number;
  PricePerUnit: number;
  FloorPlan: string;
  Area: number;
  UnitPrice: number;
  LandShape: string;
  Frontage: number;
  TotalFloorArea: number;
  BuildingYear: number;
  Structure: string;
  Use: string;
  Purpose: string;
  Direction: string;
  Classification: string;
  CityPlanning: string;
  CoverageRatio: number;
  FloorAreaRatio: number;
  Period: string;
  Renovation: string;
  Remarks: string;
}

export interface MlitApiResponse {
  status: string;
  data: TransactionRecord[];
}

/**
 * 国交省 不動産情報ライブラリAPIから取引価格情報を取得
 * ズームレベル15のタイル座標で検索
 */
export async function fetchTransactionPrices(
  lat: number,
  lng: number,
  zoom: number = 15
): Promise<MlitApiResponse> {
  // MLIT API は座標ベースではなくタイル座標で検索
  const url = `${config.mlit.baseUrl}/XIT001`;

  const params = {
    response_format: "json",
    lat: lat.toString(),
    lon: lng.toString(),
    zoom: zoom.toString(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.mlit.apiKey) {
    headers["Ocp-Apim-Subscription-Key"] = config.mlit.apiKey;
  }

  const response = await axios.get<MlitApiResponse>(url, { params, headers, timeout: 30000 });
  return response.data;
}

/**
 * モックデータを返す（APIキーなし・開発環境用）
 */
export function getMockTransactionData(lat: number, lng: number): MlitApiResponse {
  const basePrice = Math.floor(450000 + Math.random() * 200000); // 45〜65万円/㎡
  return {
    status: "mock",
    data: [
      {
        Prefecture: "東京都",
        Municipality: "葛飾区",
        DistrictName: "新小岩",
        TradePrice: basePrice * 65,
        PricePerUnit: basePrice,
        FloorPlan: "2LDK",
        Area: 65.5,
        UnitPrice: basePrice,
        LandShape: "ほぼ長方形",
        Frontage: 6.0,
        TotalFloorArea: 65.5,
        BuildingYear: 2018,
        Structure: "RC",
        Use: "住宅",
        Purpose: "住宅",
        Direction: "南",
        Classification: "中古マンション等",
        CityPlanning: "第一種住居地域",
        CoverageRatio: 60,
        FloorAreaRatio: 200,
        Period: "2024年第1四半期",
        Renovation: "改築済み",
        Remarks: "",
      },
      {
        Prefecture: "東京都",
        Municipality: "葛飾区",
        DistrictName: "亀有",
        TradePrice: (basePrice - 30000) * 48,
        PricePerUnit: basePrice - 30000,
        FloorPlan: "3LDK",
        Area: 48.0,
        UnitPrice: basePrice - 30000,
        LandShape: "ほぼ長方形",
        Frontage: 5.5,
        TotalFloorArea: 48.0,
        BuildingYear: 2010,
        Structure: "RC",
        Use: "住宅",
        Purpose: "住宅",
        Direction: "東",
        Classification: "中古マンション等",
        CityPlanning: "近隣商業地域",
        CoverageRatio: 80,
        FloorAreaRatio: 400,
        Period: "2024年第1四半期",
        Renovation: "未改築",
        Remarks: "",
      },
    ],
  };
}
