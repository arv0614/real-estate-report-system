"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { calcPropertyScore, gradeColor, gradeBg } from "@/lib/scoring";
import type { PropertyScore, ScoreGrade, SubScore } from "@/lib/scoring";
import type { AnalyzeResult } from "@/types/research";

// ── Sub-score bar ─────────────────────────────────────────────────────────────
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
        <span className="text-4xl font-black text-white tracking-tight">
          {grade}
        </span>
        <span className="text-white/70 text-xs mt-1">{overall}/100</span>
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
function gradeDescription(
  grade: ScoreGrade,
  mode: string,
  isEn: boolean
): string {
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

// ── Evidence panel ────────────────────────────────────────────────────────────
function EvidencePanel({ sub }: { sub: Extract<SubScore, { status: "ok" }> }) {
  return (
    <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
      {sub.evidence.map((e) => (
        <div key={e.label} className="flex items-start justify-between gap-2">
          <span className="text-slate-500 flex-shrink-0">{e.label}</span>
          {e.sourceUrl ? (
            <a
              href={e.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline flex items-center gap-0.5"
            >
              {e.value}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="font-medium text-slate-700">{e.value}</span>
          )}
        </div>
      ))}
      <p className="text-slate-400 pt-1.5 border-t border-slate-200 leading-relaxed">
        過去および公的統計に基づく参考指標であり、将来の価格や投資成果を保証するものではありません。
      </p>
    </div>
  );
}

// ── Sub-score row ─────────────────────────────────────────────────────────────
function SubScoreRow({
  label,
  sub,
  isExpanded,
  onToggle,
}: {
  label: string;
  sub: SubScore;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (sub.status === "insufficient") {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <span className="text-xs text-slate-400">— データ不足: {sub.reason}</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 group"
      >
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{sub.evidence[0]?.value ?? ""}</span>
          <span className="text-xs font-bold text-slate-800 w-6 text-right">
            {sub.value}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      <ScoreBar score={sub.value} color={scoreBarColor(sub.value)} />
      {isExpanded && <EvidencePanel sub={sub} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

export function ScoreCard({ result, isEn }: Props) {
  const { input, similar, hazard } = result;
  const prices = similar.map((t) => t.price);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const isInvestment = input.mode === "investment";

  const t = {
    title:     isEn ? "Overall Verdict"       : "総合判定",
    modeLabel: isInvestment
      ? isEn ? "Investment mode"   : "投資モード"
      : isEn ? "Home purchase mode" : "自宅購入モード",
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
    { key: "market",   label: t.market,   sub: score.market },
    { key: "disaster", label: t.disaster,  sub: score.disaster },
    { key: "future",   label: t.future,    sub: score.future },
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
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-5 space-y-4">
        {subRows.map(({ key, label, sub }) => (
          <SubScoreRow
            key={key}
            label={label}
            sub={sub}
            isExpanded={!!expanded[key]}
            onToggle={() => toggle(key)}
          />
        ))}
      </div>
    </div>
  );
}
