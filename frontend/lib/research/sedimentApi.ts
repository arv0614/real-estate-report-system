/**
 * 土砂災害・急傾斜地・地すべり防止区域の判定
 * 不動産情報ライブラリ API (reinfolib.mlit.go.jp) を使用
 *
 * === 実測済み API 属性フィールド (2025-07-03 確認) ===
 *
 * XKT029 (土砂災害警戒区域) — zoom=15, HTTP 200。z=16+ は 400。
 *   A33_001: number  現象コード (1=土石流, 2=急傾斜地の崩壊, 3=地すべり)
 *   A33_002: number  区域種別   (1=警戒区域, 2=特別警戒区域)
 *   A33_003: string  都道府県コード (2桁)
 *   A33_004: string  区域番号
 *   A33_005: string  区域名称
 *   A33_006: string  市区町村名
 *   A33_007: string  告示日 (YYYY/MM/DD)
 *   A33_008: number  建物有無フラグ
 *   geometry: Polygon あり
 *
 * XKT022 (急傾斜地崩壊危険区域) — zoom=12〜15, HTTP 200。
 *   city_name, address, prefecture_name, group_code, prefecture_code,
 *   region_name, landslide_area, public_notice_date, public_notice_number
 *   ※ 警戒/特別区別フィールドなし (危険区域は一種のみ)
 *   geometry: Polygon あり
 *
 * XKT021 (地すべり防止区域) — zoom=12〜15, HTTP 200。
 *   ※ 全国約3,000区域のため取得ゼロが常態。同構造と推定。
 *   geometry: Polygon あり (と推定)
 */

import { unstable_cache } from "next/cache";
import { latLngToTile, pointInRing } from "./geo";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WarningZoneResult {
  /** 警戒区域に含まれるか */
  inside: boolean;
  /** 特別警戒区域 (A33_002=2) に含まれるか */
  special: boolean;
  /** 現象種別リスト */
  phenomena: string[];
}

export interface SedimentData {
  /** XKT029: 土砂災害警戒区域。null=取得失敗 */
  warningZone: WarningZoneResult | null;
  /** XKT022: 急傾斜地崩壊危険区域。null=取得失敗, false=区域外 */
  steepSlopeZone: boolean | null;
  /** XKT021: 地すべり防止区域。null=取得失敗, false=区域外 */
  landslideZone: boolean | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHENOMENA_LABELS: Record<number, string> = {
  1: "土石流",
  2: "急傾斜地の崩壊",
  3: "地すべり",
};

type GeoCoords = [number, number];
type Ring = GeoCoords[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface GeoFeature {
  properties: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
}

function featureContainsPoint(feat: GeoFeature, lat: number, lng: number): boolean {
  const geom = feat.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") {
    return pointInRing(lat, lng, (geom.coordinates as Polygon)[0]);
  }
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as MultiPolygon).some((poly) =>
      pointInRing(lat, lng, poly[0])
    );
  }
  return false;
}

const MLIT_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";

function getApiKey(): string {
  return process.env.MLIT_API_KEY ?? "";
}

async function fetchZoneGeoJson(
  endpoint: string,
  z: number,
  x: number,
  y: number
): Promise<GeoFeature[]> {
  const key = getApiKey();
  if (!key) return [];
  try {
    const res = await fetch(
      `${MLIT_BASE}/${endpoint}?response_format=geojson&z=${z}&x=${x}&y=${y}`,
      {
        headers: { "Ocp-Apim-Subscription-Key": key },
        next: { revalidate: 90 * 24 * 3600 },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as { features: GeoFeature[] };
    return data.features ?? [];
  } catch {
    return [];
  }
}

// ── XKT029: 土砂災害警戒区域 ────────────────────────────────────────────────

async function _fetchWarningZone(
  lat: number,
  lng: number
): Promise<WarningZoneResult | null> {
  try {
    const { x, y } = latLngToTile(lat, lng, 15);
    const features = await fetchZoneGeoJson("XKT029", 15, x, y);
    if (features.length === 0) {
      return { inside: false, special: false, phenomena: [] };
    }

    let insideAny = false;
    let hasSpecial = false;
    const phenomenaSet = new Set<string>();

    for (const feat of features) {
      if (!featureContainsPoint(feat, lat, lng)) continue;
      insideAny = true;
      const props = feat.properties;
      const code = Number(props["A33_001"]);
      const zone = Number(props["A33_002"]);
      if (zone === 2) hasSpecial = true;
      const label = PHENOMENA_LABELS[code];
      if (label) phenomenaSet.add(label);
    }

    return {
      inside: insideAny,
      special: hasSpecial,
      phenomena: Array.from(phenomenaSet),
    };
  } catch {
    return null;
  }
}

// ── XKT022: 急傾斜地崩壊危険区域 ────────────────────────────────────────────

async function _fetchSteepSlopeZone(
  lat: number,
  lng: number
): Promise<boolean | null> {
  try {
    const { x, y } = latLngToTile(lat, lng, 15);
    const features = await fetchZoneGeoJson("XKT022", 15, x, y);
    if (features.length === 0) return false;
    return features.some((f) => featureContainsPoint(f, lat, lng));
  } catch {
    return null;
  }
}

// ── XKT021: 地すべり防止区域 ────────────────────────────────────────────────

async function _fetchLandslideZone(
  lat: number,
  lng: number
): Promise<boolean | null> {
  try {
    const { x, y } = latLngToTile(lat, lng, 15);
    const features = await fetchZoneGeoJson("XKT021", 15, x, y);
    if (features.length === 0) return false;
    return features.some((f) => featureContainsPoint(f, lat, lng));
  } catch {
    return null;
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

const r4 = (v: number) => Math.round(v * 10000) / 10000;

const _fetchWarningZoneCached = unstable_cache(
  _fetchWarningZone,
  ["sediment-warning-zone"],
  { revalidate: 90 * 24 * 3600, tags: ["sediment"] }
);

const _fetchSteepSlopeCached = unstable_cache(
  _fetchSteepSlopeZone,
  ["sediment-steep-slope"],
  { revalidate: 90 * 24 * 3600, tags: ["sediment"] }
);

const _fetchLandslideCached = unstable_cache(
  _fetchLandslideZone,
  ["sediment-landslide"],
  { revalidate: 90 * 24 * 3600, tags: ["sediment"] }
);

/**
 * 土砂災害・急傾斜地・地すべり防止の3区域を並列取得。
 * 取得失敗時は各フィールドを null で返す。
 * 1分析あたり最大3コール。
 */
export async function fetchSedimentData(
  lat: number,
  lng: number
): Promise<SedimentData> {
  const [warningResult, steepResult, landslideResult] = await Promise.allSettled([
    _fetchWarningZoneCached(r4(lat), r4(lng)),
    _fetchSteepSlopeCached(r4(lat), r4(lng)),
    _fetchLandslideCached(r4(lat), r4(lng)),
  ]);

  return {
    warningZone:   warningResult.status   === "fulfilled" ? warningResult.value   : null,
    steepSlopeZone: steepResult.status    === "fulfilled" ? steepResult.value     : null,
    landslideZone:  landslideResult.status === "fulfilled" ? landslideResult.value : null,
  };
}
