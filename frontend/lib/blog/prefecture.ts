// ブログ記事一覧の都道府県フィルタ用データ・ロジック。
//
// primaryLocation.name は AI 生成のため表記が不安定（例:「熊本県菊陽町」のように
// 都道府県込みの場合もあれば「千歳市」「宮城野区」のように市区町村名だけの場合もある）
// かつ翻訳記事（en/zh-TW/zh-CN）では既に現地語に翻訳済みで日本語の都道府県名を
// 含まないことが多い。一方 lat/lng は言語に依存せず全記事に存在するため、
// ① name に都道府県名がそのまま含まれていればそれを採用、
// ② 含まれていなければ都道府県庁所在地に最も近い都道府県を採用
// というハイブリッド判定で、表記揺れ・翻訳に関わらず安定して都道府県を求める。

export interface PrefectureInfo {
  name: string; // 日本語表記（都道府県フィルタの内部キーとしても使う）
  lat: number;
  lng: number;
  labelEn: string;
}

// 47都道府県 + 都道府県庁所在地の代表座標（フィルタ用途の近似分類が目的であり、
// 行政境界の厳密な判定を必要としないため十分な精度）。
export const PREFECTURES: PrefectureInfo[] = [
  { name: "北海道", lat: 43.0642, lng: 141.3469, labelEn: "Hokkaido" },
  { name: "青森県", lat: 40.8244, lng: 140.74, labelEn: "Aomori" },
  { name: "岩手県", lat: 39.7036, lng: 141.1527, labelEn: "Iwate" },
  { name: "宮城県", lat: 38.2688, lng: 140.8721, labelEn: "Miyagi" },
  { name: "秋田県", lat: 39.7186, lng: 140.1024, labelEn: "Akita" },
  { name: "山形県", lat: 38.2404, lng: 140.3633, labelEn: "Yamagata" },
  { name: "福島県", lat: 37.75, lng: 140.4678, labelEn: "Fukushima" },
  { name: "茨城県", lat: 36.3418, lng: 140.4468, labelEn: "Ibaraki" },
  { name: "栃木県", lat: 36.5658, lng: 139.8836, labelEn: "Tochigi" },
  { name: "群馬県", lat: 36.3912, lng: 139.0608, labelEn: "Gunma" },
  { name: "埼玉県", lat: 35.8569, lng: 139.6489, labelEn: "Saitama" },
  { name: "千葉県", lat: 35.6047, lng: 140.1233, labelEn: "Chiba" },
  { name: "東京都", lat: 35.6895, lng: 139.6917, labelEn: "Tokyo" },
  { name: "神奈川県", lat: 35.4478, lng: 139.6425, labelEn: "Kanagawa" },
  { name: "新潟県", lat: 37.9026, lng: 139.0232, labelEn: "Niigata" },
  { name: "富山県", lat: 36.6953, lng: 137.2113, labelEn: "Toyama" },
  { name: "石川県", lat: 36.5947, lng: 136.6256, labelEn: "Ishikawa" },
  { name: "福井県", lat: 36.0652, lng: 136.2216, labelEn: "Fukui" },
  { name: "山梨県", lat: 35.6642, lng: 138.5684, labelEn: "Yamanashi" },
  { name: "長野県", lat: 36.6513, lng: 138.181, labelEn: "Nagano" },
  { name: "岐阜県", lat: 35.3912, lng: 136.7223, labelEn: "Gifu" },
  { name: "静岡県", lat: 34.9769, lng: 138.3831, labelEn: "Shizuoka" },
  { name: "愛知県", lat: 35.1802, lng: 136.9066, labelEn: "Aichi" },
  { name: "三重県", lat: 34.7303, lng: 136.5086, labelEn: "Mie" },
  { name: "滋賀県", lat: 35.0045, lng: 135.8686, labelEn: "Shiga" },
  { name: "京都府", lat: 35.0212, lng: 135.7556, labelEn: "Kyoto" },
  { name: "大阪府", lat: 34.6863, lng: 135.52, labelEn: "Osaka" },
  { name: "兵庫県", lat: 34.6913, lng: 135.183, labelEn: "Hyogo" },
  { name: "奈良県", lat: 34.6851, lng: 135.8328, labelEn: "Nara" },
  { name: "和歌山県", lat: 34.226, lng: 135.1675, labelEn: "Wakayama" },
  { name: "鳥取県", lat: 35.5039, lng: 134.2381, labelEn: "Tottori" },
  { name: "島根県", lat: 35.4723, lng: 133.0505, labelEn: "Shimane" },
  { name: "岡山県", lat: 34.6618, lng: 133.935, labelEn: "Okayama" },
  { name: "広島県", lat: 34.3966, lng: 132.4596, labelEn: "Hiroshima" },
  { name: "山口県", lat: 34.1861, lng: 131.4706, labelEn: "Yamaguchi" },
  { name: "徳島県", lat: 34.0658, lng: 134.5593, labelEn: "Tokushima" },
  { name: "香川県", lat: 34.3401, lng: 134.0434, labelEn: "Kagawa" },
  { name: "愛媛県", lat: 33.8417, lng: 132.7658, labelEn: "Ehime" },
  { name: "高知県", lat: 33.5597, lng: 133.5311, labelEn: "Kochi" },
  { name: "福岡県", lat: 33.6064, lng: 130.4181, labelEn: "Fukuoka" },
  { name: "佐賀県", lat: 33.2494, lng: 130.2988, labelEn: "Saga" },
  { name: "長崎県", lat: 32.7448, lng: 129.8737, labelEn: "Nagasaki" },
  { name: "熊本県", lat: 32.7898, lng: 130.7417, labelEn: "Kumamoto" },
  { name: "大分県", lat: 33.2382, lng: 131.6126, labelEn: "Oita" },
  { name: "宮崎県", lat: 31.9111, lng: 131.4239, labelEn: "Miyazaki" },
  { name: "鹿児島県", lat: 31.5602, lng: 130.5581, labelEn: "Kagoshima" },
  { name: "沖縄県", lat: 26.2124, lng: 127.6809, labelEn: "Okinawa" },
];

/** name 文字列に都道府県名がそのまま含まれていれば返す（日本語記事向けの高速パス）。 */
function prefectureFromName(name: string | undefined): string | null {
  if (!name) return null;
  for (const p of PREFECTURES) {
    if (name.includes(p.name)) return p.name;
  }
  return null;
}

/** 都道府県庁所在地への距離が最も近い都道府県を返す（言語非依存のフォールバック）。 */
function nearestPrefectureByLatLng(lat: number, lng: number): string {
  let best = PREFECTURES[0];
  let bestDist = Infinity;
  for (const p of PREFECTURES) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best.name;
}

/** primaryLocation から都道府県（日本語の内部キー）を求める。判定不能なら null。 */
export function prefectureForLocation(
  loc: { name?: string; lat?: number; lng?: number } | undefined | null,
): string | null {
  if (!loc) return null;
  const byName = prefectureFromName(loc.name);
  if (byName) return byName;
  if (typeof loc.lat === "number" && typeof loc.lng === "number" && isFinite(loc.lat) && isFinite(loc.lng)) {
    return nearestPrefectureByLatLng(loc.lat, loc.lng);
  }
  return null;
}

/** 都道府県の日本語名 → 表示ラベル（en はローマ字、zh-TW/zh-CN は漢字表記を流用）。 */
export function prefectureLabel(prefName: string, locale: string): string {
  if (locale === "en") {
    const found = PREFECTURES.find((p) => p.name === prefName);
    return found?.labelEn ?? prefName;
  }
  return prefName;
}
