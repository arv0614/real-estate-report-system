"use client";

import type { AnalyzeResult, SimilarTx } from "@/types/research";

interface ComparisonPoint {
  label: string;
  labelEn: string;
  dot: string;
  tx: SimilarTx;
  note: string;
  noteEn: string;
}

function pickComparisons(
  similar: SimilarTx[],
  inputPrice: number,
  inputArea: number
): ComparisonPoint[] {
  if (similar.length === 0) return [];

  const sorted = [...similar].sort((a, b) => a.price - b.price);
  const inputUnitPrice = inputArea > 0 ? inputPrice / inputArea : 0;

  const points: ComparisonPoint[] = [];

  // 1. Same-level: closest price to input (green)
  const sameLevelIdx = sorted.reduce((best, tx, i) => {
    return Math.abs(tx.price - inputPrice) < Math.abs(sorted[best].price - inputPrice) ? i : best;
  }, 0);
  const sameLevel = sorted[sameLevelIdx];
  points.push({
    label: "同水準物件",
    labelEn: "Similar price",
    dot: "bg-emerald-400",
    tx: sameLevel,
    note: "入力価格に最も近い取引事例",
    noteEn: "Closest match to your input price",
  });

  // 2. Cheaper: largest discount vs input (yellow)
  const cheaper = sorted[0];
  if (cheaper !== sameLevel && cheaper.price < inputPrice * 0.9) {
    points.push({
      label: "割安物件",
      labelEn: "Cheaper option",
      dot: "bg-amber-400",
      tx: cheaper,
      note: `入力価格より${Math.round((1 - cheaper.price / inputPrice) * 100)}%安い取引事例`,
      noteEn: `${Math.round((1 - cheaper.price / inputPrice) * 100)}% cheaper than your input`,
    });
  }

  // 3. Premium / high unit price (red if >20% more expensive per m²)
  const priciest = sorted[sorted.length - 1];
  const priceyUnitPrice = priciest.area > 0 ? priciest.price / priciest.area : 0;
  if (
    priciest !== sameLevel &&
    inputUnitPrice > 0 &&
    priceyUnitPrice > inputUnitPrice * 1.2
  ) {
    points.push({
      label: "割高物件",
      labelEn: "Higher-priced",
      dot: "bg-red-400",
      tx: priciest,
      note: `坪単価が入力より${Math.round((priceyUnitPrice / inputUnitPrice - 1) * 100)}%高い取引事例`,
      noteEn: `Unit price ${Math.round((priceyUnitPrice / inputUnitPrice - 1) * 100)}% higher`,
    });
  } else if (priciest !== sameLevel && points.length < 3) {
    // Fallback: just show highest
    points.push({
      label: "高額物件",
      labelEn: "Higher end",
      dot: "bg-slate-400",
      tx: priciest,
      note: "取得データ内の最高額取引事例",
      noteEn: "Highest priced transaction in data",
    });
  }

  return points.slice(0, 3);
}

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
  isEn: boolean;
}

export function NearbyComparisons({ result, isEn }: Props) {
  const { similar, input } = result;
  if (similar.length < 3) return null;

  const points = pickComparisons(similar, input.price, input.area);
  if (points.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-900 mb-3">
        {isEn ? "Nearby Comparison Points" : "近隣比較事例（自動抽出）"}
      </h3>
      <div className="space-y-3">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${p.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {isEn ? p.labelEn : p.label}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {p.tx.price.toLocaleString()}
                  <span className="font-normal text-slate-500">万円</span>
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                <span>{p.tx.area}㎡</span>
                <span>{isEn ? "Built" : "築"}{p.tx.year}{isEn ? "" : "年"}</span>
                <span>{p.tx.period}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn ? p.noteEn : p.note}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
        {isEn
          ? "Auto-selected from similar transactions fetched from MLIT data."
          : "国土交通省不動産取引価格情報をもとに自動抽出した参考事例です。"}
      </p>
    </div>
  );
}
