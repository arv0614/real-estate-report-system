"use client";

import { useState } from "react";
import { MapPin, Check, AlertCircle, Loader2 } from "lucide-react";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";

const PREF_MAP: Record<string, string> = {
  "01":"北海道","02":"青森県","03":"岩手県","04":"宮城県","05":"秋田県",
  "06":"山形県","07":"福島県","08":"茨城県","09":"栃木県","10":"群馬県",
  "11":"埼玉県","12":"千葉県","13":"東京都","14":"神奈川県","15":"新潟県",
  "16":"富山県","17":"石川県","18":"福井県","19":"山梨県","20":"長野県",
  "21":"岐阜県","22":"静岡県","23":"愛知県","24":"三重県","25":"滋賀県",
  "26":"京都府","27":"大阪府","28":"兵庫県","29":"奈良県","30":"和歌山県",
  "31":"鳥取県","32":"島根県","33":"岡山県","34":"広島県","35":"山口県",
  "36":"徳島県","37":"香川県","38":"愛媛県","39":"高知県","40":"福岡県",
  "41":"佐賀県","42":"長崎県","43":"熊本県","44":"大分県","45":"宮崎県",
  "46":"鹿児島県","47":"沖縄県",
};

async function reverseGeocodeToAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lon=${lng}&lat=${lat}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const { muniCd, muniNm, lv01Nm } = (data?.results ?? {}) as Record<string, string>;
    if (!muniNm && !lv01Nm) return null;
    const prefCode = String(muniCd ?? "").padStart(5, "0").slice(0, 2);
    const prefecture = PREF_MAP[prefCode] ?? "";
    return `${prefecture}${muniNm ?? ""}${lv01Nm ?? ""}`.trim() || null;
  } catch {
    return null;
  }
}

type Status = "idle" | "loading" | "preview" | "error";

interface Props {
  onParsed: (data: ParsedPropertyData) => void;
  isEn: boolean;
}

export function LocationInput({ onParsed, isEn }: Props) {
  const [status,  setStatus]  = useState<Status>("idle");
  const [preview, setPreview] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  const isHttps =
    typeof window === "undefined" ||
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost";

  const t = {
    title:     isEn ? "Auto-fill from current location" : "現在地から自動入力",
    getBtn:    isEn ? "📍 Get current location" : "📍 現在地を取得",
    loading:   isEn ? "Getting location…" : "現在地を取得中…",
    apply:     isEn ? "Apply to form" : "この内容で入力",
    discard:   isEn ? "Discard" : "破棄",
    httpsWarn: isEn ? "Location requires HTTPS" : "位置情報の取得にはHTTPS接続が必要です",
    gotAddr:   isEn ? "Address obtained from location" : "住所のみ取得できました",
    errDenied: isEn ? "Location permission denied. Please enter your address manually." : "ブラウザの位置情報が許可されていません。設定を確認するか、住所を手動で入力してください。",
    errTimeout:isEn ? "Could not get location (timeout)." : "位置情報を取得できませんでした（タイムアウト）。",
    errGeneric:isEn ? "Failed to get current location." : "現在地を取得できませんでした。",
    errNoAddr: isEn ? "Could not convert location to an address." : "座標から住所を取得できませんでした。",
  };

  const handleGetLocation = () => {
    if (!isHttps) return;
    setStatus("loading");
    setErrMsg(null);
    setPreview(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const address = await reverseGeocodeToAddress(lat, lng);
        if (!address) { setStatus("error"); setErrMsg(t.errNoAddr); return; }
        setPreview({ address, lat, lng });
        setStatus("preview");
      },
      (err) => {
        let msg = t.errGeneric;
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) msg = t.errDenied;
        if (err.code === GeolocationPositionError.TIMEOUT) msg = t.errTimeout;
        setStatus("error");
        setErrMsg(msg);
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const handleApply = () => {
    if (!preview) return;
    onParsed({ address: preview.address, coordOverride: { lat: preview.lat, lng: preview.lng } });
    setPreview(null);
    setStatus("idle");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <MapPin className="w-3.5 h-3.5" />
        {t.title}
      </div>

      {status !== "preview" && (
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={status === "loading" || !isHttps}
          title={!isHttps ? t.httpsWarn : undefined}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "loading"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <MapPin className="w-4 h-4 text-slate-400" />}
          {status === "loading" ? t.loading : t.getBtn}
        </button>
      )}

      {status === "error" && errMsg && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{errMsg}</p>
        </div>
      )}

      {status === "preview" && preview && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
          <p className="text-xs text-blue-600 font-semibold">{t.gotAddr}</p>
          <div className="flex items-center gap-2 text-xs">
            <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-slate-500 w-16 flex-shrink-0">{isEn ? "Address" : "住所"}</span>
            <span className="font-medium text-slate-800">{preview.address}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleApply}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
              {t.apply}
            </button>
            <button type="button" onClick={() => { setPreview(null); setStatus("idle"); }}
              className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
              {t.discard}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
