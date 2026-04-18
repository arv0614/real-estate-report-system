"use client";

import { useMemo } from "react";
import { calcPropertyScore, gradeColor, gradeBg } from "@/lib/scoring";
import type { PropertyScore, ScoreGrade } from "@/lib/scoring";
import type { AnalyzeResult } from "@/types/research";

// ── Sub-score bar ────────────────────────────────────────────
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

// ── Grade ring ───────────────────────────────────────────────
function GradeRing({ grade, overall, mode }: { grade: ScoreGrade; overall: number; mode: string }) {
  const isInvestment = mode === "investment";
  const accent = isInvestment ? "from-amber-500 to-orange-500" : "from-blue-500 to-indigo-600";
  const shadow  = isInvestment ? "shadow-amber-200" : "shadow-blue-200";

  return (
    <div
      className={`relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br ${accent} shadow-xl ${shadow} flex-shrink-0`}
    >
      <div className="flex flex-col items-center leading-none">
        <span className={`text-4xl font-black text-white tracking-tight ${gradeColor(grade).replace("text-", "drop-shadow-")}`}>
          {grade}
        </span>
        <span className="text-white/70 text-xs mt-1">{overall}/100</span>
      </div>
    </div>
  );
}

// ── Disaster label ───────────────────────────────────────────
function hazardLabel(score: number, isEn: boolean): string {
  if (score >= 85) return isEn ? "Low risk"     : "リスク低";
  if (score >= 60) return isEn ? "Moderate"     : "中程度";
  if (score >= 40) return isEn ? "Elevated risk" : "やや高リスク";
  return isEn ? "High risk" : "高リスク";
}

function gradeDescription(grade: ScoreGrade, mode: string, isEn: boolean): string {
  const isHome = mode === "home";
  if (isEn) {
    switch (grade) {
      case "A+": return isHome ? "Excellent choice — low risk and great value." : "Strong investment candidate.";
      case "A":  return isHome ? "Good property with solid fundamentals."       : "Good investment potential.";
      case "B":  return isHome ? "Reasonable option — some factors to watch."   : "Moderate return potential.";
      case "C":  return isHome ? "Caution advised — review the details."        : "Risk factors present.";
      case "D":  return isHome ? "Significant concerns found."                  : "High risk investment.";
    }
  }
  switch (grade) {
    case "A+": return isHome ? "優良物件です。相場・リスクともに良好。"       : "投資候補として非常に有望です。";
    case "A":  return isHome ? "バランスの取れた良物件です。"                 : "投資パフォーマンスが期待できます。";
    case "B":  return isHome ? "概ね問題ありませんが、一部確認が必要です。"   : "投資リターンは中程度です。";
    case "C":  return isHome ? "価格または災害リスクに注意が必要です。"       : "リスク要因があります。慎重に検討を。";
    case "D":  return isHome ? "複数の懸念点があります。再検討を推奨します。" : "高リスク物件です。";
  }
}

// ── Main component ───────────────────────────────────────────
interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

export function ScoreCard({ result, isEn }: Props) {
  const { input, similar, hazard } = result;
  const prices = similar.map((t) => t.price);

  const score: PropertyScore = useMemo(
    () =>
      calcPropertyScore(
        input.price,
        prices,
        hazard,
        input.mode,
        result.seismic,
        result.terrain,
        result.population
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.price, input.mode, JSON.stringify(prices), hazard, result.seismic, result.terrain, result.population]
  );

  const isInvestment = input.mode === "investment";

  const t = {
    title:        isEn ? "Overall Verdict"        : "総合判定",
    modeLabel:    isInvestment
                    ? (isEn ? "Investment mode"     : "投資モード")
                    : (isEn ? "Home purchase mode"  : "自宅購入モード"),
    market:       isEn ? "Market Price"            : "相場",
    disaster:     isEn ? "Disaster Risk"           : "災害リスク",
    future:       isEn ? "Future Outlook"          : "将来性",
    dataNote:     isEn
                    ? `Based on ${score.dataCount} similar transactions`
                    : `類似物件${score.dataCount}件のデータに基づく`,
    noData:       isEn ? "Insufficient comparison data" : "比較データ不足",
  };

  const subScores = [
    {
      label: t.market,
      score: score.market,
      note:  score.marketNote,
      color: scoreBarColor(score.market),
    },
    {
      label: t.disaster,
      score: score.disaster,
      note:  score.disasterNote || hazardLabel(score.disaster, isEn),
      color: scoreBarColor(score.disaster),
    },
    {
      label: `${t.future}`,
      score: score.future,
      note:  score.futureNote,
      color: scoreBarColor(score.future),
    },
  ];

  return (
    <div className={`rounded-2xl border-2 p-6 shadow-sm ${gradeBg(score.grade)}`}>
      {/* Header row */}
      <div className="flex items-start gap-5">
        <GradeRing grade={score.grade} overall={score.overall} mode={input.mode} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
          </div>

          <p className="text-sm text-slate-700 mb-3 leading-relaxed">
            {gradeDescription(score.grade, input.mode, isEn)}
          </p>

          <p className="text-xs text-slate-400">
            {score.dataCount >= 3 ? t.dataNote : t.noData}
          </p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-5 space-y-3">
        {subScores.map(({ label, score: s, note, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-600">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{note}</span>
                <span className="text-xs font-bold text-slate-800 w-6 text-right">{s}</span>
              </div>
            </div>
            <ScoreBar score={s} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}
