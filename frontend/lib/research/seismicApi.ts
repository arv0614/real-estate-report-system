/**
 * Seismic & terrain risk data
 *  - J-SHIS (地震ハザードステーション): 30-year probability of 震度6弱+
 *  - GSI (国土地理院): elevation + terrain classification (地形分類)
 *
 * Both APIs are public / no auth required.
 */

export interface SeismicData {
  /** Probability 0-1 */
  prob30: number;
  /** Rounded percentage for display (0-100) */
  probPct: number;
  riskLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  riskLabel: string;
}

export interface TerrainData {
  /** Elevation in meters (null = unavailable) */
  elevation: number | null;
  elevSource: string;
  /** Terrain classification name (e.g. "後背湿地") – null if tile not found */
  terrainClass: string | null;
  terrainRisk: "low" | "moderate" | "high";
  /** Human-readable risk note */
  riskNote: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function seismicRiskLevel(prob: number): SeismicData["riskLevel"] {
  if (prob < 0.03) return "very_low";
  if (prob < 0.06) return "low";
  if (prob < 0.20) return "moderate";
  if (prob < 0.50) return "high";
  return "very_high";
}

const RISK_LABELS: Record<SeismicData["riskLevel"], string> = {
  very_low: "非常に低い",
  low:      "低い",
  moderate: "中程度",
  high:     "高い",
  very_high:"非常に高い",
};

/** WGS84 lat/lng → standard tile coordinates */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  );
  return { x, y };
}

/** Ray-casting point-in-polygon (GeoJSON ring uses [lng, lat]) */
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

type GeoCoords = [number, number];
type Ring = GeoCoords[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

function featureContainsPoint(
  geomType: string,
  coords: unknown,
  lat: number,
  lng: number
): boolean {
  if (geomType === "Polygon") {
    return pointInRing(lat, lng, (coords as Polygon)[0]);
  }
  if (geomType === "MultiPolygon") {
    return (coords as MultiPolygon).some((poly) => pointInRing(lat, lng, poly[0]));
  }
  return false;
}

/** Terrain class names that carry high liquefaction / flood risk */
const HIGH_RISK_TERRAIN = new Set([
  "後背湿地", "旧河道", "三角州", "干拓地・埋立地", "谷底低地",
  "水部", "低湿地", "内水面", "海", "干潟", "砂丘・砂州",
]);
const MEDIUM_RISK_TERRAIN = new Set([
  "自然堤防", "扇状地", "低地", "氾濫平野", "砂礫質台地",
]);

function classifyTerrainRisk(cls: string | null): TerrainData["terrainRisk"] {
  if (!cls) return "moderate";
  if (HIGH_RISK_TERRAIN.has(cls)) return "high";
  if (MEDIUM_RISK_TERRAIN.has(cls)) return "moderate";
  return "low";
}

function buildRiskNote(cls: string | null, elev: number | null): string {
  if (cls) {
    if (HIGH_RISK_TERRAIN.has(cls))
      return `${cls}に位置。液状化・浸水リスクが高い地形です。`;
    if (MEDIUM_RISK_TERRAIN.has(cls))
      return `${cls}に位置。一定の水害リスクがある地形です。`;
    return `${cls}に位置。比較的安定した地形です。`;
  }
  if (elev !== null) {
    if (elev < 2)  return `標高 ${elev}m — 非常に低地で浸水・液状化リスクに要注意。`;
    if (elev < 5)  return `標高 ${elev}m — 低地。洪水・液状化リスクを確認してください。`;
    if (elev < 20) return `標高 ${elev}m — 平坦地。ハザードマップで詳細確認推奨。`;
    return `標高 ${elev}m — 比較的高い地点。地形上の浸水リスクは低いと推定されます。`;
  }
  return "地形情報を取得できませんでした。";
}

// ── Public fetch functions ───────────────────────────────────────────────────

/**
 * J-SHIS: 30-year probability of 震度6弱 (seismic intensity ≥ 6-) at point.
 * API: https://www.j-shis.bosai.go.jp/map/api/pshm/Y2024/AVR/TTL_MTTL/meshinfo.geojson
 * Note: position parameter is {lng},{lat} (longitude first).
 */
export async function fetchSeismicData(
  lat: number,
  lng: number
): Promise<SeismicData | null> {
  try {
    const url =
      `https://www.j-shis.bosai.go.jp/map/api/pshm/Y2024/AVR/TTL_MTTL/meshinfo.geojson` +
      `?position=${lng},${lat}&epsg=4326&attr=T30_I60_PS`;

    const res = await fetch(url, {
      next: { revalidate: 30 * 24 * 3600 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const props = data.features?.[0]?.properties;
    if (!props) return null;

    const raw = props.T30_I60_PS ?? props.T30_I55_PS;
    const prob = typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : NaN;
    if (isNaN(prob)) return null;

    const riskLevel = seismicRiskLevel(prob);
    return {
      prob30: prob,
      probPct: Math.round(prob * 100),
      riskLevel,
      riskLabel: RISK_LABELS[riskLevel],
    };
  } catch {
    return null;
  }
}

/**
 * GSI: Elevation (標高) + terrain classification (地形分類).
 * Elevation: cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php
 * Terrain: experimental_landformclassification1 tile (zoom 14)
 */
export async function fetchTerrainData(
  lat: number,
  lng: number
): Promise<TerrainData | null> {
  try {
    const { x, y } = latLngToTile(lat, lng, 14);

    const [elevResult, tileResult] = await Promise.allSettled([
      fetch(
        `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php` +
          `?lon=${lng}&lat=${lat}&outtype=JSON`,
        { next: { revalidate: 30 * 24 * 3600 }, signal: AbortSignal.timeout(6000) }
      ),
      fetch(
        `https://cyberjapandata.gsi.go.jp/xyz/experimental_landformclassification1/14/${x}/${y}.geojson`,
        { next: { revalidate: 30 * 24 * 3600 }, signal: AbortSignal.timeout(10000) }
      ),
    ]);

    let elevation: number | null = null;
    let elevSource = "";
    if (elevResult.status === "fulfilled" && elevResult.value.ok) {
      const d = await elevResult.value.json();
      elevation = typeof d.elevation === "number" ? Math.round(d.elevation * 10) / 10 : null;
      elevSource = typeof d.hsrc === "string" ? d.hsrc : "";
    }

    let terrainClass: string | null = null;
    if (tileResult.status === "fulfilled" && tileResult.value.ok) {
      const geojson = await tileResult.value.json();
      for (const feat of geojson.features ?? []) {
        const { type, coordinates } = feat.geometry ?? {};
        if (featureContainsPoint(type, coordinates, lat, lng)) {
          terrainClass =
            feat.properties?.C ??
            feat.properties?.class ??
            feat.properties?.name ??
            null;
          break;
        }
      }
    }

    const terrainRisk = classifyTerrainRisk(terrainClass);
    const riskNote = buildRiskNote(terrainClass, elevation);

    return { elevation, elevSource, terrainClass, terrainRisk, riskNote };
  } catch {
    return null;
  }
}
