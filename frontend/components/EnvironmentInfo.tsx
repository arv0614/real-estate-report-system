import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnvironmentInfo } from "@/types/api";

interface Props {
  environment: EnvironmentInfo;
}

export function EnvironmentInfoCard({ environment }: Props) {
  const { zoning, schools, medical, station } = environment;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600 px-1 flex items-center gap-2">
        <span>🏙️</span>
        生活環境情報
        <span className="text-xs text-slate-400 font-normal">（国土交通省 不動産情報ライブラリ）</span>
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 用途地域 */}
        <Card className="bg-white col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>🏗️</span>
              用途地域
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-base font-bold text-slate-800 leading-tight">
              {zoning.useArea ?? "データなし"}
            </p>
            {(zoning.coverageRatio || zoning.floorAreaRatio) && (
              <p className="text-xs text-slate-400 mt-1">
                {[
                  zoning.coverageRatio ? `建ぺい率 ${zoning.coverageRatio}` : null,
                  zoning.floorAreaRatio ? `容積率 ${zoning.floorAreaRatio}` : null,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 学区 */}
        <Card className="bg-white col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>🏫</span>
              学区
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            <div>
              <span className="text-[10px] text-slate-400 block">小学校</span>
              <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                {schools.elementary ?? "データなし"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">中学校</span>
              <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                {schools.juniorHigh ?? "データなし"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 医療機関 */}
        <Card className="bg-white col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>🏥</span>
              周辺医療機関
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-slate-800 leading-tight">
              {medical.count > 0 ? `${medical.count} 件` : "データなし"}
            </p>
            {medical.facilities.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {medical.facilities.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-xs text-slate-500 truncate">
                    <span className="text-slate-400 text-[10px]">{f.type}</span>{" "}
                    {f.name}
                  </li>
                ))}
                {medical.count > 3 && (
                  <li className="text-xs text-slate-400">他 {medical.count - 3} 件…</li>
                )}
              </ul>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5">※約1.2km四方エリア内</p>
          </CardContent>
        </Card>

        {/* 最寄り駅 */}
        <Card className="bg-white col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>🚉</span>
              最寄り駅
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {station.name ? (
              <>
                <p className="text-lg font-bold text-slate-800 leading-tight">
                  {station.name}駅
                </p>
                {station.operator && (
                  <p className="text-xs text-slate-500 mt-0.5">{station.operator}</p>
                )}
                {station.dailyPassengers && (
                  <p className="text-xs text-slate-400 mt-1">
                    乗降客数 {station.dailyPassengers.toLocaleString()} 人/日
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-500">データなし</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
