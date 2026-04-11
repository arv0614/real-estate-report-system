/**
 * プログラマティックSEO用 エリア定義
 * URL スラッグ → 日本語名・英語名・座標 のマスターデータ
 */

export interface AreaDef {
  prefSlug: string;   // URL: /reports/[prefSlug]/[citySlug]
  citySlug: string;
  prefecture: string; // 東京都
  prefectureEn: string; // Tokyo
  city: string;       // 葛飾区
  cityEn: string;     // Katsushika
  lat: number;
  lng: number;
}

// ── 都道府県スラッグ → 日本語名 ──────────────────────────────
export const PREF_NAMES: Record<string, string> = {
  tokyo:     "東京都",
  osaka:     "大阪府",
  kanagawa:  "神奈川県",
  aichi:     "愛知県",
  fukuoka:   "福岡県",
  saitama:   "埼玉県",
  chiba:     "千葉県",
  hyogo:     "兵庫県",
  kyoto:     "京都府",
};

export const PREF_NAMES_EN: Record<string, string> = {
  tokyo:     "Tokyo",
  osaka:     "Osaka",
  kanagawa:  "Kanagawa",
  aichi:     "Aichi",
  fukuoka:   "Fukuoka",
  saitama:   "Saitama",
  chiba:     "Chiba",
  hyogo:     "Hyogo",
  kyoto:     "Kyoto",
};

