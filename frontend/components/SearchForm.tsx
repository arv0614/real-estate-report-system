"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { geocodeAddress } from "@/lib/geocode";

const MapPicker = dynamic(
  () => import("./MapPicker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 rounded-lg border border-slate-200 bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-sm">
        地図を読み込み中...
      </div>
    ),
  }
);

const QUICK_LINKS = [
  { label: "葛飾区", lat: 35.74, lng: 139.86 },
  { label: "渋谷区", lat: 35.661, lng: 139.703 },
  { label: "新宿区", lat: 35.693, lng: 139.703 },
] as const;

export interface DistrictMarker {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  onSearch: (lat: number, lng: number) => void;
  loading: boolean;
  districtMarkers?: DistrictMarker[];
  isLoggedIn?: boolean;
  /** 履歴クリック時などに外部から座標を注入するときに使う */
  externalCoords?: { lat: number; lng: number };
  /** 検索結果表示中に地図を折りたたむ（重複表示防止） */
  collapseMap?: boolean;
}

export function SearchForm({ onSearch, loading, districtMarkers, isLoggedIn = false, externalCoords, collapseMap = false }: Props) {
  const [lat, setLat] = useState("35.7101");
  const [lng, setLng] = useState("139.8107");
  const [validationError, setValidationError] = useState<string | null>(null);

  // 履歴クリック等で外部から座標が届いたら入力欄・マップに反映する
  useEffect(() => {
    if (externalCoords == null) return;
    setLat(String(externalCoords.lat));
    setLng(String(externalCoords.lng));
    setValidationError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCoords?.lat, externalCoords?.lng]);

  // 検索結果が表示されたら地図を折りたたむ（ReportMapと重複表示防止）
  useEffect(() => {
    if (collapseMap) setShowMap(false);
  }, [collapseMap]);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const mapLat = parseFloat(lat);
  const mapLng = parseFloat(lng);
  const mapReady = !isNaN(mapLat) && !isNaN(mapLng);

  function applyCoords(newLat: number, newLng: number) {
    setLat(String(newLat));
    setLng(String(newLng));
    setValidationError(null);
  }

  async function handleAddressSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!addressQuery.trim()) return;
    setAddressLoading(true);
    try {
      const result = await geocodeAddress(addressQuery);
      if (result) {
        applyCoords(
          Math.round(result.lat * 1e6) / 1e6,
          Math.round(result.lng * 1e6) / 1e6
        );
      } else {
        setValidationError("住所が見つかりませんでした。別のキーワードで試してください。");
      }
    } catch {
      setValidationError("住所検索中にエラーが発生しました。");
    } finally {
      setAddressLoading(false);
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setValidationError("このブラウザは現在地取得に対応していません。");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(
          Math.round(pos.coords.latitude * 1e6) / 1e6,
          Math.round(pos.coords.longitude * 1e6) / 1e6
        );
        setGeoLoading(false);
      },
      () => {
        setValidationError("現在地の取得に失敗しました。ブラウザの位置情報許可を確認してください。");
        setGeoLoading(false);
      }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || latNum < 24 || latNum > 46) {
      setValidationError("緯度は 24〜46 の数値で入力してください（日本国内）");
      return;
    }
    if (isNaN(lngNum) || lngNum < 122 || lngNum > 154) {
      setValidationError("経度は 122〜154 の数値で入力してください（日本国内）");
      return;
    }
    setValidationError(null);
    onSearch(latNum, lngNum);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">調査エリアの座標を入力</CardTitle>
        <CardDescription className="text-xs">
          地図をクリック・住所検索・現在地取得で座標を指定できます
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 住所検索 */}
        <form onSubmit={handleAddressSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="住所・地名で検索（例：東京都墨田区押上）"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={addressLoading || !addressQuery.trim()}
            className="shrink-0"
          >
            {addressLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              "📍 検索"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={geoLoading}
            onClick={handleGeolocate}
            className="shrink-0"
            title="現在地を取得"
          >
            {geoLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              "🎯 現在地"
            )}
          </Button>
        </form>

        {/* 地図 */}
        <div>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="text-xs text-blue-600 hover:underline mb-2 block"
          >
            {showMap ? "▲ 地図を非表示" : "▼ 地図を表示"}
          </button>
          {showMap && mapReady && (
            <MapPicker lat={mapLat} lng={mapLng} onChange={applyCoords} districtMarkers={districtMarkers} />
          )}
        </div>

        {/* 座標入力 + 診断ボタン */}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat" className="text-xs text-slate-600">
              緯度（Latitude）
            </Label>
            <Input
              id="lat"
              type="number"
              step="0.000001"
              placeholder="例: 35.7101"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-40"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lng" className="text-xs text-slate-600">
              経度（Longitude）
            </Label>
            <Input
              id="lng"
              type="number"
              step="0.000001"
              placeholder="例: 139.8107"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-40"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                取得中...
              </>
            ) : (
              "🔍 調査開始"
            )}
          </Button>

          <div className="flex gap-2 ml-auto flex-wrap">
            {QUICK_LINKS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyCoords(p.lat, p.lng)}
                className="text-xs text-blue-600 hover:underline px-2 py-1 rounded border border-blue-100 hover:bg-blue-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>

        {validationError && (
          <p className="text-xs text-red-600">{validationError}</p>
        )}

      </CardContent>
    </Card>
  );
}
