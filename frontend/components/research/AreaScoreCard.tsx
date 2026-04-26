"use client";

import { useMemo, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { calcAreaScore, gradeBg } from "@/lib/scoring/areaScore";
import type { AreaScore, ScoreGrade, SubScore } from "@/lib/scoring/areaScore";
import type { AreaSummaryResult } from "@/app/[locale]/research/area/areaActions";
import type { SeismicData, TerrainData, PopulationData } from "@/types/research";
import type { HazardInfo } from "@/types/api";
import { ScoreExplainer } from "./ScoreExplainer";
import type { CriterionRow } from "./ScoreExplainer";

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 16;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return current;
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
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
function GradeRing({ grade, overall }: { grade: ScoreGrade; overall: number }) {
  const displayScore = useCountUp(overall);
  return (
    <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 shadow-xl shadow-teal-200 flex-shrink-0">
      <div className="flex flex-col items-center leading-none">
        <span className="text-4xl font-black text-white tracking-tight animate-grade-bounce">{grade}</span>
        <span className="text-white/70 text-xs mt-1">{displayScore}/100</span>
      </div>
    </div>
  );
}

function InsufficientRing() {
  return (
    <div className="flex items-center justify-center w-28 h-28 rounded-full border-4 border-dashed border-slate-300 bg-slate-50 flex-shrink-0">
      <span className="text-4xl font-black text-slate-400">—</span>
    </div>
  );
}

// ── Grade helpers ─────────────────────────────────────────────────────────────
function gradeDescription(grade: ScoreGrade, isEn: boolean): string {
  if (isEn) {
    switch (grade) {
      case "A+": return "Excellent area — low disaster risk and favorable population trend.";
      case "A":  return "Good area with solid fundamentals.";
      case "B+": return "Generally favorable — some factors worth keeping in mind.";
      case "B":  return "Reasonable area — some aspects to review carefully.";
      case "C":  return "Caution advised — notable risk factors present.";
      case "D":  return "Significant concerns found — careful review suggested.";
    }
  }
  switch (grade) {
    case "A+": return "各指標が良好なエリアです。災害リスク・人口動態ともに優位な水準を示しています。";
    case "A":  return "バランスの取れた良好なエリアです。";
    case "B+": return "概ね良好ですが、一部の指標に注意が必要です。";
    case "B":  return "概ね問題ありませんが、一部確認が必要な指標があります。";
    case "C":  return "災害リスクまたは人口動態に注意が必要な指標があります。";
    case "D":  return "複数の懸念点があります。詳細を確認の上、ご判断ください。";
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
function ScoreBreakdown({ score, isEn }: { score: AreaScore; isEn: boolean }) {
  if (score.total.status !== "ok") return null;

  const items = [
    { label: isEn ? "Disaster" : "災害リスク",  sub: score.disaster },
    { label: isEn ? "Population" : "人口動態",  sub: score.future },
    { label: isEn ? "Market" : "市場活性度",    sub: score.marketActivity },
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
function buildDisasterCriteria(
  seismic: SeismicData | null,
  terrain: TerrainData | null,
  hazard: HazardInfo | null,
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
      threshold: isEn
        ? "Low → 90pt  |  Moderate → 60pt  |  High → 25pt"
        : "低→90点 / 中→60点 / 高→25点",
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
      label: isEn ? "No data available" : "データ未取得",
      threshold: isEn ? "All disaster components require data" : "災害データが取得できませんでした",
      score: "—",
      matched: false,
    });
  }

  return rows;
}

function buildFutureCriteria(population: PopulationData | null, isEn: boolean): CriterionRow[] {
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
  const sign = t >= 0 ? "+" : "";
  const pct = (t * 100).toFixed(2);
  return [{
    label: isEn ? "Population annual growth rate (CAGR)" : "人口年平均変化率（CAGR）",
    threshold: isEn
      ? "≥+2%/yr → 90pt  |  +0.5–2% → 78pt  |  ±0.5% → 65pt  |  −0.5 to −1% → 50pt  |  −1 to −2% → 35pt  |  ≤−2% → 18pt"
      : "≥+2%/年→90点 / +0.5〜2%→78点 / ±0.5%→65点 / -0.5〜-1%→50点 / -1〜-2%→35点 / -2%以下→18点",
    score: `${s}pt  (${sign}${pct}%/年 — ${population.cityName})`,
    matched: true,
  }];
}

function buildMarketActivityCriteria(txCount: number, isEn: boolean): CriterionRow[] {
  const s = txCount === 0 ? null
    : txCount >= 50 ? 90 : txCount >= 20 ? 80 : txCount >= 10 ? 70 : txCount >= 5 ? 60 : 40;
  return [{
    label: isEn ? "Transaction count in tile" : "タイル内取引件数",
    threshold: isEn
      ? "≥50 → 90pt  |  20-49 → 80pt  |  10-19 → 70pt  |  5-9 → 60pt  |  1-4 → 40pt  |  0 → insufficient"
      : "50件以上→90点 / 20〜49件→80点 / 10〜19件→70点 / 5〜9件→60点 / 1〜4件→40点 / 0件→データ不足",
    score: s !== null ? `${s}pt  (${txCount}件)` : (isEn ? "Insufficient data" : "データ不足"),
    matched: txCount > 0,
  }];
}

// ── Sub-score row ─────────────────────────────────────────────────────────────
function SubScoreRow({ label, sub, explainer }: {
  label: string;
  sub: SubScore;
  explainer?: React.ReactNode;
}) {
  if (sub.status === "insufficient") {
    return (
      <div>
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{label}</span>
            {explainer}
          </div>
          <span className="text-xs text-slate-400">— データ不足: {sub.reason}</span>
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
        <span className="text-xs font-bold text-slate-800 tabular-nums">{sub.value}</span>
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
                  {e.value}<ExternalLink className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
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
  result: AreaSummaryResult;
  isEn: boolean;
  txCount: number;
}

export function AreaScoreCard({ result, isEn, txCount }: Props) {
  const score: AreaScore = useMemo(
    () => calcAreaScore(result.hazard, result.seismic, result.terrain, result.population, txCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.hazard, result.seismic, result.terrain, result.population, txCount]
  );

  const bgClass = score.total.status === "ok" ? gradeBg(score.total.grade) : "bg-slate-50 border-slate-200";

  const sourceNote = isEn
    ? "Sources: J-SHIS (earthquake probability), GSI (terrain / elevation), MLIT real estate transaction data, e-Stat population statistics."
    : "出典: J-SHIS地震ハザードステーション / 国土地理院（地形・標高）/ 国交省不動産取引価格情報 / e-Stat人口推計";

  const t = {
    title:    isEn ? "Area Verdict"     : "エリア総合評価",
    badge:    isEn ? "Area analysis"    : "エリア分析",
    disaster: isEn ? "Disaster Risk"    : "災害リスク",
    future:   isEn ? "Population Trend" : "人口動態",
    market:   isEn ? "Market Activity"  : "市場活性度",
    insufficient: isEn
      ? "Insufficient data to calculate overall grade."
      : "算出に必要なデータが不足しています。",
  };

  const subRows = [
    {
      key: "disaster",
      label: t.disaster,
      sub: score.disaster,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How disaster risk is calculated" : "災害リスクの計算方法"}
          weight={isEn ? "50% of overall score" : "総合評価の 50%"}
          criteria={buildDisasterCriteria(result.seismic, result.terrain, result.hazard, isEn)}
          totalScore={score.disaster.status === "ok" ? score.disaster.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
    },
    {
      key: "future",
      label: t.future,
      sub: score.future,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How population trend is calculated" : "人口動態の計算方法"}
          weight={isEn ? "30% of overall score" : "総合評価の 30%"}
          criteria={buildFutureCriteria(result.population, isEn)}
          totalScore={score.future.status === "ok" ? score.future.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
    },
    {
      key: "marketActivity",
      label: t.market,
      sub: score.marketActivity,
      explainer: (
        <ScoreExplainer
          title={isEn ? "How market activity is calculated" : "市場活性度の計算方法"}
          weight={isEn ? "20% of overall score" : "総合評価の 20%"}
          criteria={buildMarketActivityCriteria(txCount, isEn)}
          totalScore={score.marketActivity.status === "ok" ? score.marketActivity.value : 0}
          sourceNote={sourceNote}
          isEn={isEn}
        />
      ),
    },
  ];

  return (
    <div className={`rounded-2xl border-2 p-6 shadow-sm ${bgClass}`}>
      <div className="flex items-start gap-5">
        {score.total.status === "ok" ? (
          <GradeRing grade={score.total.grade} overall={score.total.score} />
        ) : (
          <InsufficientRing />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-bold text-slate-900">{t.title}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{t.badge}</span>
          </div>

          {score.total.status === "ok" ? (
            <>
              <p className="text-sm text-slate-700 mb-2 leading-relaxed">
                {gradeDescription(score.total.grade, isEn)}
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

          <ScoreBreakdown score={score} isEn={isEn} />
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {subRows.map(({ key, label, sub, explainer }) => (
          <SubScoreRow key={key} label={label} sub={sub} explainer={explainer} />
        ))}
      </div>
    </div>
  );
}
