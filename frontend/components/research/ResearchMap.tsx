"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lng: number;
  /** Called when user drags the marker to a new position */
  onChange?: (lat: number, lng: number) => void;
}

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.4 });
  }, [lat, lng, map]);
  return null;
}

function DraggableMarker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange?: (lat: number, lng: number) => void;
}) {
  // react-leaflet v5: use eventHandlers on Marker
  return (
    <Marker
      position={[lat, lng]}
      draggable={!!onChange}
      eventHandlers={
        onChange
          ? {
              dragend(e) {
                const { lat: newLat, lng: newLng } = (e.target as L.Marker).getLatLng();
                onChange(
                  Math.round(newLat * 1e6) / 1e6,
                  Math.round(newLng * 1e6) / 1e6
                );
              },
            }
          : undefined
      }
    />
  );
}

// Dummy to satisfy lint for unused import above (L namespace used in event handler)
declare const L: { Marker: { prototype: { getLatLng: () => { lat: number; lng: number } } } };

export function ResearchMap({ lat, lng, onChange }: Props) {
  return (
    <div style={{ isolation: "isolate" }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ height: "var(--research-map-h, 280px)", width: "100%" }}
        className="rounded-xl border border-slate-200"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='地図データ © <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
          url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
          maxZoom={18}
        />
        <MapController lat={lat} lng={lng} />
        <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
