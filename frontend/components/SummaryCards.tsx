import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/api";
import type { TransactionSummary } from "@/types/api";

interface Props {
  summary: TransactionSummary;
}

export function SummaryCards({ summary }: Props) {
  const cards = [
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
      value: summary.avgUnitPrice
        ? `${Math.round(summary.avgUnitPrice / 10000).toLocaleString()}万円/㎡`
        : "—",
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
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
  );
}
