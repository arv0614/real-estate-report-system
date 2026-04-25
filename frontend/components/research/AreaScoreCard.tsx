"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { calcAreaScore, gradeBg } from "@/lib/scoring/areaScore";
import type { AreaScore, ScoreGrade, SubScore } from "@/lib/scoring/areaScore";
import type { AreaSummaryResult } from "@/app/[locale]/research/area/areaActions";

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

function EvidencePanel({ sub }: { sub: Extract<SubScore, { status: "ok" }> }) {
  return (
    <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
      {sub.evidence.map((e) => (
        <div key={e.label} className="flex items-start justify-between gap-2">
          <span className="text-slate-500 flex-shrink-0">{e.label}</span>
          {e.sourceUrl ? (
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline flex items-center gap-0.5">
              {e.value}<ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="font-medium text-slate-700">{e.value}</span>
          )}
        </div>
      ))}
      <p className="text-slate-400 pt-1.5 border-t border-slate-200 leading-relaxed">
        過去および公的統計に基づく参考指標です。将来の価格や投資成果を保証するものではありません。
      </p>
    </div>
  );
}

function SubScoreRow({ label, sub, isExpanded, onToggle }: {
  label: string;
  sub: SubScore;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (sub.status === "insufficient") {
    return (
      <div>
        <div className="flex items-start justify-between mb-1 gap-2">
          <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{label}</span>
          <span className="text-xs text-slate-400">— データ不足: {sub.reason}</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full" />
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-1 group">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{sub.evidence[0]?.value ?? ""}</span>
          <span className="text-xs font-bold text-slate-800 w-6 text-right">{sub.value}</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      <ScoreBar score={sub.value} color={scoreBarColor(sub.value)} />
      {isExpanded && <EvidencePanel sub={sub} />}
    </div>
  );
}

interface Props {
  result: AreaSummaryResult;
  isEn: boolean;
  txCount: number;
}

export function AreaScoreCard({ result, isEn, txCount }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const score: AreaScore = useMemo(
    () => calcAreaScore(result.hazard, result.seismic, result.terrain, result.population, txCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.hazard, result.seismic, result.terrain, result.population, txCount]
  );

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const bgClass = score.total.status === "ok" ? gradeBg(score.total.grade) : "bg-slate-50 border-slate-200";

  const t = {
    title:        isEn ? "Area Verdict"      : "エリア総合評価",
    badge:        isEn ? "Area analysis"     : "エリア分析",
    disaster:     isEn ? "Disaster Risk"     : "災害リスク",
    future:       isEn ? "Population Trend"  : "人口動態",
    market:       isEn ? "Market Activity"   : "市場活性度",
    insufficient: isEn ? "Insufficient data to calculate overall grade." : "算出に必要なデータが不足しています。",
  };

  const subRows = [
    { key: "disaster",       label: t.disaster, sub: score.disaster },
    { key: "future",         label: t.future,   sub: score.future },
    { key: "marketActivity", label: t.market,   sub: score.marketActivity },
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
        </div>
      </div>

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
