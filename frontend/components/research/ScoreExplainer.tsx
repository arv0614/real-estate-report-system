"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export interface CriterionRow {
  label: string;
  threshold: string;
  score: string;
  matched: boolean;
}

interface Props {
  title: string;
  weight: string;
  criteria: CriterionRow[];
  totalScore: number;
  sourceNote: string;
  isEn: boolean;
}

export function ScoreExplainer({ title, weight, criteria, totalScore, sourceNote, isEn }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isEn ? "How is this calculated?" : "計算方法を見る"}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-slate-200 transition-colors flex-shrink-0"
      >
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                {isEn ? "Weight in overall score:" : "総合評価への影響度:"}{" "}
                <strong className="text-slate-800">{weight}</strong>
              </p>

              <div className="space-y-2">
                {criteria.map((c, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-xs ${
                      c.matched
                        ? "bg-teal-50 border-teal-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <span className="font-semibold text-slate-700">{c.label}</span>
                      <span className={`font-bold tabular-nums flex-shrink-0 ${c.matched ? "text-teal-700" : "text-slate-400"}`}>
                        {c.score}
                      </span>
                    </div>
                    <p className="text-slate-500 leading-relaxed">{c.threshold}</p>
                    {c.matched && (
                      <p className="text-teal-700 mt-1 font-medium">
                        ✓ {isEn ? "Your area matches this" : "このエリアが該当"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-700">{isEn ? "Subscore:" : "サブスコア:"}</span>
                <span className="font-mono text-slate-900">{totalScore} / 100</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">{sourceNote}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
