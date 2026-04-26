"use client";

import { useMemo, useState, useEffect } from "react";
import { ExternalLink, MapPin, BarChart2 } from "lucide-react";
import { calcPropertyScore, gradeColor, gradeBg } from "@/lib/scoring";
import type { PropertyScore, ScoreGrade, SubScore } from "@/lib/scoring";
import type { AnalyzeResult } from "@/types/research";
import { ScoreExplainer } from "./ScoreExplainer";
import type { CriterionRow } from "./ScoreExplainer";

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let elapsed = 0;
    const interval = 16;
    const timer = setInterval(() => {
      elapsed += interval;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return current;
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-green-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-red-400";
}

// ── Grade ring ────────────────────────────────────────────────────────────────
function GradeRing({
  grade,
  overall,
  mode,
}: {
  grade: ScoreGrade;
  overall: number;
  mode: string;
}) {
  const displayScore = useCountUp(overall);
  const isInvestment = mode === "investment";
  const accent = isInvestment
    ? "from-amber-500 to-orange-500"
    : "from-blue-500 to-indigo-600";
  const shadow = isInvestment ? "shadow-amber-200" : "shadow-blue-200";

  return (
    <div
      className={`relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br ${accent} shadow-xl ${shadow} flex-shrink-0`}
    >
      <div className="flex flex-col items-center leading-none">
        <span className="text-4xl font-black text-white tracking-tight animate-grade-bounce">
          {grade}
        </span>
        <span className="text-white/70 text-xs mt-1">{displayScore}/100</span>
      </div>
    </div>
  );
}

// ── Insufficient ring ─────────────────────────────────────────────────────────
function InsufficientRing() {
  return (
    <div className="flex items-center justify-center w-28 h-28 rounded-full border-4 border-dashed border-slate-300 bg-slate-50 flex-shrink-0">
      <span className="text-4xl font-black text-slate-400">—</span>
    </div>
  );
}

// ── Grade description ─────────────────────────────────────────────────────────
function gradeDescription(grade: ScoreGrade, mode: string, isEn: boolean): string {
  const isHome = mode === "home";
  if (isEn) {
    switch (grade) {
      case "A+": return isHome ? "Excellent fundamentals — low risk and strong value." : "Strong investment candidate with favorable indicators.";
      case "A":  return isHome ? "Solid property with good fundamentals." : "Good investment potential based on available data.";
      case "B+": return isHome ? "Generally favorable — a few factors to keep in mind." : "Moderate-to-good investment potential.";
      case "B":  return isHome ? "Reasonable option — some areas to review." : "Moderate return potential with some risk factors.";
      case "C":  return isHome ? "Caution advised — review risk details carefully." : "Elevated risk factors present.";
      case "D":  return isHome ? "Significant concerns found — careful review suggested." : "High risk profile based on available data.";
    }
  }
  switch (grade) {
    case "A+": return isHome ? "各指標が良好な物件です。相場・リスクともに参考値として優位な水準を示しています。" : "各指標が投資候補として有望な水準を示しています。";
    case "A":  return isHome ? "バランスの取れた良好な物件です。" : "投資パフォーマンスが期待できる水準です。";
    case "B+": return isHome ? "概ね良好ですが、一部の指標に注意が必要です。" : "まずまずの水準ですが、一部の指標を確認してください。";
    case "B":  return isHome ? "概ね問題ありませんが、一部確認が必要な指標があります。" : "投資リターンは中程度の水準です。";
    case "C":  return isHome ? "価格または災害リスクに注意が必要な指標があります。" : "リスク要因が見受けられます。慎重に検討ください。";
    case "D":  return isHome ? "複数の懸念点があります。詳細を確認の上、ご判断ください。" : "高リスクな水準を示しています。詳細をご確認ください。";
  }
}

function gradeRange(grade: ScoreGrade, isEn: boolean): string {
  const m: Record<ScoreGrade, [string, string, string]> = {
    "A+": ["85+",   "excellent",  "優秀"],
    "A":  ["75–84", "good",       "良好"],
    "B+": ["65–74", "above avg",  "平均以上"],
    "B":  ["55–64", "average",    "平均的"],
    "C":  ["45–54", "below avg",  "平均以下"],
    "D":  ["0–44",  "poor",       "低評価"],
  };
  const [range, en, ja] = m[grade];
  return isEn ? `${range} / ${en}` : `${range} / ${ja}`;
}

// ── Score breakdown (U21-3) ───────────────────────────────────────────────────
function PropertyScoreBreakdown({ score, isEn }: { score: PropertyScore; isEn: boolean }) {
  if (score.total.status !== "ok") return null;

  const items = [
    { label: isEn ? "Market" : "相場",     sub: score.market },
    { label: isEn ? "Disaster" : "災害",   sub: score.disaster },
    { label: isEn ? "Future" : "将来性",   sub: score.future },
  ];
  const avail = items.filter(
    (i): i is { label: string; sub: Extract<SubScore, { status: "ok" }> } =>
      i.sub.status === "ok"
  );
  const totalW = avail.reduce((s, i) => s + i.sub.weight, 0);

  return (
    <div className="mt-4 px-4 py-3 bg-white/60 rounded-xl border border-slate-200/70">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
        {isEn ? "Score breakdown" : "スコアの内訳"}
      </p>
      <div className="space-y-1 text-xs">
        {avail.map(({ label, sub }) => {
          const wPct = Math.round((sub.weight / totalW) * 100);
          const contrib = (sub.value * sub.weight / totalW).toFixed(1);
          return (
            <div key={label} className="flex items-center justify-between text-slate-600">
              <span>
                {label}{" "}
                <span className="text-slate-400">({wPct}%)</span>
              </span>
              <span className="tabular-nums">
                {sub.value} × {wPct}% ={" "}
                <strong className="text-slate-900">{contrib}</strong>
              </span>
            </div>
          );
        })}
        <div className="border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between font-bold text-sm">
          <span className="text-slate-700">{isEn ? "Total" : "合計"}</span>
          <span className="font-mono text-slate-900">{score.total.score} / 100</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {isEn
          ? `${score.total.score}/100 → Grade ${score.total.grade} (${gradeRange(score.total.grade, isEn)})`
          : `${score.total.score}/100 → ${score.total.grade} 評価（${gradeRange(score.total.grade, isEn)}）`}
      </p>
    </div>
  );
}

// ── Criteria builders for ScoreExplainer modals ───────────────────────────────
function buildPropertyMarketCriteria(
  inputPrice: number,
  similarPrices: number[],
  isEn: boolean
): CriterionRow[] {
  if (similarPrices.length < 5) {
    return [{
      label: isEn ? "Market comparison" : "相場比較",
      threshold: isEn ? "Requires ≥5 similar transactions" : "類似取引5件以上が必要",
      score: isEn ? "Insufficient" : "データ不足",
      matched: false,
    }];
  }
  const sorted = [...similarPrices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const diff = med > 0 ? (inputPrice - med) / med : 0;
  const pct = Math.round(Math.abs(diff) * 100);
  const sign = diff >= 0 ? "+" : "−";
  const s = diff <= -0.20 ? 95 : diff <= -0.10 ? 85 : diff <= 0 ? 73 : diff <= 0.10 ? 58 : diff <= 0.20 ? 43 : 25;
  return [{
    label: isEn ? "Price vs. similar-property median" : "入力価格 vs 類似物件中央値",
    threshold: isEn
      ? "≤−20% → 95pt  |  −20 to −10% → 85pt  |  −10 to 0% → 73pt  |  0 to +10% → 58pt  |  +10 to +20% → 43pt  |  >+20% → 25pt"
      : "-20%以下→95点 / -20〜-10%→85点 / -10〜0%→73点 / 0〜+10%→58点 / +10〜+20%→43点 / +20%超→25点",
    score: `${s}pt  (${inputPrice.toLocaleString()}万円 → ${sign}${pct}% vs 中央値 ${Math.round(med).toLocaleString()}万円)`,
    matched: true,
  }];
}

function buildDisasterCriteria(
  hazard: Parameters<typeof calcPropertyScore>[2],
  seismic: Parameters<typeof calcPropertyScore>[4],
  terrain: Parameters<typeof calcPropertyScore>[5],
  isEn: boolean
): CriterionRow[] {
  const rows: CriterionRow[] = [];

  if (seismic) {
    const p = seismic.prob30;
    const s = p >= 0.70 ? 15 : p >= 0.40 ? 35 : p >= 0.20 ? 55 : p >= 0.06 ? 75 : 90;
    rows.push({
      label: isEn ? "30-year earthquake probability" : "30年地震確率（震度6弱以上）",
      threshold: isEn
        ? "< 6% → 90pt  |  6–20% → 75pt  |  20–40% → 55pt  |  40–70% → 35pt  |  ≥70% → 15pt"
        : "6%未満→90点 / 6〜20%→75点 / 20〜40%→55点 / 40〜70%→35点 / 70%以上→15点",
      score: `${s}pt  (${seismic.probPct}% — ${seismic.riskLabel})`,
      matched: true,
    });
  }

  if (terrain) {
    const s = terrain.terrainRisk === "high" ? 25 : terrain.terrainRisk === "moderate" ? 60 : 90;
    const lbl = terrain.terrainRisk === "high"
      ? (isEn ? "high" : "高")
      : terrain.terrainRisk === "moderate"
      ? (isEn ? "moderate" : "中")
      : (isEn ? "low" : "低");
    rows.push({
      label: isEn ? "Terrain risk" : "地形リスク",
      threshold: isEn ? "Low → 90pt  |  Moderate → 60pt  |  High → 25pt" : "低→90点 / 中→60点 / 高→25点",
      score: `${s}pt  (${lbl}${terrain.terrainClass ? ` — ${terrain.terrainClass}` : ""})`,
      matched: true,
    });
  }

  if (hazard) {
    const rank = hazard.flood.maxDepthRank ?? 0;
    const land = hazard.landslide.hasRisk;
    const s = (rank >= 4 || land) ? 20 : rank >= 3 ? 40 : rank >= 1 ? 60 : 90;
    const ctx = rank === 0 && !land
      ? (isEn ? "No risk" : "区域外")
      : `${isEn ? "Rank" : "ランク"} ${rank}${land ? (isEn ? " + landslide" : " + 土砂") : ""}`;
    rows.push({
      label: isEn ? "Flood / landslide hazard" : "洪水・土砂災害リスク",
      threshold: isEn
        ? "No risk → 90pt  |  Rank 1-2 → 60pt  |  Rank 3 → 40pt  |  Rank 4+ / landslide → 20pt"
        : "区域外→90点 / ランク1-2→60点 / ランク3→40点 / ランク4以上・土砂→20点",
      score: `${s}pt  (${ctx})`,
      matched: true,
    });
  }

  if (rows.length === 0) {
    rows.push({
      label: isEn ? "No disaster data available" : "データ未取得",
      threshold: isEn ? "All components require data" : "災害データが取得できませんでした",
      score: "—",
      matched: false,
    });
  }
  return rows;
}

function buildFutureCriteria(
  population: Parameters<typeof calcPropertyScore>[6],
  mode: string,
  isEn: boolean
): CriterionRow[] {
  if (!population || population.history.length < 2) {
    return [{
      label: isEn ? "Population data unavailable" : "人口データ未取得",
      threshold: isEn ? "Requires e-Stat population data" : "e-Stat人口データが必要です",
      score: "—",
      matched: false,
    }];
  }
  const t = population.trend;
  const s = t >= 0.02 ? 90 : t >= 0.005 ? 78 : t >= -0.005 ? 65 : t >= -0.01 ? 50 : t >= -0.02 ? 35 : 18;
  const penalty = mode === "investment" && t < -0.005 ? Math.round(Math.abs(t) * 800) : 0;
  const final = Math.max(0, Math.min(100, s - penalty));
  const sign = t >= 0 ? "+" : "";
  const pct = (t * 100).toFixed(2);
  const rows: CriterionRow[] = [{
    label: isEn ? "Population annual growth rate (CAGR)" : "人口年平均変化率（CAGR）",
    threshold: isEn
      ? "≥+2%/yr → 90pt  |  +0.5–2% → 78pt  |  ±0.5% → 65pt  |  −0.5 to −1% → 50pt  |  −1 to −2% → 35pt  |  ≤−2% → 18pt"
      : "≥+2%/年→90点 / +0.5〜2%→78点 / ±0.5%→65点 / -0.5〜-1%→50点 / -1〜-2%→35点 / -2%以下→18点",
    score: `${s}pt  (${sign}${pct}%/年 — ${population.cityName})`,
    matched: true,
  }];
  if (penalty > 0) {
    rows.push({
      label: isEn ? "Investment mode adjustment" : "投資モード追加調整",
      threshold: isEn ? "Population decline amplified in investment mode" : "投資モードでは人口減少のペナルティを加算",
      score: `−${penalty}pt → ${final}pt`,
      matched: true,
    });
  }
  return rows;
}

// ── Insufficient CTAs ─────────────────────────────────────────────────────────
function InsufficientCTAs({
  isEn,
  onScrollToMap,
}: {
  isEn: boolean;
  onScrollToMap?: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
      <p className="text-xs text-amber-800 font-medium">
        {isEn
          ? "Not enough data to calculate an overall grade. Try these options:"
          : "総合判定に必要なデータが不足しています。以下を試してみてください："}
      </p>
      <div className="flex flex-wrap gap-2">
        {onScrollToMap && (
          <button
            type="button"
            onClick={onScrollToMap}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <MapPin className="w-3 h-3" />
            {isEn ? "Explore nearby on map" : "近隣を地図で探す"}
          </button>
        )}
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-400 cursor-not-allowed"
          title={isEn ? "Coming soon" : "近日公開予定"}
        >
          <BarChart2 className="w-3 h-3" />
          {isEn ? "Show city-level reference" : "市区町村レベルの参考値を表示"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-score row ─────────────────────────────────────────────────────────────
function SubScoreRow({
  label,
  sub,
  explainer,
  insufficientMeta,
}: {
  label: string;
  sub: SubScore;
  explainer?: React.ReactNode;
  insufficientMeta?: React.ReactNode;
}) {
  if (sub.status === "insufficient") {
    return (
      <div>
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{label}</span>
            {explainer}
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">— データ不足: {sub.reason}</span>
            {insufficientMeta && <div className="mt-0.5">{insufficientMeta}</div>}
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          {explainer}
        </div>
        <span className="text-xs font-bold text-slate-800 tabular-nums w-6 text-right">
          {sub.value}
        </span>
      </div>
      <ScoreBar score={sub.value} color={scoreBarColor(sub.value)} />
      <ul className="mt-1.5 space-y-0.5 pl-0.5">
        {sub.evidence.map((e) => (
          <li key={e.label} className="flex items-baseline gap-1.5 text-xs text-slate-600">
            <span className="text-slate-400 flex-shrink-0">•</span>
            <span>
              {e.label}:{" "}
              {e.sourceUrl ? (
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-800 hover:text-blue-600 inline-flex items-center gap-0.5"
                >
                  {e.value}
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                </a>
              ) : (
                <strong className="text-slate-800">{e.value}</strong>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
  onScrollToMap?: () => void;
}

export function ScoreCard({ result, isEn, onScrollToMap }: Props) {
  const { input, similar, hazard, searchRange, searchRangeLabel } = result;
  const prices = similar.map((t) => t.price);

  const score: PropertyScore = useMemo(
    () =>
      calcPropertyScore(
        input.price ?? 0,
        prices,
        hazard,
        input.mode,
        result.seismic,
        result.terrain,
        result.population
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.price,
      input.mode,
      JSON.stringify(prices),
      hazard,
      result.seismic,
      result.terrain,
      result.population,
    ]
  );

  const isInvestment = input.mode === "investment";
  const propertyType = input.propertyType ?? "mansion";
  const typeLbl = propertyType === "house"
    ? (isEn ? "🏠 House" : "🏠 戸建")
    : (isEn ? "🏢 Apartment" : "🏢 マンション");

  const marketNeeded = Math.max(0, 5 - similar.length);

  const sourceNote = isEn
    ? "Sources: MLIT real estate transaction data, J-SHIS (earthquake probability), GSI (terrain / elevation), e-Stat population statistics."
    : "出典: 国交省不動産取引価格情報 / J-SHIS地震ハザード / 国土地理院（地形・標高）/ e-Stat人口推計";

  // Weights depend on mode
  const mktWeight = isInvestment ? 50 : 35;
  const disWeight = isInvestment ? 20 : 45;
  const futWeight = isInvestment ? 30 : 20;

  const t = {
    title:     isEn ? "Overall Verdict"       : "総合判定",
    modeLabel: isInvestment
      ? (isEn ? "Investment mode"   : "投資モード")
      : (isEn ? "Home purchase mode" : "自宅購入モード"),
    market:    isEn ? "Market Price"           : "相場",
    disaster:  isEn ? "Disaster Risk"          : "災害リスク",
    future:    isEn ? "Population Trend Score" : "人口動態トレンドスコア（参考値）",
    dataNote:  isEn
      ? `Based on ${score.dataCount} similar transactions`
      : `類似物件${score.dataCount}件のデータに基づく`,
    noData:    isEn ? "Insufficient comparison data" : "比較データ不足",
    insufficient: isEn ? "Insufficient data to calculate overall grade." : "算出に必要なデータが不足しています。",
  };

  const subRows = [
    {
      key: "market",
      label: t.market,
      sub: score.market,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How market price score is calculated" : "相場スコアの計算方法"}
          weight={isEn ? `${mktWeight}% of overall score` : `総合評価の ${mktWeight}%`}
          criteria={buildPropertyMarketCriteria(input.price ?? 0, prices, isEn)}
          totalScore={score.market.status === "ok" ? score.market.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
      meta: score.market.status === "insufficient" && marketNeeded > 0
        ? (
          <span className="text-xs text-amber-600 font-medium">
            {isEn ? `${marketNeeded} more needed` : `あと${marketNeeded}件必要`}
          </span>
        )
        : undefined,
    },
    {
      key: "disaster",
      label: t.disaster,
      sub: score.disaster,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How disaster risk is calculated" : "災害リスクの計算方法"}
          weight={isEn ? `${disWeight}% of overall score` : `総合評価の ${disWeight}%`}
          criteria={buildDisasterCriteria(hazard, result.seismic, result.terrain, isEn)}
          totalScore={score.disaster.status === "ok" ? score.disaster.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
      meta: undefined,
    },
    {
      key: "future",
      label: t.future,
      sub: score.future,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How population trend is calculated" : "人口動態の計算方法"}
          weight={isEn ? `${futWeight}% of overall score` : `総合評価の ${futWeight}%`}
          criteria={buildFutureCriteria(result.population, input.mode, isEn)}
          totalScore={score.future.status === "ok" ? score.future.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
      meta: undefined,
    },
  ];

  const bgClass =
    score.total.status === "ok"
      ? gradeBg(score.total.grade)
      : "bg-slate-50 border-slate-200";

  return (
    <div className={`rounded-2xl border-2 p-6 shadow-sm ${bgClass}`}>
      {/* Header row */}
      <div className="flex items-start gap-5">
        {score.total.status === "ok" ? (
          <GradeRing
            grade={score.total.grade}
            overall={score.total.score}
            mode={input.mode}
          />
        ) : (
          <InsufficientRing />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-bold text-slate-900">{t.title}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isInvestment
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {t.modeLabel}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
              {typeLbl}
            </span>
          </div>

          {score.total.status === "ok" ? (
            <>
              <p className="text-sm text-slate-700 mb-2 leading-relaxed">
                {gradeDescription(score.total.grade, input.mode, isEn)}
              </p>
              {score.total.note && (
                <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {score.total.note}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">{t.insufficient}</p>
          )}

          <p className="text-xs text-slate-400 mt-2">
            {score.dataCount >= 5 ? t.dataNote : t.noData}
          </p>

          {/* Search range badge */}
          {searchRange && searchRangeLabel && (
            <span className={`inline-block text-xs mt-1 px-2 py-0.5 rounded-full ${
              searchRange === "strict"
                ? "bg-emerald-50 text-emerald-700"
                : searchRange === "city"
                ? "bg-blue-50 text-blue-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              {isEn ? `Search scope: ${searchRange}` : `比較範囲: ${searchRangeLabel}`}
            </span>
          )}

          {/* Score breakdown table (U21-3) */}
          <PropertyScoreBreakdown score={score} isEn={isEn} />
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-5 space-y-5">
        {subRows.map(({ key, label, sub, explainer, meta }) => (
          <SubScoreRow
            key={key}
            label={label}
            sub={sub}
            explainer={explainer}
            insufficientMeta={meta}
          />
        ))}
      </div>

      {/* Insufficient CTAs */}
      {score.total.status === "insufficient" && (
        <InsufficientCTAs isEn={isEn} onScrollToMap={onScrollToMap} />
      )}
    </div>
  );
}
