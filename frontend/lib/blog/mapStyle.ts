/**
 * MapLibre GL JS — ラスター OSM スタイル定義
 *
 * NOTE: OSM の公式タイルサーバーは小規模利用向け。
 * 商用大量アクセスを想定する規模になった場合は MapTiler、
 * Stadia Maps、Maptiler Cloud 等の有料サービスに切り替えること。
 * Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
 */
export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster" as const,
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};
