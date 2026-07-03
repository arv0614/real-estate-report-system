import { Hono } from "hono";
import { z } from "zod";
import { readGcsObject } from "../services/gcsCache";

const app = new Hono();

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    // GeoJSON coordinates: [lng, lat] per vertex
    coordinates: number[][][] | number[][][][];
  } | null;
  properties: Record<string, unknown> | null;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  refYear?: string;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

// Ray-casting. Ring is GeoJSON format: [[lng, lat], ...].
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const lngI = ring[i][0], latI = ring[i][1];
    const lngJ = ring[j][0], latJ = ring[j][1];
    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isInside(lat: number, lng: number, feature: GeoJSONFeature): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  if (geom.type === "Polygon") {
    return pointInRing(lat, lng, (geom.coordinates as number[][][])[0]);
  }
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as number[][][][]).some((poly) =>
      pointInRing(lat, lng, poly[0])
    );
  }
  return false;
}

// ── Prefecture code resolution ─────────────────────────────────────────────────

function prefCodeFromCityCode(cityCode: string): string {
  return cityCode.substring(0, 2).padStart(2, "0");
}

// Falls back to GSI reverse geocoder when cityCode is not supplied.
async function prefCodeFromGSI(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: { muniCd?: string } };
    const muniCd = body.results?.muniCd;
    if (!muniCd || muniCd.length < 2) return null;
    return muniCd.substring(0, 2).padStart(2, "0");
  } catch {
    return null;
  }
}

// ── GCS helpers ────────────────────────────────────────────────────────────────

// Path convention: hoanrin/pref{2-digit}.geojson
function hoanrinGcsPath(prefCode: string): string {
  return `hoanrin/pref${prefCode}.geojson`;
}

async function loadHoanrinGeoJSON(prefCode: string): Promise<FeatureCollection | null> {
  const raw = await readGcsObject(hoanrinGcsPath(prefCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FeatureCollection;
  } catch {
    console.error(`[hoanrin] GeoJSON parse error for pref ${prefCode}`);
    return null;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const querySchema = z.object({
  lat: z.coerce.number().min(24).max(46),
  lng: z.coerce.number().min(122).max(154),
  cityCode: z.string().regex(/^\d{5}$/).optional(),
});

app.get("/hoanrin", async (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }

  const { lat, lng, cityCode } = parsed.data;

  // Resolve prefecture code
  const prefCode = cityCode
    ? prefCodeFromCityCode(cityCode)
    : await prefCodeFromGSI(lat, lng);

  if (!prefCode) {
    console.warn(`[hoanrin] Could not determine prefCode for (${lat}, ${lng})`);
    return c.json({ status: "unknown", refYear: "2024" });
  }

  // Load GeoJSON from GCS
  const fc = await loadHoanrinGeoJSON(prefCode);
  if (!fc) {
    // GCS data not yet uploaded or bucket not configured — return unknown gracefully
    console.log(`[hoanrin] No GCS data for pref ${prefCode} — returning unknown`);
    return c.json({ status: "unknown", refYear: "2024" });
  }

  const refYear = fc.refYear ?? "2024";
  const inside = fc.features.some((f) => isInside(lat, lng, f));

  return c.json({ status: inside ? "inside" : "outside", refYear });
});

export default app;
