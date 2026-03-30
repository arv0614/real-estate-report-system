/**
 * プログラマティックSEO用 エリア定義
 * URL スラッグ → 日本語名・座標 のマスターデータ
 */

export interface AreaDef {
  prefSlug: string;   // URL: /reports/[prefSlug]/[citySlug]
  citySlug: string;
  prefecture: string; // 東京都
  city: string;       // 葛飾区
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

// ── エリア一覧 ────────────────────────────────────────────────
export const AREAS: AreaDef[] = [
  // 東京都 23 区
  { prefSlug: "tokyo", citySlug: "chiyoda",  prefecture: "東京都", city: "千代田区", lat: 35.6940, lng: 139.7536 },
  { prefSlug: "tokyo", citySlug: "chuo",     prefecture: "東京都", city: "中央区",   lat: 35.6703, lng: 139.7727 },
  { prefSlug: "tokyo", citySlug: "minato",   prefecture: "東京都", city: "港区",     lat: 35.6580, lng: 139.7514 },
  { prefSlug: "tokyo", citySlug: "shinjuku", prefecture: "東京都", city: "新宿区",   lat: 35.6938, lng: 139.7034 },
  { prefSlug: "tokyo", citySlug: "bunkyo",   prefecture: "東京都", city: "文京区",   lat: 35.7080, lng: 139.7522 },
  { prefSlug: "tokyo", citySlug: "taito",    prefecture: "東京都", city: "台東区",   lat: 35.7126, lng: 139.7799 },
  { prefSlug: "tokyo", citySlug: "sumida",   prefecture: "東京都", city: "墨田区",   lat: 35.7102, lng: 139.8021 },
  { prefSlug: "tokyo", citySlug: "koto",     prefecture: "東京都", city: "江東区",   lat: 35.6717, lng: 139.8170 },
  { prefSlug: "tokyo", citySlug: "shinagawa",prefecture: "東京都", city: "品川区",   lat: 35.6088, lng: 139.7302 },
  { prefSlug: "tokyo", citySlug: "meguro",   prefecture: "東京都", city: "目黒区",   lat: 35.6329, lng: 139.6985 },
  { prefSlug: "tokyo", citySlug: "ota",      prefecture: "東京都", city: "大田区",   lat: 35.5614, lng: 139.7160 },
  { prefSlug: "tokyo", citySlug: "setagaya", prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6533 },
  { prefSlug: "tokyo", citySlug: "shibuya",  prefecture: "東京都", city: "渋谷区",   lat: 35.6624, lng: 139.7042 },
  { prefSlug: "tokyo", citySlug: "nakano",   prefecture: "東京都", city: "中野区",   lat: 35.7074, lng: 139.6635 },
  { prefSlug: "tokyo", citySlug: "suginami", prefecture: "東京都", city: "杉並区",   lat: 35.6997, lng: 139.6368 },
  { prefSlug: "tokyo", citySlug: "toshima",  prefecture: "東京都", city: "豊島区",   lat: 35.7282, lng: 139.7178 },
  { prefSlug: "tokyo", citySlug: "kita",     prefecture: "東京都", city: "北区",     lat: 35.7528, lng: 139.7337 },
  { prefSlug: "tokyo", citySlug: "arakawa",  prefecture: "東京都", city: "荒川区",   lat: 35.7366, lng: 139.7834 },
  { prefSlug: "tokyo", citySlug: "itabashi", prefecture: "東京都", city: "板橋区",   lat: 35.7509, lng: 139.7086 },
  { prefSlug: "tokyo", citySlug: "nerima",   prefecture: "東京都", city: "練馬区",   lat: 35.7360, lng: 139.6518 },
  { prefSlug: "tokyo", citySlug: "adachi",   prefecture: "東京都", city: "足立区",   lat: 35.7752, lng: 139.8043 },
  { prefSlug: "tokyo", citySlug: "katsushika",prefecture: "東京都",city: "葛飾区",   lat: 35.7445, lng: 139.8475 },
  { prefSlug: "tokyo", citySlug: "edogawa",  prefecture: "東京都", city: "江戸川区", lat: 35.7068, lng: 139.8685 },
  // 東京都 主要市
  { prefSlug: "tokyo", citySlug: "hachioji", prefecture: "東京都", city: "八王子市", lat: 35.6664, lng: 139.3161 },
  { prefSlug: "tokyo", citySlug: "tachikawa",prefecture: "東京都", city: "立川市",   lat: 35.6977, lng: 139.4162 },
  { prefSlug: "tokyo", citySlug: "musashino", prefecture: "東京都",city: "武蔵野市", lat: 35.7176, lng: 139.5658 },
  // 神奈川県
  { prefSlug: "kanagawa", citySlug: "yokohama-naka", prefecture: "神奈川県", city: "横浜市中区", lat: 35.4437, lng: 139.6380 },
  { prefSlug: "kanagawa", citySlug: "kawasaki-naka",  prefecture: "神奈川県", city: "川崎市中原区", lat: 35.5760, lng: 139.6617 },
  { prefSlug: "kanagawa", citySlug: "sagamihara",     prefecture: "神奈川県", city: "相模原市中央区", lat: 35.5694, lng: 139.3735 },
  // 大阪府
  { prefSlug: "osaka", citySlug: "chuo",    prefecture: "大阪府", city: "中央区",   lat: 34.6832, lng: 135.5054 },
  { prefSlug: "osaka", citySlug: "naniwa",  prefecture: "大阪府", city: "浪速区",   lat: 34.6655, lng: 135.4985 },
  { prefSlug: "osaka", citySlug: "kita",    prefecture: "大阪府", city: "北区",     lat: 34.7019, lng: 135.4978 },
  { prefSlug: "osaka", citySlug: "tennoji", prefecture: "大阪府", city: "天王寺区", lat: 34.6476, lng: 135.5155 },
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
