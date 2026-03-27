"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  onSearch: (lat: number, lng: number) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: Props) {
  const [lat, setLat] = useState("35.74");
  const [lng, setLng] = useState("139.86");
  const [validationError, setValidationError] = useState<string | null>(null);

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
        <CardTitle className="text-base">診断する物件の座標を入力</CardTitle>
        <CardDescription className="text-xs">
          Google マップ等で対象地点を右クリックすると緯度・経度をコピーできます
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat" className="text-xs text-slate-600">
              緯度（Latitude）
            </Label>
            <Input
              id="lat"
              type="number"
              step="0.0001"
              placeholder="例: 35.74"
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
              step="0.0001"
              placeholder="例: 139.86"
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
              "🔍 診断開始"
            )}
          </Button>

          {/* クイックリンク */}
          <div className="flex gap-2 ml-auto flex-wrap">
            {[
              { label: "葛飾区", lat: 35.74, lng: 139.86 },
              { label: "渋谷区", lat: 35.661, lng: 139.703 },
              { label: "新宿区", lat: 35.693, lng: 139.703 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setLat(p.lat.toString());
                  setLng(p.lng.toString());
                }}
                className="text-xs text-blue-600 hover:underline px-2 py-1 rounded border border-blue-100 hover:bg-blue-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>

        {validationError && (
          <p className="mt-2 text-xs text-red-600">{validationError}</p>
        )}
      </CardContent>
    </Card>
  );
}
