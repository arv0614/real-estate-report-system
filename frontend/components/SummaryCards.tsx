import { useTranslations } from "next-intl";
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
  const t = useTranslations("SummaryCards");

  const statsCards = [
    {
      title: t("dataCount"),
      value: t("dataCountValue", { count: summary.totalCount.toLocaleString() }),
      sub: t("dataCountSub"),
      icon: "📊",
    },
    {
      title: t("avgPrice"),
      value: formatPrice(summary.avgTradePrice),
      sub: t("median", { price: formatPrice(summary.medianTradePrice) }),
      icon: "💴",
    },
    {
      title: t("avgUnitPrice"),
      value: summary.avgUnitPrice ? formatUnitPrice(summary.avgUnitPrice) : "—",
      sub: t("avgUnitPriceSub"),
      icon: "📐",
    },
    {
      title: t("priceRange"),
      value: t("priceTo", { min: formatPrice(summary.minTradePrice) }),
      sub: t("priceMax", { max: formatPrice(summary.maxTradePrice) }),
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
        <>
        <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
          <span className="font-medium">{t("legend")}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />{t("legendNone")}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />{t("legendCaution")}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />{t("legendDanger")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* 洪水リスク */}
          <Card className={`border ${floodRiskColor(hazard.flood.hasRisk, hazard.flood.maxDepthRank)}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>🌊</span>
                {t("floodTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-xl font-bold leading-tight ${floodValueColor(hazard.flood.hasRisk, hazard.flood.maxDepthRank)}`}>
                {hazard.flood.hasRisk ? t("floodMaxDepth", { depth: hazard.flood.maxDepthLabel ?? "" }) : t("floodNone")}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hazard.flood.hasRisk ? t("floodInside") : t("floodOutside")}
              </p>
            </CardContent>
          </Card>

          {/* 土砂災害リスク */}
          <Card className={`border ${hazard.landslide.hasRisk ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>⛰️</span>
                {t("landslideTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-xl font-bold leading-tight ${hazard.landslide.hasRisk ? "text-red-700" : "text-green-700"}`}>
                {hazard.landslide.hasRisk ? t("landslideInside") : t("landslideNone")}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hazard.landslide.hasRisk && hazard.landslide.phenomena.length > 0
                  ? hazard.landslide.phenomena.join("・")
                  : t("landslideOutside")}
              </p>
            </CardContent>
          </Card>
        </div>
        </>
      ) : null}
    </div>
  );
}
