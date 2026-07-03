/**
 * 国土地理院 標高タイル (dem/dem5a/dem5b) を使った地形解析
 * 出典明示必須: 「国土地理院 標高タイルを加工して算出」
 * タイル仕様: https://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt
 *   z=14, カンマ区切りテキスト, 無効値 "e", 404時 dem5a→dem5b の順でフォールバック
 */

import { unstable_cache } from "next/cache";
import { latLngToTile } from "./geo";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlopeClass = "gentle" | "moderate" | "steep" | "very_steep";
export type AspectLabel = "北" | "北東" | "東" | "南東" | "南" | "南西" | "西" | "北西" | "ほぼ平坦";

export interface SolarTerrainCheck {
  /** slopeDeg <= 15 */
  slopeOk: boolean | null;
  /** aspectLabel が南/南東/南西、または slope<3 */
  aspectOk: boolean | null;
  /** elevation <= 800m */
  elevationOk: boolean | null;
  metCount: number;
  totalCount: number;
}

export interface ForestTerrainData {
  slopeDeg: number | null;
  slopeClass: SlopeClass | null;
  aspectDeg: number | null;
  aspectLabel: AspectLabel | null;
  elevation: number | null;
  solarTerrain: SolarTerrainCheck | null;
  sourceNote: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ZOOM = 14;
const TILE_SIZE = 256;
// z=14 tile pixel resolution at ~35°N latitude: ≈ 9.5 m/pixel (base)
const BASE_PIXEL_M = 9.5544;

// ── Tile fetch ────────────────────────────────────────────────────────────────

/** Fetch a DEM tile as 256×256 number[][] (null for invalid/edge pixels) */
async function fetchDemTile(
  x: number,
  y: number
): Promise<(number | null)[][] | null> {
  for (const layer of ["dem", "dem5a", "dem5b"]) {
    try {
      const res = await fetch(
        `https://cyberjapandata.gsi.go.jp/xyz/${layer}/${ZOOM}/${x}/${y}.txt`,
        { next: { revalidate: 31_536_000 }, signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) continue;
      const text = await res.text();
      const rows = text.trim().split("\n").map((row) =>
        row.split(",").map((v) => {
          const t = v.trim();
          return t === "e" || t === "" ? null : parseFloat(t);
        })
      );
      if (rows.length !== TILE_SIZE) continue;
      return rows;
    } catch {
      continue;
    }
  }
  return null;
}

/** Get pixel from cache or fetch */
const tileCache = new Map<string, (number | null)[][] | null>();
async function getTile(x: number, y: number): Promise<(number | null)[][] | null> {
  const key = `${x},${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  const tile = await fetchDemTile(x, y);
  tileCache.set(key, tile);
  return tile;
}

/** Get elevation at specific tile pixel, fetching adjacent tile if needed */
async function getElevation(
  baseTile: { x: number; y: number },
  px: number,
  py: number,
  tileData: (number | null)[][] | null
): Promise<number | null> {
  // If within current tile
  if (px >= 0 && px < TILE_SIZE && py >= 0 && py < TILE_SIZE) {
    return tileData?.[py]?.[px] ?? null;
  }
  // Out of bounds — fetch adjacent tile
  const adjX = baseTile.x + Math.floor(px / TILE_SIZE);
  const adjY = baseTile.y + Math.floor(py / TILE_SIZE);
  const localPx = ((px % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  const localPy = ((py % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  const adjTile = await getTile(adjX, adjY);
  return adjTile?.[localPy]?.[localPx] ?? null;
}

// ── Slope calculation ─────────────────────────────────────────────────────────

function slopeClass(deg: number): SlopeClass {
  if (deg < 10) return "gentle";
  if (deg < 20) return "moderate";
  if (deg < 30) return "steep";
  return "very_steep";
}

function aspectLabel(deg: number, slopeDeg: number): AspectLabel {
  if (slopeDeg < 3) return "ほぼ平坦";
  // 0=North, clockwise
  const d = ((deg % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return "北";
  if (d < 67.5)  return "北東";
  if (d < 112.5) return "東";
  if (d < 157.5) return "南東";
  if (d < 202.5) return "南";
  if (d < 247.5) return "南西";
  if (d < 292.5) return "西";
  return "北西";
}

// ── Main fetch function ───────────────────────────────────────────────────────

async function _fetchForestTerrain(
  lat: number,
  lng: number
): Promise<ForestTerrainData | null> {
  tileCache.clear(); // reset per-invocation cache

  const { x: tx, y: ty } = latLngToTile(lat, lng, ZOOM);

  // Pixel position of the target point within the tile
  const n = Math.pow(2, ZOOM);
  const fracX = (lng + 180) / 360 * n - tx;
  const latRad = lat * Math.PI / 180;
  const mercY = Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI;
  const fracY = (1 - mercY) / 2 * n - ty;
  const px = Math.floor(fracX * TILE_SIZE);
  const py = Math.floor(fracY * TILE_SIZE);

  const tile = await getTile(tx, ty);
  if (!tile) return null;

  // Latitude correction for pixel size (cos compensation)
  const latCos = Math.cos(lat * Math.PI / 180);
  const pixelM = BASE_PIXEL_M / latCos; // E-W pixel size grows near equator
  const pixelMns = BASE_PIXEL_M;        // N-S is constant

  // Central difference of 3x3 neighborhood for gradient
  const [e_w, w_w, n_h, s_h] = await Promise.all([
    getElevation({ x: tx, y: ty }, px + 1, py,     tile),
    getElevation({ x: tx, y: ty }, px - 1, py,     tile),
    getElevation({ x: tx, y: ty }, px,     py - 1, tile),
    getElevation({ x: tx, y: ty }, px,     py + 1, tile),
  ]);

  const center = tile[py]?.[px] ?? null;

  // Slope calculation requires all 4 neighbors
  let slopeDeg: number | null = null;
  let aspectDeg: number | null = null;
  if (e_w !== null && w_w !== null && n_h !== null && s_h !== null) {
    const dzdx = (e_w - w_w) / (2 * pixelM);
    const dzdy = (s_h - n_h) / (2 * pixelMns); // positive = south downhill
    const grad = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
    slopeDeg = Math.round(Math.atan(grad) * 180 / Math.PI * 10) / 10;

    // atan2: 0=E, CCW. Convert to N=0, CW (compass bearing)
    const aspectRad = Math.atan2(-dzdy, dzdx); // azimuth from E CCW
    let bearing = 90 - (aspectRad * 180 / Math.PI);  // to N=0 CW
    if (bearing < 0) bearing += 360;
    aspectDeg = Math.round(bearing);
  }

  const aLabel = slopeDeg !== null && aspectDeg !== null
    ? aspectLabel(aspectDeg, slopeDeg)
    : null;
  const sc = slopeDeg !== null ? slopeClass(slopeDeg) : null;

  // Solar terrain: 3 conditions
  const SOUTH_ASPECTS: AspectLabel[] = ["南", "南東", "南西", "ほぼ平坦"];
  const slopeOk = slopeDeg !== null ? slopeDeg <= 15 : null;
  const aspectOk = aLabel !== null ? SOUTH_ASPECTS.includes(aLabel) : null;
  const elevationOk = center !== null ? center <= 800 : null;

  const checks = [slopeOk, aspectOk, elevationOk];
  const metCount = checks.filter((c) => c === true).length;
  const totalCount = checks.filter((c) => c !== null).length;

  const solarTerrain: SolarTerrainCheck = {
    slopeOk,
    aspectOk,
    elevationOk,
    metCount,
    totalCount,
  };

  return {
    slopeDeg,
    slopeClass: sc,
    aspectDeg,
    aspectLabel: aLabel,
    elevation: center,
    solarTerrain,
    sourceNote: "国土地理院 標高タイルを加工して算出",
  };
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

const _fetchForestTerrainCached = unstable_cache(
  _fetchForestTerrain,
  ["forest-terrain"],
  { revalidate: 31_536_000, tags: ["forest-terrain"] }
);

export function fetchForestTerrain(
  lat: number,
  lng: number
): Promise<ForestTerrainData | null> {
  return _fetchForestTerrainCached(r4(lat), r4(lng));
}
