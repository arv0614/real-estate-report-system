"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter as useIntlRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { useAuthModal } from "@/components/AuthModalContext";
import {
  checkGuestSearchAllowed,
  recordGuestSearch,
  getGuestSearchCountToday,
  checkAndIncrementFreeSearch,
  getWhiteLabelConfig,
  FREE_DAILY_LIMIT,
  GUEST_DAILY_LIMIT,
  IS_FREE_UNLIMITED_CAMPAIGN,
} from "@/lib/userPlan";
import { dataLayerPush } from "@/lib/analytics";
import { fetchTransactions, calcSummary } from "@/lib/api";
import { TOKYO_23_WARDS } from "@/lib/areas";
import { trackLimitReached } from "@/lib/posthog";
import { gtagEvent, gtagPurchase } from "@/lib/gtag";
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
import { PropertyTypeFilter, ALL_TYPE, type PropertyTypeValue } from "@/components/PropertyTypeFilter";
import { TransactionTable } from "@/components/TransactionTable";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { EnvironmentInfoCard } from "@/components/EnvironmentInfo";
import { WeatherInfoCard } from "@/components/WeatherInfoCard";
import { AiReport } from "@/components/AiReport";
import { ShareActions } from "@/components/ShareActions";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
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
  weather: boolean;
  chart: boolean;
  aiReport: boolean;
  table: boolean;
}

const PDF_SECTION_KEYS: { key: keyof PdfSections; msgKey: string }[] = [
  { key: "summary",     msgKey: "PdfSections.summary" },
  { key: "environment", msgKey: "PdfSections.environment" },
  { key: "weather",     msgKey: "PdfSections.weather" },
  { key: "chart",       msgKey: "PdfSections.chart" },
  { key: "aiReport",    msgKey: "PdfSections.aiReport" },
  { key: "table",       msgKey: "PdfSections.table" },
];

