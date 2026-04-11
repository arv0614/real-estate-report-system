"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import Link from "next/link";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import {
  checkGuestSearchAllowed,
  recordGuestSearch,
  getGuestSearchCountToday,
  checkAndIncrementFreeSearch,
  FREE_DAILY_LIMIT,
  GUEST_DAILY_LIMIT,
  IS_FREE_UNLIMITED_CAMPAIGN,
} from "@/lib/userPlan";
import { dataLayerPush } from "@/lib/analytics";
import { fetchTransactions, calcSummary } from "@/lib/api";
import { TOKYO_23_WARDS } from "@/lib/areas";
import { trackLimitReached } from "@/lib/posthog";
import { gtagEvent } from "@/lib/gtag";
import { exportToPdf, DEFAULT_PDF_OPTIONS } from "@/lib/exportPdf";
import type { PdfExportOptions } from "@/lib/exportPdf";
import { getLifestyleCache, saveLifestyleCache } from "@/lib/lifestyleCache";
import { generateLifestyleImage } from "@/lib/api";
import { geocodeAddress, reverseGeocodeDistrict, matchDistrictName } from "@/lib/geocode";
import { saveSearchHistory } from "@/lib/history";
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
import { ShareActions } from "@/components/ShareActions";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import { WaitlistModal } from "@/components/WaitlistModal";
import nextDynamic from "next/dynamic";

// レポート内地図（読み取り専用・SSR無効）
const ReportMap = nextDynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-48 rounded-lg bg-slate-100 animate-pulse" /> }
);

// PDF出力するセクションの選択状態
interface PdfSections {
  summary: boolean;
  environment: boolean;
  chart: boolean;
  aiReport: boolean;
  table: boolean;
}

const PDF_SECTION_LABELS: { key: keyof PdfSections; label: string }[] = [
  { key: "summary",     label: "取引価格サマリー＆ハザード" },
  { key: "environment", label: "生活環境情報" },
  { key: "chart",       label: "価格推移グラフ" },
  { key: "aiReport",    label: "エリア特性調査レポート" },
  { key: "table",       label: "取引事例一覧" },
];

