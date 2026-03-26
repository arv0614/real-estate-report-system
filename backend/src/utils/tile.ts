/**
 * 緯度経度 → スレイタイル座標変換ユーティリティ
 * キャッシュキーの生成に使用する
 */
export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number; z: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n
  );
  return { x, y, z: zoom };
}

/**
 * キャッシュキーを生成する
 * 形式: z{zoom}/x{x}/y{y}
 */
export function buildCacheKey(
  lat: number,
  lng: number,
  zoom: number = 15
): string {
  const { x, y, z } = latLngToTile(lat, lng, zoom);
  return `z${z}/x${x}/y${y}`;
}

/**
 * タイル座標 → 緯度経度（タイル左上の座標）
 */
export function tileToLatLng(
  x: number,
  y: number,
  z: number
): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}
