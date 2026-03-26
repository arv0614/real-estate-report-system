import axios from "axios";

export interface MunicipalityInfo {
  cityCode: string;  // 5桁市区町村コード（例: "13122"）
  prefCode: string;  // 2桁都道府県コード（例: "13"）
  districtName: string; // 丁目名（例: "立石八丁目"）
}

/**
 * 国土地理院 リバースジオコーダ API
 * 緯度経度 → 市区町村コードを無料で取得できる
 * https://mreversegeocoder.gsi.go.jp/
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<MunicipalityInfo> {
  const url = "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress";
  const response = await axios.get<{
    results: { muniCd: string; lv01Nm: string };
  }>(url, {
    params: { lat, lon: lng },
    timeout: 10000,
  });

  const { muniCd, lv01Nm } = response.data.results;
  return {
    cityCode: muniCd,
    prefCode: muniCd.substring(0, 2),
    districtName: lv01Nm,
  };
}