function HomePageContent() {
  const { user, loading: authLoading, plan, planLoading } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const progressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransactionApiResponse | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [autoDistrict, setAutoDistrict] = useState<string>("");
  const [districtMarkers, setDistrictMarkers] = useState<DistrictMarker[]>([]);
  const [externalCoords, setExternalCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [lifestyleImage, setLifestyleImage] = useState<string | undefined>(undefined);
  const [lifestyleImageLoading, setLifestyleImageLoading] = useState(false);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistPlan, setWaitlistPlan] = useState<"guest" | "free">("guest");
  const [searchCountToday, setSearchCountToday] = useState(0);

  // PDF出力セクション選択
  const [pdfSections, setPdfSections] = useState<PdfSections>({
    summary: true, environment: true, chart: true, aiReport: true, table: true,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const autoSearchTriggered = useRef(false);

  const [pdfExportOptions, setPdfExportOptions] = useState<PdfExportOptions>(DEFAULT_PDF_OPTIONS);

  // URLパラメータからの自動検索（シェアURL経由でのアクセス時）
  useEffect(() => {
    if (autoSearchTriggered.current) return;
    if (authLoading || planLoading) return;
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      if (!isNaN(lat) && !isNaN(lng)) {
        autoSearchTriggered.current = true;
        setExternalCoords({ lat, lng });
        handleSearch(lat, lng);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, planLoading]);

  // 設定パネル外クリックで閉じる
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  // iOS Safari の bfcache 復元時（戻るボタン）に PDF 出力状態を強制リセット
  // window.open(blobUrl) で現タブがナビゲートされた場合でも、戻り後は必ずクリーンな状態に戻す
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        document.body.classList.remove("pdf-export");
        setPdfLoading(false);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function startProgressSimulation() {
    progressTimersRef.current.forEach(clearTimeout);
    progressTimersRef.current = [];
    setProgressPercent(5);
    setProgressMessage("国土交通省APIへ接続中...");
    const steps: { delay: number; percent: number; message: string }[] = [
      { delay: 1200,  percent: 28, message: "取引データを取得中..." },
      { delay: 3500,  percent: 52, message: "AIでエリアを分析中..." },
      { delay: 6500,  percent: 72, message: "専門家視点でレポートを生成中..." },
      { delay: 9500,  percent: 88, message: "データを整理中..." },
    ];
    steps.forEach(({ delay, percent, message }) => {
      const id = setTimeout(() => {
        setProgressPercent(percent);
        setProgressMessage(message);
      }, delay);
      progressTimersRef.current.push(id);
    });
  }

  function stopProgressSimulation() {
    progressTimersRef.current.forEach(clearTimeout);
    progressTimersRef.current = [];
  }

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
    setError(null);
    const userPlanDL = !user ? "guest" : (plan ?? "free");

    // ── 検索回数制限チェック ──────────────────────────────
    let todayCount = 0;
    try {
      if (!user) {
        // 未ログイン: localStorage で1日5回
        if (!checkGuestSearchAllowed()) {
          trackLimitReached({ plan: "guest" });
          dataLayerPush({ event: "limit_reached", user_plan: "guest", search_count_today: GUEST_DAILY_LIMIT });
          setWaitlistPlan("guest");
          setWaitlistModalOpen(true);
          return;
        }
        recordGuestSearch();
        todayCount = getGuestSearchCountToday();
      } else if (plan === "free") {
        // 無料ログイン: キャンペーン中は上限チェックをバイパス（Firestore記録は継続）
        const { allowed, usedCount } = await checkAndIncrementFreeSearch(user.uid);
        if (!IS_FREE_UNLIMITED_CAMPAIGN && !allowed) {
          trackLimitReached({ plan: "free", uid: user.uid });
          dataLayerPush({ event: "limit_reached", user_plan: "free", search_count_today: FREE_DAILY_LIMIT });
          setWaitlistPlan("free");
          setWaitlistModalOpen(true);
          return;
        }
        todayCount = usedCount;
      }
    } catch (limitErr) {
      // 制限チェック自体のエラーは無視して検索を続行
      console.error("[handleSearch] limit check error, proceeding:", limitErr);
    }
    // plan === "pro" または planLoading 中 → 制限なしで続行
    // ─────────────────────────────────────────────────────

    startProgressSimulation();
    setLoading(true);
    setResult(null);
    setAutoDistrict("");
    setDistrictMarkers([]);
    setSearchCoords({ lat, lng });
    setLifestyleImage(undefined);
    setLifestyleImageLoading(false);
    try {
      const data = await fetchTransactions(lat, lng);
      stopProgressSimulation();
      setProgressPercent(100);
      setProgressMessage("レポートを表示中...");
      setResult(data);
      setSearchCountToday(todayCount);
      dataLayerPush({ event: "generate_report", user_plan: userPlanDL, search_count_today: todayCount });

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

      // 暮らしイメージ: ロケーションキャッシュ確認 → pro はなければ自動生成（バックグラウンド）
      {
        const pref = data.data.data[0]?.prefecture ?? "";
        const muni = data.data.data[0]?.municipality ?? data.data.geocodedDistrict ?? "";
        const cityCode = data.data.cityCode;
        if (pref && muni && cityCode) {
          (async () => {
            const cached = await getLifestyleCache(cityCode);
            if (cached) {
              setLifestyleImage(cached);
            } else if (plan === "pro") {
              setLifestyleImageLoading(true);
              try {
                const result = await generateLifestyleImage(
                  pref, muni,
                  data.aiReport?.slice(0, 800)
                );
                const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
                setLifestyleImage(dataUrl);
                saveLifestyleCache(cityCode, dataUrl, pref, muni).catch(console.error);
              } catch (err) {
                console.error("[HomeClient] lifestyle auto-generate failed:", err);
              } finally {
                setLifestyleImageLoading(false);
              }
            }
          })();
        }
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
      stopProgressSimulation();
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // 履歴リプレイ: ロケーションキャッシュを再取得して再検索
  function handleReplay(lat: number, lng: number) {
    setExternalCoords({ lat, lng });
    handleSearch(lat, lng);
  }

  async function handleDownloadPdf() {
    if (plan !== "pro") {
      gtagEvent({ action: "view_plan_modal", category: "conversion_funnel" });
      setPlanModalOpen(true);
      return;
    }
    if (!firstRecord) return;
    flushSync(() => setPdfLoading(true));
    let result: { blobUrl: string; filename: string } | null = null;
    try {
      result = await exportToPdf("report-content", firstRecord.municipality, pdfExportOptions);
    } catch (e) {
      console.error("[PDF] export error:", e);
    } finally {
      // window.open より先に状態を完全リセットする。
      // iOS Safari は window.open(blobUrl) で現タブをナビゲートする場合があり、
      // その時点で JS コンテキストが止まると bfcache 復元時に UI がフリーズする。
      document.body.classList.remove("pdf-export");
      setPdfLoading(false);
    }
    // 状態リセット完了後に PDF を開く
    if (result) {
      const { blobUrl, filename } = result;
      // iOS Safari は window.open(blob:...) で現タブをナビゲートするため anchor download を使う。
      // iOS 13.4+ では <a download> が blob URL に対応しており「ファイルに保存」シートが開く。
      const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
      if (isIOS) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const win = window.open(blobUrl, "_blank", "noopener");
        if (!win) {
          // ポップアップブロック時フォールバック
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    }
  }

  function togglePdfSection(key: keyof PdfSections) {
    setPdfSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const summary = useMemo(
    () => (result ? calcSummary(result.data.data) : null),
    [result]
  );
  const firstRecord = result?.data.data[0];

  /** OGP用の総合スコアをハザード情報から簡易計算（0-100） */
  const ogScore = useMemo(() => {
    if (!result) return null;
    let score = 75;
    if (result.hazard?.flood?.hasRisk) score -= 20;
    if (result.hazard?.landslide?.hasRisk) score -= 5;
    if (result.environment?.station?.name) score += 5;
    if (result.environment?.schools?.elementary) score += 5;
    return Math.max(0, Math.min(100, score));
  }, [result]);

  /** OGP用の平均取引単価文字列（例: "45万円/㎡"）*/
  const ogPriceLabel = useMemo(() => {
    if (!summary?.avgUnitPrice) return null;
    return `${Math.round(summary.avgUnitPrice / 10000).toLocaleString()}万円/㎡`;
  }, [summary]);

  // PDF出力時に非表示にするクラスを返す
  function pdfHide(visible: boolean) {
    return visible ? "" : "pdf-hide";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <img
            src="/logo_mekiki_research.png"
            alt=""
            className="h-10 w-10 object-contain shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              物件目利きリサーチ
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              国土交通省データ × プロの目利き — β版
            </p>
          </div>

          {/* ナビゲーションリンク */}
          <Link
            href="/about"
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            サービスについて
          </Link>
          <button
            onClick={() => { gtagEvent({ action: "view_plan_modal", category: "conversion_funnel" }); setPlanModalOpen(true); }}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ベータ版について
          </button>

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
                {/* プランバッジ */}
                {!planLoading && (
                  <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${
                    plan === "pro"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {plan === "pro" ? "Pro" : "Free"}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Guest
                </span>
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
              </div>
            )
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <SearchForm onSearch={handleSearch} loading={loading} districtMarkers={districtMarkers} isLoggedIn={!!user} externalCoords={externalCoords} collapseMap={!!result} />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
            <p>⚠️ {error}</p>
            <p className="text-xs text-red-500">
              しばらく待ってから再度お試しください。問題が続く場合は座標を変えるか、別のエリアで検索してみてください。
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            {/* ステップインジケーター */}
            <div className="flex justify-center items-center gap-2 mb-6">
              {[
                { threshold: 5,  label: "接続" },
                { threshold: 28, label: "取得" },
                { threshold: 52, label: "分析" },
                { threshold: 72, label: "生成" },
                { threshold: 95, label: "完了" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-500 ${
                    progressPercent >= step.threshold
                      ? "bg-blue-500 text-white shadow-md shadow-blue-200"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {progressPercent >= step.threshold && progressPercent < (i === 4 ? 101 : [28,52,72,95,101][i+1] ?? 101) ? (
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : progressPercent >= step.threshold ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block transition-colors duration-300 ${
                    progressPercent >= step.threshold ? "text-blue-600" : "text-slate-400"
                  }`}>{step.label}</span>
                  {i < 4 && <div className={`w-6 h-0.5 transition-all duration-500 ${progressPercent > step.threshold ? "bg-blue-400" : "bg-slate-200"}`} />}
                </div>
              ))}
            </div>

            {/* プログレスバー */}
            <div className="max-w-sm mx-auto mb-3">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* ステータスメッセージ */}
            <p className="text-sm font-semibold text-slate-700 mb-1 transition-all duration-300">
              {progressMessage}
            </p>
            <p className="text-xs text-slate-400">
              国土交通省APIへのリクエストが発生します（通常5〜15秒）
            </p>
          </div>
        )}

        {result && summary && (
          <>
            {/* PDF操作バー */}
            <div className="flex items-center justify-end gap-2 pdf-hide">
              {/* 出力設定ポップオーバー */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span>⚙️</span>
                  出力設定
                </button>

                {settingsOpen && (
                  <div className="fixed bottom-16 left-4 right-4 z-50 sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-64 sm:z-20 rounded-xl border border-slate-200 bg-white shadow-xl p-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      PDFに含めるセクション
                    </p>
                    <div className="space-y-2.5">
                      {PDF_SECTION_LABELS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={pdfSections[key]}
                            onChange={() => togglePdfSection(key)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer accent-blue-600"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors select-none">
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                        コンテンツオプション
                      </p>
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={pdfExportOptions.includeMap}
                            onChange={(e) =>
                              setPdfExportOptions((prev) => ({ ...prev, includeMap: e.target.checked }))
                            }
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-blue-600"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors select-none">
                            地図を含める
                          </span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={pdfExportOptions.includeLifestyleImage}
                            onChange={(e) =>
                              setPdfExportOptions((prev) => ({ ...prev, includeLifestyleImage: e.target.checked }))
                            }
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-blue-600"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors select-none">
                            暮らしのイメージを含める
                          </span>
                        </label>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                      チェックを外した項目はPDF非表示（画面は通常表示）
                    </p>
                  </div>
                )}
              </div>

              {/* PDFダウンロードボタン */}
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
                {/* Web のみ: キャッシュ状態バッジ */}
                <span className="pdf-hide inline-flex items-center gap-3">
                  <SourceBadge source={result.source} />
                  <span className="text-slate-300">|</span>
                </span>
                {/* PDF・Web 共通: 出典 */}
                <span className="text-xs text-slate-500">
                  出典: 国土交通省 不動産情報ライブラリ
                </span>
                <span className="text-slate-300">|</span>
                {firstRecord && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    対象エリア:{" "}
                    <strong className="text-slate-800">
                      {firstRecord.prefecture} {firstRecord.municipality}
                    </strong>
                    <span className="text-xs text-slate-500 pdf-hide">（市区町村コード: {result.data.cityCode}）</span>
                    <span className="text-xs text-slate-500 pdf-hide">※選択した地点を含む市区町村全体のデータです</span>
                  </span>
                )}
                <span className="text-slate-300">|</span>
                <span>
                  対象年:{" "}
                  <strong className="text-slate-800">
                    {result.data.years.length === 0
                      ? "データなし"
                      : result.data.years.length === 1
                      ? `${result.data.years[0]}年`
                      : `${result.data.years[0]}〜${result.data.years[result.data.years.length - 1]}年`}
                  </strong>
                </span>
                {/* Web のみ: キャッシュ期限 */}
                {result.expiresAt && (
                  <span className="pdf-hide inline-flex items-center gap-3">
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-400">
                      キャッシュ期限: {new Date(result.expiresAt).toLocaleDateString("ja-JP")}
                    </span>
                  </span>
                )}
              </div>

              {/* 診断エリア地図（data-pdf-map で PDF 出力オプション制御） */}
              {searchCoords && (
                <div data-pdf-map className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">📍 調査エリアの地図</span>
                  </div>
                  <ReportMap
                    lat={searchCoords.lat}
                    lng={searchCoords.lng}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              )}

              {/* 各セクション: pdfSections の設定に応じて pdf-hide を付与 */}
              <div className={pdfHide(pdfSections.summary)}>
                <SummaryCards summary={summary} hazard={result.hazard} />
              </div>

              {result.environment && (
                <div className={pdfHide(pdfSections.environment)}>
                  <EnvironmentInfoCard environment={result.environment} />
                </div>
              )}

              <div className={pdfHide(pdfSections.chart)}>
                <PriceTrendChart records={result.data.data} />
              </div>

              {result.aiReport && (
                <div className={pdfHide(pdfSections.aiReport)}>
                  <AiReport
                    report={result.aiReport}
                    user={user}
                    plan={plan}
                    cityCode={result.data.cityCode}
                    prefecture={result.data.data[0]?.prefecture ?? ""}
                    municipality={
                      result.data.data[0]?.municipality ??
                      result.data.geocodedDistrict ??
                      ""
                    }
                    lifestyleImage={lifestyleImage}
                    imageGenerating={lifestyleImageLoading}
                    onImageSaved={setLifestyleImage}
                    onLoginRequest={handleLogin}
                    onPlanModalOpen={() => setPlanModalOpen(true)}
                  />
                </div>
              )}

              <div className={pdfHide(pdfSections.table)}>
                <TransactionTable records={result.data.data} isPdfExporting={pdfLoading} autoDistrict={autoDistrict} />
              </div>

              {/* シェアアクション（PDF非表示・レポート末尾） */}
              {firstRecord && (
                <div className="pdf-hide">
                  <ShareActions
                    prefecture={firstRecord.prefecture ?? ""}
                    municipality={firstRecord.municipality ?? ""}
                    lat={searchCoords?.lat ?? 0}
                    lng={searchCoords?.lng ?? 0}
                    avgUnitPrice={summary.avgUnitPrice}
                    avgTradePrice={summary.avgTradePrice}
                    hasFloodRisk={result.hazard?.flood?.hasRisk ?? false}
                    ogScore={ogScore}
                    ogPriceLabel={ogPriceLabel}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
            <p className="text-4xl mb-3">🗾</p>
            <p className="font-medium text-slate-500">
              住所または緯度・経度を入力して「調査開始」を押してください
            </p>
            <p className="text-sm mt-1">
              国土交通省の取引データをもとにエリアの精密調査を行います
            </p>
          </div>
        )}
      </main>

      {/* 右下フローティング履歴ボタン（ログイン中のみ） */}
      {user && <HistoryList uid={user.uid} onReplay={handleReplay} />}

      {/* プラン比較モーダル */}
      <PlanComparisonModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlan={user ? plan : null}
        uid={user?.uid ?? null}
        userEmail={user?.email ?? null}
        searchCountToday={searchCountToday}
      />

      {/* ウェイティングリストモーダル（上限到達時） */}
      <WaitlistModal
        open={waitlistModalOpen}
        onClose={() => setWaitlistModalOpen(false)}
        plan={waitlistPlan}
        uid={user?.uid ?? null}
        userEmail={user?.email ?? null}
      />

      {/* 主要エリアから探すリンク集（SEO内部リンク） */}
      <section className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">主要エリアから探す</h2>
        <div className="flex flex-wrap gap-2">
          {TOKYO_23_WARDS.map((a) => (
            <Link
              key={a.citySlug}
              href={`/reports/${a.prefSlug}/${a.citySlug}`}
              className="inline-flex items-center text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2.5 py-1 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {a.city}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-6 border-t border-slate-200 py-6 text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left space-y-0.5">
            <p>本サービスは国土交通省「不動産情報ライブラリ」（CC BY 4.0）を加工して作成しています。</p>
            <p>地図: © <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">国土地理院</a></p>
          </div>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="hover:text-slate-600 transition-colors">サービスについて</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">利用規約</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">プライバシーポリシー</Link>
            <Link href="/about#legal" className="hover:text-slate-600 transition-colors">特定商取引法</Link>
            <Link href="/licenses" className="hover:text-slate-600 transition-colors">OSSライセンス</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// useSearchParams() は Suspense バウンダリが必要
export default function HomeClient() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
