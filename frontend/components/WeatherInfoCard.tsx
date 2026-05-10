import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherSummary } from "@/types/api";

interface Props {
  weather: WeatherSummary;
}

const OPEN_METEO_URL = "https://open-meteo.com/";

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function WeatherInfoCard({ weather }: Props) {
  const t = useTranslations("WeatherInfo");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600 px-1 flex items-center gap-2">
        <span>☀️</span>
        {t("title")}
        <span className="text-xs text-slate-400 font-normal">{t("subtitle")}</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 年間日照時間 */}
        <Card className="bg-white">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>☀️</span>
              {t("annualSunshine")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-amber-600 leading-tight">
              {formatNumber(weather.annualSunshineHours, 1)}
              <span className="text-sm font-medium text-slate-500 ml-1">{t("annualSunshineUnit")}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{t("annualSunshineNote")}</p>
          </CardContent>
        </Card>

        {/* 夏期 平均最高気温 */}
        <Card className="bg-white">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>🌡️</span>
              {t("summerMax")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-rose-600 leading-tight">
              {formatNumber(weather.summerAvgMaxTemp, 1)}
              <span className="text-sm font-medium text-slate-500 ml-1">{t("tempUnit")}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{t("summerMaxNote")}</p>
          </CardContent>
        </Card>

        {/* 冬期 平均最低気温 */}
        <Card className="bg-white">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>❄️</span>
              {t("winterMin")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-sky-600 leading-tight">
              {formatNumber(weather.winterAvgMinTemp, 1)}
              <span className="text-sm font-medium text-slate-500 ml-1">{t("tempUnit")}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{t("winterMinNote")}</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-slate-500 px-1">
        {t("sourcePrefix")}{" "}
        <a
          href={OPEN_METEO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {t("sourceLink")}
        </a>{" "}
        {t("sourcePeriod")}
      </p>
    </div>
  );
}
