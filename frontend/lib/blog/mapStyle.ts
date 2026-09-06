/**
 * MapLibre GL JS — ベースマップスタイル定義
 *
 * CARTO Positron（明色・モノトーン系のベクタースタイル）を採用。
 * APIキー不要・商用利用可（CARTO Basemaps: https://github.com/CartoDB/basemap-styles）。
 * 以前は彩度の高い生の OpenStreetMap ラスタータイルを直接使っており「モックアップっぽい」
 * 印象が強かったため、SaaS プロダクトらしい落ち着いた配色のベクタースタイルに切り替えた
 * （2026-09-06）。ダークモードを持つ画面を追加する場合は同じ CARTO の Dark Matter
 * (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`) に差し替える。
 *
 * `maplibregl.Map({ style })` は URL 文字列も渡せるため、この1行を渡すだけで
 * ベクタータイル・スプライト・グリフの解決まですべて CARTO 側の style.json が担う。
 *
 * NOTE: 大量アクセスを想定する規模になった場合は CARTO の利用規約・レート制限を確認し、
 * 必要であれば有料プランや自前ホスティングへの切り替えを検討すること。
 */
export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
