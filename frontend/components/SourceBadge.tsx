import { Badge } from "@/components/ui/badge";

interface Props {
  source: "api" | "cache" | "mock";
}

const config = {
  api: {
    label: "APIから取得",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: "🌐",
  },
  cache: {
    label: "キャッシュから返却",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "⚡",
  },
  mock: {
    label: "モックデータ",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: "🔧",
  },
} as const;

export function SourceBadge({ source }: Props) {
  const { label, className, icon } = config[source];
  return (
    <Badge variant="outline" className={`text-xs font-medium ${className}`}>
      {icon} {label}
    </Badge>
  );
}