// ── エリア一覧 ────────────────────────────────────────────────
export const AREAS: AreaDef[] = [
  // 東京都 23 区
  { prefSlug: "tokyo", citySlug: "chiyoda",   prefecture: "東京都", prefectureEn: "Tokyo", city: "千代田区",   cityEn: "Chiyoda",   lat: 35.6940, lng: 139.7536 },
  { prefSlug: "tokyo", citySlug: "chuo",      prefecture: "東京都", prefectureEn: "Tokyo", city: "中央区",     cityEn: "Chuo",      lat: 35.6703, lng: 139.7727 },
  { prefSlug: "tokyo", citySlug: "minato",    prefecture: "東京都", prefectureEn: "Tokyo", city: "港区",       cityEn: "Minato",    lat: 35.6580, lng: 139.7514 },
  { prefSlug: "tokyo", citySlug: "shinjuku",  prefecture: "東京都", prefectureEn: "Tokyo", city: "新宿区",     cityEn: "Shinjuku",  lat: 35.6938, lng: 139.7034 },
  { prefSlug: "tokyo", citySlug: "bunkyo",    prefecture: "東京都", prefectureEn: "Tokyo", city: "文京区",     cityEn: "Bunkyo",    lat: 35.7080, lng: 139.7522 },
  { prefSlug: "tokyo", citySlug: "taito",     prefecture: "東京都", prefectureEn: "Tokyo", city: "台東区",     cityEn: "Taito",     lat: 35.7126, lng: 139.7799 },
  { prefSlug: "tokyo", citySlug: "sumida",    prefecture: "東京都", prefectureEn: "Tokyo", city: "墨田区",     cityEn: "Sumida",    lat: 35.7102, lng: 139.8021 },
  { prefSlug: "tokyo", citySlug: "koto",      prefecture: "東京都", prefectureEn: "Tokyo", city: "江東区",     cityEn: "Koto",      lat: 35.6717, lng: 139.8170 },
  { prefSlug: "tokyo", citySlug: "shinagawa", prefecture: "東京都", prefectureEn: "Tokyo", city: "品川区",     cityEn: "Shinagawa", lat: 35.6088, lng: 139.7302 },
  { prefSlug: "tokyo", citySlug: "meguro",    prefecture: "東京都", prefectureEn: "Tokyo", city: "目黒区",     cityEn: "Meguro",    lat: 35.6329, lng: 139.6985 },
  { prefSlug: "tokyo", citySlug: "ota",       prefecture: "東京都", prefectureEn: "Tokyo", city: "大田区",     cityEn: "Ota",       lat: 35.5614, lng: 139.7160 },
  { prefSlug: "tokyo", citySlug: "setagaya",  prefecture: "東京都", prefectureEn: "Tokyo", city: "世田谷区",   cityEn: "Setagaya",  lat: 35.6464, lng: 139.6533 },
  { prefSlug: "tokyo", citySlug: "shibuya",   prefecture: "東京都", prefectureEn: "Tokyo", city: "渋谷区",     cityEn: "Shibuya",   lat: 35.6624, lng: 139.7042 },
  { prefSlug: "tokyo", citySlug: "nakano",    prefecture: "東京都", prefectureEn: "Tokyo", city: "中野区",     cityEn: "Nakano",    lat: 35.7074, lng: 139.6635 },
  { prefSlug: "tokyo", citySlug: "suginami",  prefecture: "東京都", prefectureEn: "Tokyo", city: "杉並区",     cityEn: "Suginami",  lat: 35.6997, lng: 139.6368 },
  { prefSlug: "tokyo", citySlug: "toshima",   prefecture: "東京都", prefectureEn: "Tokyo", city: "豊島区",     cityEn: "Toshima",   lat: 35.7282, lng: 139.7178 },
  { prefSlug: "tokyo", citySlug: "kita",      prefecture: "東京都", prefectureEn: "Tokyo", city: "北区",       cityEn: "Kita",      lat: 35.7528, lng: 139.7337 },
  { prefSlug: "tokyo", citySlug: "arakawa",   prefecture: "東京都", prefectureEn: "Tokyo", city: "荒川区",     cityEn: "Arakawa",   lat: 35.7366, lng: 139.7834 },
  { prefSlug: "tokyo", citySlug: "itabashi",  prefecture: "東京都", prefectureEn: "Tokyo", city: "板橋区",     cityEn: "Itabashi",  lat: 35.7509, lng: 139.7086 },
  { prefSlug: "tokyo", citySlug: "nerima",    prefecture: "東京都", prefectureEn: "Tokyo", city: "練馬区",     cityEn: "Nerima",    lat: 35.7360, lng: 139.6518 },
  { prefSlug: "tokyo", citySlug: "adachi",    prefecture: "東京都", prefectureEn: "Tokyo", city: "足立区",     cityEn: "Adachi",    lat: 35.7752, lng: 139.8043 },
  { prefSlug: "tokyo", citySlug: "katsushika",prefecture: "東京都", prefectureEn: "Tokyo", city: "葛飾区",     cityEn: "Katsushika",lat: 35.7445, lng: 139.8475 },
  { prefSlug: "tokyo", citySlug: "edogawa",   prefecture: "東京都", prefectureEn: "Tokyo", city: "江戸川区",   cityEn: "Edogawa",   lat: 35.7068, lng: 139.8685 },
  // 東京都 主要市
  { prefSlug: "tokyo", citySlug: "hachioji",  prefecture: "東京都", prefectureEn: "Tokyo", city: "八王子市",   cityEn: "Hachioji",  lat: 35.6664, lng: 139.3161 },
  { prefSlug: "tokyo", citySlug: "tachikawa", prefecture: "東京都", prefectureEn: "Tokyo", city: "立川市",     cityEn: "Tachikawa", lat: 35.6977, lng: 139.4162 },
  { prefSlug: "tokyo", citySlug: "musashino", prefecture: "東京都", prefectureEn: "Tokyo", city: "武蔵野市",   cityEn: "Musashino", lat: 35.7176, lng: 139.5658 },
  // 神奈川県
  { prefSlug: "kanagawa", citySlug: "yokohama-naka",  prefecture: "神奈川県", prefectureEn: "Kanagawa", city: "横浜市中区",   cityEn: "Yokohama Naka-ku",   lat: 35.4437, lng: 139.6380 },
  { prefSlug: "kanagawa", citySlug: "kawasaki-naka",  prefecture: "神奈川県", prefectureEn: "Kanagawa", city: "川崎市中原区", cityEn: "Kawasaki Nakahara-ku",lat: 35.5760, lng: 139.6617 },
  { prefSlug: "kanagawa", citySlug: "sagamihara",     prefecture: "神奈川県", prefectureEn: "Kanagawa", city: "相模原市中央区",cityEn: "Sagamihara Chuo-ku", lat: 35.5694, lng: 139.3735 },
  // 大阪府
  { prefSlug: "osaka", citySlug: "chuo",    prefecture: "大阪府", prefectureEn: "Osaka", city: "中央区",   cityEn: "Chuo",    lat: 34.6832, lng: 135.5054 },
  { prefSlug: "osaka", citySlug: "naniwa",  prefecture: "大阪府", prefectureEn: "Osaka", city: "浪速区",   cityEn: "Naniwa",  lat: 34.6655, lng: 135.4985 },
  { prefSlug: "osaka", citySlug: "kita",    prefecture: "大阪府", prefectureEn: "Osaka", city: "北区",     cityEn: "Kita",    lat: 34.7019, lng: 135.4978 },
  { prefSlug: "osaka", citySlug: "tennoji", prefecture: "大阪府", prefectureEn: "Osaka", city: "天王寺区", cityEn: "Tennoji", lat: 34.6476, lng: 135.5155 },
];

/** スラッグからエリア定義を検索 */
export function findArea(prefSlug: string, citySlug: string): AreaDef | undefined {
  return AREAS.find(a => a.prefSlug === prefSlug && a.citySlug === citySlug);
}

/** 特定都道府県のエリア一覧を返す */
export function getAreasByPref(prefSlug: string): AreaDef[] {
  return AREAS.filter(a => a.prefSlug === prefSlug);
}

/** 東京23区のみ（フッターリンク用） */
export const TOKYO_23_WARDS = AREAS.filter(
  a => a.prefSlug === "tokyo" && a.city.endsWith("区") && !a.city.includes("市")
);
