/** GSI 住所検索API で住所→座標を取得 */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const [lng, lat] = data[0].geometry.coordinates as [number, number];
    return { lat, lng };
  } catch {
    return null;
  }
}

/** GSI リバースジオコーダ で座標→町丁目名を取得 */
export async function reverseGeocodeDistrict(lat: number, lng: number): Promise<string | null> {
  const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lon=${lng}&lat=${lat}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.results?.lv01Nm as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * GSIの町丁目名（例："押上一丁目"）をMLIT地区名リスト（例：["押上"]）に照合する。
 * 1. 完全一致
 * 2. 丁目番号を除いたベース名で前方一致
 */
export function matchDistrictName(gsiName: string, districtNames: string[]): string {
  if (!gsiName) return "";
  if (districtNames.includes(gsiName)) return gsiName;
  // "押上一丁目" → "押上", "西新宿２丁目" → "西新宿"
  const base = gsiName.replace(/[一二三四五六七八九十百千]+丁目$/, "").replace(/\d+丁目$/, "").trim();
  return districtNames.find((d) => d === base || d.startsWith(base) || base.startsWith(d)) ?? "";
}
