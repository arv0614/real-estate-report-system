"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
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
        attribution='© <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
        url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
      />
      <MapController lat={lat} lng={lng} />
      {!readOnly && <ClickHandler onChange={onChange} />}
      <Marker position={[lat, lng]} />

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
