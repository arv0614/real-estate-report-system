import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, formatUnitPrice } from "@/lib/api";
import type { HazardInfo, TransactionSummary } from "@/types/api";

interface Props {
  summary: TransactionSummary;
  hazard?: HazardInfo;
}

function floodRiskColor(hasRisk: boolean, rank: number | null) {
  if (!hasRisk) return "bg-green-50 border-green-200";
  if (rank !== null && rank >= 3) return "bg-red-50 border-red-200";
  return "bg-amber-50 border-amber-200";
}

function floodValueColor(hasRisk: boolean, rank: number | null) {
  if (!hasRisk) return "text-green-700";
  if (rank !== null && rank >= 3) return "text-red-700";
  return "text-amber-700";
}

export function SummaryCards({ summary, hazard }: Props) {
  const statsCards = [
    {
      title: "データ件数",
      value: `${summary.totalCount.toLocaleString()} 件`,
      sub: "取得した取引事例数",
      icon: "📊",
    },
    {
      title: "平均取引価格",
      value: formatPrice(summary.avgTradePrice),
      sub: `中央値: ${formatPrice(summary.medianTradePrice)}`,
      icon: "💴",
    },
    {
      title: "平均㎡単価",
      value: summary.avgUnitPrice ? formatUnitPrice(summary.avgUnitPrice) : "—",
      sub: "（単価データが存在する物件のみ）",
      icon: "📐",
    },
    {
      title: "取引価格レンジ",
      value: `${formatPrice(summary.minTradePrice)} 〜`,
      sub: `最高: ${formatPrice(summary.maxTradePrice)}`,
      icon: "📈",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsCards.map((c) => (
          <Card key={c.title} className="bg-white">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>{c.icon}</span>
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold text-slate-800 leading-tight">{c.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hazard ? (
        <div className="grid grid-cols-2 gap-3">
          {/* 洪水リスク */}
          <Card className={`border ${floodRiskColor(hazard.flood.hasRisk, hazard.flood.maxDepthRank)}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>🌊</span>
                洪水浸水想定区域
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-xl font-bold leading-tight ${floodValueColor(hazard.flood.hasRisk, hazard.flood.maxDepthRank)}`}>
                {hazard.flood.hasRisk ? `最大 ${hazard.flood.maxDepthLabel}` : "該当なし"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hazard.flood.hasRisk ? "浸水想定区域内（想定最大規模）" : "浸水想定区域外"}
              </p>
            </CardContent>
          </Card>

          {/* 土砂災害リスク */}
          <Card className={`border ${hazard.landslide.hasRisk ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>⛰️</span>
                土砂災害警戒区域
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-xl font-bold leading-tight ${hazard.landslide.hasRisk ? "text-red-700" : "text-green-700"}`}>
                {hazard.landslide.hasRisk ? "警戒区域内" : "該当なし"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hazard.landslide.hasRisk && hazard.landslide.phenomena.length > 0
                  ? hazard.landslide.phenomena.join("・")
                  : "土砂災害警戒区域外"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
