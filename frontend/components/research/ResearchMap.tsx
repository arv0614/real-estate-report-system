"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";

// ── MapController: smooth fly-to on coord change ──────────────────────────────
function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.4 });
  }, [lat, lng, map]);
  return null;
}

// ── DraggableMarker ───────────────────────────────────────────────────────────
function DraggableMarker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange?: (lat: number, lng: number) => void;
}) {
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

declare const L: { Marker: { prototype: { getLatLng: () => { lat: number; lng: number } } } };

// ── MoveEndListener: fires onCenter when map is panned/zoomed ─────────────────
function MoveEndListener({ onCenter }: { onCenter: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onCenter(Math.round(c.lat * 1e6) / 1e6, Math.round(c.lng * 1e6) / 1e6);
    },
  });
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  lat: number;
  lng: number;
  /** "pin" (default): draggable marker, fires onChange on drag. */
  mode?: "pin";
  /** Called when user drags the marker (pin mode) */
  onChange?: (lat: number, lng: number) => void;
}

interface ExploreProps {
  lat: number;
  lng: number;
  /** "explore": no marker, crosshair reticle, fires onCenter on map move. */
  mode: "explore";
  onCenter?: (lat: number, lng: number) => void;
}

// ── ResearchMap ───────────────────────────────────────────────────────────────
export function ResearchMap(props: Props | ExploreProps) {
  const isExplore = props.mode === "explore";

  return (
    <div style={{ isolation: "isolate", position: "relative" }}>
      <MapContainer
        center={[props.lat, props.lng]}
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
        <MapController lat={props.lat} lng={props.lng} />
        {isExplore ? (
          (props as ExploreProps).onCenter && (
            <MoveEndListener onCenter={(props as ExploreProps).onCenter!} />
          )
        ) : (
          <DraggableMarker
            lat={props.lat}
            lng={props.lng}
            onChange={(props as Props).onChange}
          />
        )}
      </MapContainer>

      {/* Crosshair reticle for explore mode */}
      {isExplore && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 400 }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="6" stroke="#2563eb" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="10" stroke="#2563eb" strokeWidth="2" />
            <line x1="16" y1="22" x2="16" y2="30" stroke="#2563eb" strokeWidth="2" />
            <line x1="2" y1="16" x2="10" y2="16" stroke="#2563eb" strokeWidth="2" />
            <line x1="22" y1="16" x2="30" y2="16" stroke="#2563eb" strokeWidth="2" />
          </svg>
        </div>
      )}
    </div>
  );
}
