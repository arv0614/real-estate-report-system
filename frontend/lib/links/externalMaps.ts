export function buildHazardMapUrl(lat: number, lng: number): string {
  return `https://disaportal.gsi.go.jp/maps/index.html?ll=${lat},${lng}&z=16&base=pale&vs=c1j0l0u0t0h0z0`;
}

export function buildJShisUrl(lat: number, lng: number): string {
  return `https://www.j-shis.bosai.go.jp/map/?ll=${lat},${lng}&z=13`;
}

export function buildGsiLandformUrl(lat: number, lng: number): string {
  return `https://maps.gsi.go.jp/#16/${lat}/${lng}/&base=std&ls=std%7Clcmfc2&disp=11&lcd=lcmfc2`;
}
