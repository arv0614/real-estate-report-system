"use client";

// Next.js のスタティックキャッシュを無効化（常にサーバーサイドレンダリング）
export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { fetchTransactions, calcSummary } from "@/lib/api";
import { exportToPdf } from "@/lib/exportPdf";
import { geocodeAddress, reverseGeocodeDistrict, matchDistrictName } from "@/lib/geocode";
import { saveSearchHistory } from "@/lib/history";
import { LifestyleImage } from "@/components/LifestyleImage";
import type { TransactionApiResponse } from "@/types/api";
import { SearchForm } from "@/components/SearchForm";
import type { DistrictMarker } from "@/components/SearchForm";
import { HistoryList } from "@/components/HistoryList";
import { SourceBadge } from "@/components/SourceBadge";
import { SummaryCards } from "@/components/SummaryCards";
import { TransactionTable } from "@/components/TransactionTable";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { EnvironmentInfoCard } from "@/components/EnvironmentInfo";
import { AiReport } from "@/components/AiReport";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransactionApiResponse | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [autoDistrict, setAutoDistrict] = useState<string>("");
  const [districtMarkers, setDistrictMarkers] = useState<DistrictMarker[]>([]);
  // 履歴クリック時に SearchForm の入力欄とマップを更新するための座標
  const [externalCoords, setExternalCoords] = useState<{ lat: number; lng: number } | undefined>();
  // 現在表示中の暮らしイメージ（Firestoreキャッシュ or 新規生成）
  const [lifestyleImage, setLifestyleImage] = useState<string | undefined>(undefined);

  async function handleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("ログインエラー:", e);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setResult(null);
  }

  async function handleSearch(lat: number, lng: number) {
    setLoading(true);
    setError(null);
    setResult(null);
    setAutoDistrict("");
    setDistrictMarkers([]);
    setLifestyleImage(undefined);
    try {
      const data = await fetchTransactions(lat, lng);
      setResult(data);

      // Firestore に検索履歴を保存（ログイン中のみ）
      if (user) {
        const rec = data.data.data[0];
        if (rec) {
          const s = calcSummary(data.data.data);
          saveSearchHistory(user.uid, {
            lat,
            lng,
            prefecture: rec.prefecture ?? "",
            municipality: rec.municipality ?? "",
            cityCode: data.data.cityCode,
            years: data.data.years,
            totalCount: s.totalCount,
            avgTradePrice: s.avgTradePrice,
            avgUnitPrice: s.avgUnitPrice ?? 0,
          }).catch(console.error);
        }
      }

      // ピンの地区名をリバースジオコーディングで特定し自動選択
      const uniqueDistricts = Array.from(
        new Set(data.data.data.map((r) => r.districtName).filter((d): d is string => !!d))
      );
      const gsiName = await reverseGeocodeDistrict(lat, lng);
      if (gsiName) {
        setAutoDistrict(matchDistrictName(gsiName, uniqueDistricts));
      }

      // 各地区をジオコーディングしてマップマーカーを生成（バックグラウンド）
      const firstRecord = data.data.data[0];
      if (firstRecord) {
        const prefix = `${firstRecord.prefecture}${firstRecord.municipality}`;
        Promise.all(
          uniqueDistricts.map(async (name) => {
            const pos = await geocodeAddress(`${prefix}${name}`);
            return pos ? { name, lat: pos.lat, lng: pos.lng } : null;
          })
        ).then((results) => {
          setDistrictMarkers(results.filter((r): r is DistrictMarker => r !== null));
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function handleReplay(lat: number, lng: number, savedImage?: string) {
    setExternalCoords({ lat, lng });
    setLifestyleImage(savedImage);
    handleSearch(lat, lng);
  }

  async function handleDownloadPdf() {
    if (!firstRecord) return;
    // flushSync でReactを同期的に再レンダリングし、
    // TransactionTable が isPdfExporting=true の状態（1ページ目・ページネーション非表示）に
    // なってからキャプチャを開始する
    flushSync(() => setPdfLoading(true));
    try {
      await exportToPdf("report-content", firstRecord.municipality);
    } finally {
      setPdfLoading(false);
    }
  }

  const summary = useMemo(
    () => (result ? calcSummary(result.data.data) : null),
    [result]
  );
  const firstRecord = result?.data.data[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🏠</span>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              不動産価値・リスク診断レポート
            </h1>
            <p className="text-xs text-slate-500">
              国土交通省「不動産情報ライブラリ」データを活用 — β版
            </p>
          </div>

          {/* 認証UI */}
          {!authLoading && (
            user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                  )}
                  <span className="text-sm text-slate-600 max-w-[160px] truncate">{user.displayName ?? user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Googleでログイン
              </button>
            )
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <SearchForm onSearch={handleSearch} loading={loading} districtMarkers={districtMarkers} isLoggedIn={!!user} externalCoords={externalCoords} />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-medium">データを取得中...</p>
            <p className="text-sm text-slate-400 mt-1">
              初回は国土交通省APIへのリクエストが発生します（数秒かかります）
            </p>
          </div>
        )}

        {result && summary && (
          <>
            <div className="flex justify-end">
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {pdfLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    PDF生成中...
                  </>
                ) : (
                  <>
                    <span>📄</span>
                    PDFをダウンロード
                  </>
                )}
              </button>
            </div>

            <div id="report-content" className="space-y-5 bg-slate-50 p-1 rounded-xl">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 bg-white rounded-lg border border-slate-200 px-4 py-3">
                <SourceBadge source={result.source} />
                <span className="text-slate-300">|</span>
                {firstRecord && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    対象エリア:{" "}
                    <strong className="text-slate-800">
                      {firstRecord.prefecture} {firstRecord.municipality}
                    </strong>
                    （市区町村コード: {result.data.cityCode}）
                    <span className="text-xs text-slate-500">※選択した地点を含む市区町村全体のデータです</span>
                  </span>
                )}
                <span className="text-slate-300">|</span>
                <span>
                  対象年:{" "}
                  <strong className="text-slate-800">
                    {result.data.years.length === 1
                      ? `${result.data.years[0]}年`
                      : `${result.data.years[0]}〜${result.data.years[result.data.years.length - 1]}年`}
                  </strong>
                </span>
                {result.expiresAt && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-400">
                      キャッシュ期限: {new Date(result.expiresAt).toLocaleDateString("ja-JP")}
                    </span>
                  </>
                )}
              </div>

              <SummaryCards summary={summary} hazard={result.hazard} />
              <LifestyleImage
                user={user}
                cityCode={result.data.cityCode}
                prefecture={result.data.data[0]?.prefecture ?? ""}
                municipality={result.data.data[0]?.municipality ?? ""}
                cachedImage={lifestyleImage}
                onImageSaved={setLifestyleImage}
              />
              {result.environment && (
                <EnvironmentInfoCard environment={result.environment} />
              )}
              <PriceTrendChart records={result.data.data} />
              {result.aiReport && <AiReport report={result.aiReport} />}
              <TransactionTable records={result.data.data} isPdfExporting={pdfLoading} autoDistrict={autoDistrict} />
            </div>
          </>
        )}

        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
            <p className="text-4xl mb-3">🗾</p>
            <p className="font-medium text-slate-500">
              緯度・経度を入力して「診断開始」を押してください
            </p>
            <p className="text-sm mt-1">
              国交省データベースから周辺の不動産取引情報を取得します
            </p>
          </div>
        )}
      </main>

      {/* 右下フローティング履歴ボタン（ログイン中のみ） */}
      {user && <HistoryList uid={user.uid} onReplay={handleReplay} />}

      <footer className="mt-8 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        データソース: 国土交通省「不動産情報ライブラリ」 /
        キャッシュ: Google Cloud Storage (TTL 30日)
      </footer>
    </div>
  );
}
