"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { DistrictMarker } from "./SearchForm";

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  districtMarkers?: DistrictMarker[];
  /** true のとき地図クリックによる座標変更を無効化する（レポート表示用） */
  readOnly?: boolean;
}

/**
 * 選択中の座標を示すカスタムピン。Leaflet 既定のティアドロップ画像は使わず、
 * BlogMiniMap と同じ「テーマカラーのドット + 外側に広がるパルスリング」を
 * Tailwind クラスで表現する（2026-09-06、アプリ全体で地図デザインを統一）。
 * className を空にして Leaflet 既定の .leaflet-div-icon（白背景+枠線）を無効化している。
 */
const selectedPinIcon = L.divIcon({
  className: "",
  html: `
    <div class="relative flex items-center justify-center w-5 h-5">
      <span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping bg-teal-600"></span>
      <span class="relative inline-flex w-5 h-5 rounded-full border-2 border-white shadow-lg bg-teal-600"></span>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.4 });
  }, [lat, lng, map]);
  return null;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      const lat = Math.round(e.latlng.lat * 1e6) / 1e6;
      const lng = Math.round(e.latlng.lng * 1e6) / 1e6;
      onChange(lat, lng);
    },
  });
  return null;
}

export function MapPicker({ lat, lng, onChange, districtMarkers = [], readOnly = false }: Props) {
  return (
    // isolation: isolate でLeafletの z-index をこのコンテナ内に封じ込め、
    // モーダルの z-[9999] に確実に負けるようにする
    <div style={{ isolation: "isolate" }}>
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      style={{ height: "320px", width: "100%" }}
      className="rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        detectRetina
      />
      <MapController lat={lat} lng={lng} />
      {!readOnly && <ClickHandler onChange={onChange} />}
      <Marker position={[lat, lng]} icon={selectedPinIcon} />

      {districtMarkers.map((d) => (
        <CircleMarker
          key={d.name}
          center={[d.lat, d.lng]}
          radius={5}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.7,
            weight: 1.5,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]} className="text-xs font-medium">
            {d.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
    </div>
  );
}