function HomePageContent() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const intlRouter = useIntlRouter();
  const { user, loading: authLoading, plan, planLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const progressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** エラー時の付帯コード（例: "RATE_LIMITED"）。リッチ UI に分岐するための判別子。 */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<TransactionApiResponse | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [autoDistrict, setAutoDistrict] = useState<string>("");
  const [districtMarkers, setDistrictMarkers] = useState<DistrictMarker[]>([]);
  const [externalCoords, setExternalCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [lifestyleImage, setLifestyleImage] = useState<string | undefined>(undefined);
  const [lifestyleImageLoading, setLifestyleImageLoading] = useState(false);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [searchCountToday, setSearchCountToday] = useState(0);

  // PDF出力セクション選択
  const [pdfSections, setPdfSections] = useState<PdfSections>({
    summary: true, environment: true, weather: true, chart: true, aiReport: true, table: true,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const urlParamsApplied = useRef(false);

  const [pdfExportOptions, setPdfExportOptions] = useState<PdfExportOptions>(DEFAULT_PDF_OPTIONS);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeValue>(ALL_TYPE);
  /** 地区名フィルタ。"" は全地区。result 取得時 autoDistrict が一致すれば自動選択。 */
  const [districtFilter, setDistrictFilter] = useState<string>("");
  /** 徒歩時間フィルタ（最寄り駅から、分）。0 は「すべて」、5/10/15/20 が選択可能。Proプラン限定。 */
  const [walkTimeFilter, setWalkTimeFilter] = useState<0 | 5 | 10 | 15 | 20>(0);
  /**
   * 初期値セットを完了した result.cacheKey を覚えておくフラグ。
   * autoDistrict は別ルート (reverseGeocodeDistrict) で非同期に確定するため
   * effect が「autoDistrict 未取得の状態」「取得完了後の状態」で2回走る可能性がある。
   * このフラグで「同じ検索結果に対しては最初の有効な評価1回だけ」を保証し、
   * その後のユーザー操作を上書きしないようにする。
   */
  const initializedDistrictKey = useRef<string | null>(null);

  // URLパラメータ (?lat=&lng=) でランディング時の挙動:
  //   - 検索バーの lat / lng と地図ピンに座標を反映するだけに留める
  //   - 自動的に fetchTransactions は発火させない (ゲスト枠を意図せず消費しないため)
  //   - ユーザーが「調査開始」ボタンを押したときに初めて API リクエストが飛ぶ
  // ブログ記事の CTA / シェアURL から流入したユーザーが、
  // 地点が地図に乗った状態で内容を確認してから自分の意思で検索を実行できる UX。
  useEffect(() => {
    if (urlParamsApplied.current) return;
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    if (!latParam || !lngParam) return;
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (isNaN(lat) || isNaN(lng)) return;
    urlParamsApplied.current = true;
    setExternalCoords({ lat, lng });
    // intentionally NOT calling handleSearch(lat, lng) here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 決済成功リダイレクト検知 → GA4 purchase イベント（セッション内重複防止）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;

    const DEDUP_KEY = "ga4_purchase_fired";
    if (!sessionStorage.getItem(DEDUP_KEY)) {
      sessionStorage.setItem(DEDUP_KEY, "1");
      gtagPurchase(`ls_${Date.now()}`, 980, "JPY");
    }

    // URL から ?payment=success を除去してリロード時の重複を防ぐ
    params.delete("payment");
    const qs = params.toString();
    const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setProgressMessage(t("Progress.connecting"));
    const steps: { delay: number; percent: number; message: string }[] = [
      { delay: 1500,   percent: 18, message: t("Progress.fetching") },
      { delay: 4000,   percent: 30, message: t("Progress.collectingData") },
      { delay: 8000,   percent: 42, message: t("Progress.analyzingData") },
      { delay: 14000,  percent: 53, message: t("Progress.evaluatingArea") },
      { delay: 22000,  percent: 62, message: t("Progress.assessingHazard") },
      { delay: 35000,  percent: 71, message: t("Progress.writingReport") },
      { delay: 60000,  percent: 80, message: t("Progress.reviewingReport") },
      { delay: 90000,  percent: 87, message: t("Progress.finalizing") },
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

  function handleLogin() {
    openAuthModal("signin");
  }

  async function handleLogout() {
    await signOut(auth);
    setResult(null);
  }

  async function handleSearch(lat: number, lng: number) {
    setError(null);
    setErrorCode(null);
    const userPlanDL = !user ? "guest" : (plan ?? "free");

    // ── 検索回数制限チェック ──────────────────────────────
    let todayCount = 0;
    try {
      if (!user) {
        // 未ログイン: localStorage で1日5回
        if (!checkGuestSearchAllowed()) {
          trackLimitReached({ plan: "guest" });
          dataLayerPush({ event: "limit_reached", user_plan: "guest", search_count_today: GUEST_DAILY_LIMIT });
          gtagEvent({ action: "reach_limit", category: "conversion_funnel", label: "guest" });
          gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "limit_modal" });
          setPlanModalOpen(true);
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
          gtagEvent({ action: "reach_limit", category: "conversion_funnel", label: "free" });
          gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "limit_modal" });
          setPlanModalOpen(true);
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
      const data = await fetchTransactions(lat, lng, 15, locale);
      stopProgressSimulation();
      setProgressPercent(100);
      setProgressMessage(t("Progress.displaying"));
      setResult(data);
      setSearchCountToday(todayCount);
      dataLayerPush({ event: "generate_report", user_plan: userPlanDL, search_count_today: todayCount });
      const locationName = data.data.data[0]
        ? `${data.data.data[0].prefecture}${data.data.data[0].municipality}`
        : "";
      gtagEvent({ action: "generate_report", category: "engagement", label: locationName });

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
      const errCode = (e as { code?: string })?.code;
      if (errCode === "RATE_LIMITED") {
        setErrorCode("RATE_LIMITED");
        // RATE_LIMITED 時は専用バナーで body を出すので error 文字列は短い見出し相当を入れる
        setError(t("Error.rateLimitedTitle"));
      } else {
        setErrorCode(null);
        setError(e instanceof Error ? e.message : t("Error.unknown"));
      }
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
      gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "pdf" });
      setPlanModalOpen(true);
      return;
    }
    if (!firstRecord) return;
    flushSync(() => setPdfLoading(true));
    let result: { blobUrl: string; filename: string } | null = null;
    try {
      // Pro ユーザーのみ、ホワイトラベル設定（社名・ロゴ）を取得して PDF ヘッダーに反映
      const whiteLabel = user ? await getWhiteLabelConfig(user.uid) : null;
      result = await exportToPdf("report-content", firstRecord.municipality, {
        ...pdfExportOptions,
        whiteLabel: whiteLabel && (whiteLabel.companyName || whiteLabel.companyLogoUrl)
          ? whiteLabel
          : undefined,
      });
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

  // 全レコードから種別チップの件数を集計（フィルタ適用前）
  const unfilteredSummary = useMemo(
    () => (result ? calcSummary(result.data.data) : null),
    [result]
  );

  // result から取得できる地区名一覧（重複除去 + 五十音順）
  const districtOptions = useMemo<string[]>(() => {
    if (!result) return [];
    const names = Array.from(
      new Set(
        result.data.data
          .map((r) => r.districtName)
          .filter((d): d is string => typeof d === "string" && d.length > 0)
      )
    );
    return names.sort((a, b) => a.localeCompare(b, "ja"));
  }, [result]);

  // フィルタ適用後のレコード（フロントで再集計するため API は再リクエストしない）
  // 物件種別 + 地区名 + 徒歩時間の AND 条件で抽出。SummaryCards / PriceTrendChart /
  // TransactionTable 全てがこの集合を共有する。
  // 徒歩時間は Pro プランのみ。それ以外は walkTimeFilter=0 のままなので素通りする。
  // timeToNearestStation は MLIT が文字列で返すため、parseInt で先頭の整数のみ抽出して比較する
  // （"30分?60分" のようなレンジ表現は下限の 30 として扱う = 保守的な絞り込み）。
  const filteredRecords = useMemo(() => {
    if (!result) return [];
    return result.data.data.filter((r) => {
      const typeMatch = propertyTypeFilter === ALL_TYPE || r.type === propertyTypeFilter;
      const districtMatch = districtFilter === "" || r.districtName === districtFilter;
      let walkMatch = true;
      if (walkTimeFilter > 0) {
        const raw = r.timeToNearestStation;
        if (!raw) {
          walkMatch = false; // データなしの取引はフィルタ有効時は除外
        } else {
          const minutes = parseInt(String(raw), 10);
          walkMatch = Number.isFinite(minutes) && minutes <= walkTimeFilter;
        }
      }
      return typeMatch && districtMatch && walkMatch;
    });
  }, [result, propertyTypeFilter, districtFilter, walkTimeFilter]);

  // SummaryCards 表示用: 選択された種別だけで再集計
  const summary = useMemo(
    () => (result ? calcSummary(filteredRecords) : null),
    [result, filteredRecords]
  );
  const firstRecord = result?.data.data[0];

  // 新しい検索結果が来たら種別フィルタと徒歩時間フィルタを「すべて」に戻す
  // （新エリアでは旧条件の取引が0件のことがあるため）
  useEffect(() => {
    setPropertyTypeFilter(ALL_TYPE);
    setWalkTimeFilter(0);
  }, [result?.cacheKey, result?.fetchedAt]);

  // 検索結果ごとに、自動検出された地区を「初期値」としてだけ適用する。
  // - autoDistrict (reverseGeocodeDistrict の結果) は result より遅れて入る場合があるため
  //   `if (!autoDistrict) return;` で「未取得時は何もしない」状態にし、取得完了後の再実行を待つ。
  // - 既に同じ cacheKey で評価済みなら何もしない（ユーザーの手動操作を上書きしないため）。
  // - autoDistrict が districtOptions と完全一致しなくても、双方向の部分一致で吸収する
  //   （MLIT データの「青戸4丁目」と GSI の「青戸」のような表記揺れに対応）。
  // - 該当レコードが 10 件未満なら統計的意味が薄いので "" (すべて) にフォールバック。
  const AUTO_DISTRICT_MIN_RECORDS = 10;
  useEffect(() => {
    if (!result || !autoDistrict) return;
    if (initializedDistrictKey.current === result.cacheKey) return;

    const match = districtOptions.find(
      (d) => d === autoDistrict || autoDistrict.includes(d) || d.includes(autoDistrict)
    );
    if (match) {
      const matched = result.data.data.filter((r) => r.districtName === match).length;
      setDistrictFilter(matched >= AUTO_DISTRICT_MIN_RECORDS ? match : "");
    } else {
      setDistrictFilter("");
    }
    initializedDistrictKey.current = result.cacheKey;
  }, [result, autoDistrict, districtOptions]);

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
              {t("Header.title")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("Header.subtitle")}
            </p>
          </div>

          {/* ナビゲーションリンク */}
          <Link
            href="/about"
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t("Header.aboutLink")}
          </Link>
          <Link
            href={`${locale === "en" ? "/en" : ""}/blog`}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t("Header.blogLink")}
          </Link>
          {/* Free ユーザー向けアップグレードボタン */}
          {!planLoading && plan === "free" && (
            <button
              onClick={() => { gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "header_upgrade" }); setPlanModalOpen(true); }}
              className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-sm"
            >
              {t("Header.upgradeBtn")}
            </button>
          )}
          {/* ゲスト・未ログイン時はベータ情報ボタン */}
          {!user && (
            <button
              onClick={() => { gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "header" }); setPlanModalOpen(true); }}
              className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("Header.betaLink")}
            </button>
          )}

          {/* 言語切り替え */}
          <button
            onClick={() => intlRouter.replace(pathname, { locale: locale === "en" ? "ja" : "en" })}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
            aria-label="Switch language"
          >
            {t("Header.langSwitch")}
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
                <Link
                  href="/profile"
                  className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t("Header.profileLink")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t("Header.logoutButton")}
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
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                {t("Header.loginButton")}
              </button>
              </div>
            )
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <SearchForm onSearch={handleSearch} loading={loading} districtMarkers={districtMarkers} isLoggedIn={!!user} externalCoords={externalCoords} collapseMap={!!result} locale={locale} />

        {!result && !loading && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-teal-800">
                {locale === "en"
                  ? "🆕 Try the Indicator Summary UI (Beta)"
                  : "🆕 指標サマリー UI を試す（β 版）"}
              </p>
              <p className="text-xs text-teal-700 mt-0.5 leading-relaxed">
                {locale === "en"
                  ? "See public data summaries for any area in 30 seconds — earthquake probability, flood risk, population trend, and market activity — even without entering property details."
                  : "物件情報がなくてもエリアの公的データを 30 秒でサマリー化。地震確率・洪水ランク・人口動態・取引活発度などを可視化します。"}
              </p>
            </div>
            <a
              href={`${locale === "en" ? "/en" : ""}/research`}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded">β</span>
              {locale === "en" ? "Open Beta →" : "β 版を開く →"}
            </a>
          </div>
        )}

        {error && errorCode === "RATE_LIMITED" && (
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden>🚀</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900 leading-snug">
                  {t("Error.rateLimitedTitle")}
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {t("Error.rateLimitedBody")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "rate_limit_banner" });
                    setPlanModalOpen(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  ✨ {t("Error.rateLimitedCta")}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && errorCode !== "RATE_LIMITED" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
            <p>⚠️ {error}</p>
            <p className="text-xs text-red-500">
              {t("Error.retryNote")}
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            {/* ステップインジケーター */}
            <div className="flex justify-center items-center gap-2 mb-6">
              {[
                { threshold: 5,  label: t("Progress.stepConnect") },
                { threshold: 28, label: t("Progress.stepFetch") },
                { threshold: 52, label: t("Progress.stepAnalyze") },
                { threshold: 72, label: t("Progress.stepGenerate") },
                { threshold: 95, label: t("Progress.stepComplete") },
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
              {t("Progress.apiNote")}
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
                  {t("Report.exportSettings")}
                </button>

                {settingsOpen && (
                  <div className="fixed bottom-16 left-4 right-4 z-50 sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-64 sm:z-20 rounded-xl border border-slate-200 bg-white shadow-xl p-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      {t("Report.pdfSections")}
                    </p>
                    <div className="space-y-2.5">
                      {PDF_SECTION_KEYS.map(({ key, msgKey }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={pdfSections[key]}
                            onChange={() => togglePdfSection(key)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer accent-blue-600"
                          />
                          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors select-none">
                            {t(msgKey as Parameters<typeof t>[0])}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                        {t("Report.contentOptions")}
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
                            {t("Report.includeMap")}
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
                            {t("Report.includeLifestyle")}
                          </span>
                        </label>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                      {t("Report.hideNote")}
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
                    {t("Report.generatingPdf")}
                  </>
                ) : (
                  <>
                    <span>📄</span>
                    {t("Report.downloadPdf")}
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
                  {t("Report.source")}
                </span>
                <span className="text-slate-300">|</span>
                {firstRecord && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {t("Report.targetArea")}{" "}
                    <strong className="text-slate-800">
                      {firstRecord.prefecture} {firstRecord.municipality}
                    </strong>
                    <span className="text-xs text-slate-500 pdf-hide">（{t("Report.cityCode")} {result.data.cityCode}）</span>
                    <span className="text-xs text-slate-500 pdf-hide">※{t("Report.areaNote")}</span>
                  </span>
                )}
                <span className="text-slate-300">|</span>
                <span>
                  {t("Report.targetYear")}{" "}
                  <strong className="text-slate-800">
                    {result.data.years.length === 0
                      ? t("Report.noData")
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
                      {t("Report.cacheExpiry")} {new Date(result.expiresAt).toLocaleDateString(locale === "en" ? "en-US" : "ja-JP")}
                    </span>
                  </span>
                )}
              </div>

              {/* 診断エリア地図（data-pdf-map で PDF 出力オプション制御） */}
              {searchCoords && (
                <div data-pdf-map className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">📍 {t("Report.mapTitle")}</span>
                  </div>
                  <ReportMap
                    lat={searchCoords.lat}
                    lng={searchCoords.lng}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              )}

              {/* 種別 + 地区名 + 徒歩時間フィルタ（PDF出力時は非表示）。
                  HomeClient のグローバルステートで、SummaryCards / PriceTrendChart /
                  TransactionTable はすべて filteredRecords を共有する。
                  徒歩時間は Pro 限定 — Free/Guest はロックし、クリックでプラン比較モーダルへ。 */}
              {unfilteredSummary && unfilteredSummary.totalCount > 0 && (
                <div className="pdf-hide space-y-2">
                  <PropertyTypeFilter
                    selected={propertyTypeFilter}
                    onChange={setPropertyTypeFilter}
                    typeBreakdown={unfilteredSummary.typeBreakdown}
                    totalCount={unfilteredSummary.totalCount}
                    filteredCount={summary?.totalCount ?? 0}
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
                    {districtOptions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label htmlFor="districtFilter" className="text-xs font-medium text-slate-600">
                          {t("DistrictFilter.label")}
                        </label>
                        <select
                          id="districtFilter"
                          aria-label={t("DistrictFilter.ariaLabel")}
                          value={districtFilter}
                          onChange={(e) => setDistrictFilter(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">{t("DistrictFilter.all")}</option>
                          {districtOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {(() => {
                      const isPro = plan === "pro";
                      return (
                        <div className="flex items-center gap-2">
                          <label htmlFor="walkTimeFilter" className="text-xs font-medium text-slate-600">
                            {t("WalkTimeFilter.label")}
                          </label>
                          <select
                            id="walkTimeFilter"
                            aria-label={t("WalkTimeFilter.label")}
                            value={walkTimeFilter}
                            disabled={!isPro}
                            title={!isPro ? t("WalkTimeFilter.lockedHint") : undefined}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (v === 0 || v === 5 || v === 10 || v === 15 || v === 20) {
                                setWalkTimeFilter(v);
                              }
                            }}
                            className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                              isPro
                                ? "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                                : "border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                            }`}
                          >
                            <option value={0}>{t("WalkTimeFilter.all")}</option>
                            <option value={5}>{t("WalkTimeFilter.min5")}</option>
                            <option value={10}>{t("WalkTimeFilter.min10")}</option>
                            <option value={15}>{t("WalkTimeFilter.min15")}</option>
                            <option value={20}>{t("WalkTimeFilter.min20")}</option>
                          </select>
                          {!isPro && (
                            <button
                              type="button"
                              onClick={() => {
                                gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "walk_time_filter" });
                                setPlanModalOpen(true);
                              }}
                              title={t("WalkTimeFilter.lockedHint")}
                              aria-label={t("WalkTimeFilter.lockedHint")}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 hover:from-amber-200 hover:to-orange-200 transition-colors cursor-pointer"
                            >
                              🔒 Pro
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
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
                <PriceTrendChart records={filteredRecords} />
              </div>

              {result.weather && (
                <div className={pdfHide(pdfSections.weather)}>
                  <WeatherInfoCard weather={result.weather} />
                </div>
              )}

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
                <TransactionTable
                  records={filteredRecords}
                  isPdfExporting={pdfLoading}
                />
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
              {t("Empty.prompt")}
            </p>
            <p className="text-sm mt-1">
              {t("Empty.description")}
            </p>
          </div>
        )}
      </main>

      {/* 右下フローティング履歴ボタン（ログイン中のみ） */}
      {user && <HistoryList uid={user.uid} onReplay={handleReplay} />}

      {/* 左下フローティング ブログ導線（モバイルのみ — ヘッダーのリンクは sm 以上で表示） */}
      <Link
        href={`${locale === "en" ? "/en" : ""}/blog`}
        aria-label={t("Header.blogLink")}
        className="sm:hidden fixed bottom-6 left-6 z-[9999] inline-flex items-center gap-1.5 h-12 px-4 rounded-full bg-white border border-slate-200 text-slate-700 shadow-lg active:scale-95 transition-transform"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span className="text-sm font-semibold">{t("Header.blogLink")}</span>
      </Link>

      {/* プラン比較モーダル */}
      <PlanComparisonModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlan={user ? plan : null}
        uid={user?.uid ?? null}
        userEmail={user?.email ?? null}
        searchCountToday={searchCountToday}
      />

      {/* 主要エリアから探すリンク集（SEO内部リンク） */}
      <section className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t("Home.exploreTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {TOKYO_23_WARDS.map((a) => (
            <Link
              key={a.citySlug}
              href={`${locale === "en" ? "/en" : ""}/reports/${a.prefSlug}/${a.citySlug}`}
              className="inline-flex items-center text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2.5 py-1 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {locale === "en" ? a.cityEn : a.city}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-6 border-t border-slate-200 py-6 text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left space-y-0.5">
            <p>{t("Home.footerCredit")}</p>
            <p>{t("Home.footerMap")} <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">{t("Home.footerMapLink")}</a></p>
          </div>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="hover:text-slate-600 transition-colors">{t("Home.footerAbout")}</Link>
            <Link href={`${locale === "en" ? "/en" : ""}/blog`} className="hover:text-slate-600 transition-colors">{t("Header.blogLink")}</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">{t("Home.footerTerms")}</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">{t("Home.footerPrivacy")}</Link>
            <Link href="/about#legal" className="hover:text-slate-600 transition-colors">{t("Home.footerCommercial")}</Link>
            <Link href="/licenses" className="hover:text-slate-600 transition-colors">{t("Home.footerLicenses")}</Link>
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
