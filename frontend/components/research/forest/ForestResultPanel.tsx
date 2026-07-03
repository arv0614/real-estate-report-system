"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnalyzeResult } from "@/types/research";
import type { ForestScoreResult } from "@/lib/scoring/forestScore";
import type { SubScore } from "@/lib/scoring/types";

// ── Shared helpers ─────────────────────────────────────────────────────────────

const FETCH_DATE = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

function CardFooter({ sources }: { sources: { label: string; url?: string }[] }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 space-y-0.5">
      {sources.map((s) => (
        <div key={s.label}>
          出典: {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">{s.label}</a> : s.label}
          　取得日: {FETCH_DATE}
        </div>
      ))}
      <div className="mt-1 text-slate-400">本ページは公的データの集計結果であり、不動産鑑定評価・価格査定ではありません</div>
    </div>
  );
}

function SubScoreRow({ sub, label }: { sub: SubScore; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      {sub.status === "ok" ? (
        <span className="font-semibold text-slate-800">{sub.value}点</span>
      ) : (
        <span className="text-slate-400 text-xs">— ({sub.reason})</span>
      )}
    </div>
  );
}

// ── ForestScoreSummaryCard ────────────────────────────────────────────────────

function ForestScoreSummaryCard({ score }: { score: ForestScoreResult }) {
  const { total, subScores, disclaimer } = score;

  const gradeColor = () => {
    if (total.status !== "ok") return "text-slate-400";
    switch (total.grade) {
      case "A+": return "text-emerald-600";
      case "A":  return "text-green-600";
      case "B+": return "text-teal-600";
      case "B":  return "text-blue-600";
      case "C":  return "text-amber-600";
      case "D":  return "text-red-600";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌲</span>
        <h2 className="text-sm font-bold text-slate-800">山林エリア指標サマリー</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">公的データ集計グレード</span>
      </div>

      {total.status === "ok" ? (
        <div className="text-center py-3">
          <div className={`text-5xl font-extrabold ${gradeColor()}`}>{total.grade}</div>
          <div className="text-lg font-bold text-slate-700 mt-1">{total.score}点</div>
          {total.note && <div className="text-xs text-slate-400 mt-1">{total.note}</div>}
        </div>
      ) : (
        <div className="text-center py-3 text-slate-400 text-sm">{total.reason}</div>
      )}

      <div className="divide-y divide-slate-100 mt-2">
        <SubScoreRow sub={subScores.terrainAccess} label="地形・アクセス性（30%）" />
        <SubScoreRow sub={subScores.solarTerrain}  label="太陽光地形条件（25%）" />
        <SubScoreRow sub={subScores.hazardZone}    label="災害区域（25%）" />
        <SubScoreRow sub={subScores.marketRecord}  label="取引記録（20%）" />
      </div>

      <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
        {disclaimer}
      </div>
    </div>
  );
}

// ── TerrainCard ───────────────────────────────────────────────────────────────

function TerrainCard({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const ft = result.forestTerrain;
  if (!ft) return null;

  const slopeLabels: Record<string, string> = {
    gentle:    "緩傾斜（10°未満）",
    moderate:  "中傾斜（10〜20°）",
    steep:     "急傾斜（20〜30°）",
    very_steep:"非常に急峻（30°以上）",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-3">地形条件の集計</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-50 rounded-xl p-3">
          <dt className="text-xs text-slate-500 mb-0.5">傾斜角</dt>
          <dd className="font-semibold text-slate-800">
            {ft.slopeDeg !== null ? `${ft.slopeDeg}°` : "—"}
            {ft.slopeClass && <span className="block text-xs text-slate-500 font-normal mt-0.5">{slopeLabels[ft.slopeClass]}</span>}
          </dd>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <dt className="text-xs text-slate-500 mb-0.5">斜面方位</dt>
          <dd className="font-semibold text-slate-800">{ft.aspectLabel ?? "—"}</dd>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <dt className="text-xs text-slate-500 mb-0.5">標高</dt>
          <dd className="font-semibold text-slate-800">{ft.elevation !== null ? `${ft.elevation}m` : "—"}</dd>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <dt className="text-xs text-slate-500 mb-0.5">方位角</dt>
          <dd className="font-semibold text-slate-800">{ft.aspectDeg !== null ? `${ft.aspectDeg}°` : "—"}</dd>
        </div>
      </dl>
      <CardFooter sources={[{ label: "国土地理院 標高タイル", url: "https://cyberjapandata.gsi.go.jp/" }]} />
    </div>
  );
}

// ── SolarTerrainCard ──────────────────────────────────────────────────────────

function SolarTerrainCard({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const st = result.forestTerrain?.solarTerrain;
  if (!st) return null;

  function CheckItem({ label, value }: { label: string; value: boolean | null }) {
    const icon = value === null ? "？" : value ? "✓" : "✗";
    const color = value === null ? "text-slate-400" : value ? "text-teal-600" : "text-slate-500";
    const bg    = value === null ? "bg-slate-50" : value ? "bg-teal-50" : "bg-slate-50";
    const text  = value === null ? "不明" : value ? "充足" : "非充足";
    return (
      <div className={`flex items-center gap-3 p-2.5 rounded-lg ${bg}`}>
        <span className={`text-base font-bold w-5 text-center ${color}`}>{icon}</span>
        <div className="flex-1 text-sm text-slate-700">{label}</div>
        <span className={`text-xs font-semibold ${color}`}>{text}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-1">太陽光利用に関する地形条件の集計</h3>
      <p className="text-xs text-slate-400 mb-3">{st.metCount}/{st.totalCount} 条件充足（発電量・適否の判定ではありません）</p>
      <div className="space-y-2">
        <CheckItem label="① 傾斜 15°以下" value={st.slopeOk} />
        <CheckItem label="② 方位：南・南東・南西（またはほぼ平坦）" value={st.aspectOk} />
        <CheckItem label="③ 標高 800m以下" value={st.elevationOk} />
      </div>
      <CardFooter sources={[{ label: "国土地理院 標高タイル", url: "https://cyberjapandata.gsi.go.jp/" }]} />
    </div>
  );
}

// ── SedimentZoneCard ──────────────────────────────────────────────────────────

function SedimentZoneCard({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const sed = result.sediment;
  if (!sed) return null;

  function ZoneRow({ label, inside, special, phenomena, failed }: {
    label: string;
    inside: boolean | null;
    special?: boolean;
    phenomena?: string[];
    failed?: boolean;
  }) {
    if (failed || inside === null) {
      return (
        <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
          <span className="text-slate-300 mt-0.5">—</span>
          <div className="flex-1">
            <div className="text-sm text-slate-600">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">データを取得できませんでした</div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
        <span className={`mt-0.5 ${inside ? "text-amber-500" : "text-teal-500"}`}>
          {inside ? "⚠" : "✓"}
        </span>
        <div className="flex-1">
          <div className="text-sm text-slate-700">{label}</div>
          {inside ? (
            <div className="mt-0.5">
              <span className="text-xs text-amber-700 font-semibold">
                {special ? "特別警戒区域に該当する可能性があります" : "警戒区域に該当する可能性があります"}
              </span>
              {phenomena && phenomena.length > 0 && (
                <span className="text-xs text-slate-500 ml-2">（{phenomena.join("・")}）</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 mt-0.5">該当なし</div>
          )}
        </div>
      </div>
    );
  }

  const wz = sed.warningZone;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-3">土砂・崩壊リスク区域の集計結果</h3>
      <div>
        <ZoneRow
          label="土砂災害警戒区域（XKT029）"
          inside={wz === null ? null : wz.inside}
          special={wz?.special}
          phenomena={wz?.phenomena}
          failed={wz === null}
        />
        <ZoneRow
          label="急傾斜地崩壊危険区域（XKT022）"
          inside={sed.steepSlopeZone}
          failed={sed.steepSlopeZone === null}
        />
        <ZoneRow
          label="地すべり防止区域（XKT021）"
          inside={sed.landslideZone}
          failed={sed.landslideZone === null}
        />
      </div>
      <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
        区域の形状は概略であり、正式な区域は都道府県の告示図書をご確認ください
      </div>
      <CardFooter sources={[{ label: "不動産情報ライブラリ（国土交通省）", url: "https://www.reinfolib.mlit.go.jp/" }]} />
    </div>
  );
}

// ── HoanrinCard ───────────────────────────────────────────────────────────────

function HoanrinCard({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const h = result.hoanrin;

  const bodyText = h === null || h === undefined
    ? "データ準備中"
    : h.status === "inside"
      ? "公的データ上、保安林に指定されている区域に該当する可能性があります"
      : h.status === "outside"
        ? "公的データ上、保安林指定区域への該当は確認されませんでした"
        : "データを取得できませんでした（unknown）";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-2">保安林指定区域の確認</h3>
      <p className={`text-sm ${(h?.status === "inside") ? "text-amber-700 font-semibold" : "text-slate-700"}`}>
        {bodyText}
      </p>
      {h?.status === "inside" && (
        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
          保安林は伐採等に制限がある一方、固定資産税の非課税等の税制上の取扱いがあります（詳細は自治体・税務署にご確認ください）
        </div>
      )}
      <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
        本データは国土数値情報（平成27年度等）に基づく参考情報であり、最新の指定状況は都道府県の林務担当課への照会が必要です
      </div>
      <CardFooter sources={[{ label: "国土数値情報（国土交通省）", url: "https://nlftp.mlit.go.jp/ksj/" }]} />
    </div>
  );
}

// ── ForestTxCard ──────────────────────────────────────────────────────────────

function ForestTxCard({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const { similar, forestStage, forestStageLabel } = result;

  const STAGE_LABELS: Record<string, string> = {
    city_3yr: "同一市区町村・直近3年",
    pref_3yr: "同一都道府県・直近3年",
    pref_5yr: "同一都道府県・直近5年",
  };

  const displayLabel = forestStageLabel ?? (forestStage ? STAGE_LABELS[forestStage] : null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">林地取引記録</h3>
        {displayLabel && (
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
            {displayLabel}
          </span>
        )}
      </div>

      {similar.length === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">
          <div>周辺エリアの林地取引記録が見つかりませんでした</div>
          <div className="text-xs mt-1">（都道府県×5年まで検索済み）</div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {similar.slice(0, 8).map((tx, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-slate-500 text-xs">{tx.period}</span>
                <span className="text-slate-600">{tx.area.toLocaleString()}㎡</span>
                <span className="font-semibold text-slate-800">{tx.price.toLocaleString()}万円</span>
              </div>
            ))}
          </div>
          {similar.length > 8 && (
            <p className="text-xs text-slate-400 mt-2">他{similar.length - 8}件（上位8件を表示）</p>
          )}
          <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
            集計値（参考）：林地取引は件数が限られており、価格は土地形状・立木状況・接道条件等により大きく異なります。
            個別事情を反映した価格については不動産の専門家にご相談ください。
          </div>
        </>
      )}
      <CardFooter sources={[{ label: "不動産情報ライブラリ XIT001（国土交通省）", url: "https://www.reinfolib.mlit.go.jp/" }]} />
    </div>
  );
}

// ── ReferenceAccordion ────────────────────────────────────────────────────────

function ReferenceAccordion({ result }: { result: Extract<AnalyzeResult, { ok: true }> }) {
  const [open, setOpen] = useState(false);
  const { seismic, terrain, hazard } = result;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:bg-slate-50 transition-colors"
      >
        <span>参考情報（建物を建てる場合等の一般的情報）</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-slate-200 p-5 space-y-4">
            <p className="text-xs text-slate-400">以下の情報は建物建築を検討する場合等の参考情報です。山林そのものの利用とは直接関係しない場合があります。</p>

            {/* Seismic */}
            {seismic && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs font-semibold text-slate-600 mb-1">地震リスク（J-SHIS）</div>
                <div className="text-sm text-slate-700">30年以内に震度6弱以上の確率: <span className="font-bold">{seismic.probPct}%</span>（{seismic.riskLabel}）</div>
                <a href="https://www.j-shis.bosai.go.jp/" target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 underline mt-1 block">
                  J-SHIS（防災科学技術研究所）
                </a>
              </div>
            )}

            {/* Terrain */}
            {terrain && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs font-semibold text-slate-600 mb-1">地形分類（国土地理院）</div>
                <div className="text-sm text-slate-700">{terrain.riskNote}</div>
                {terrain.terrainClass && <div className="text-xs text-slate-500 mt-0.5">地形分類: {terrain.terrainClass}</div>}
                <a href="https://maps.gsi.go.jp/" target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 underline mt-1 block">
                  地理院地図
                </a>
              </div>
            )}

            {/* Flood hazard */}
            {hazard && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs font-semibold text-slate-600 mb-1">洪水浸水想定区域（国交省）</div>
                <div className="text-sm text-slate-700">
                  {hazard.flood.hasRisk
                    ? `浸水リスクあり（最大浸水深: ${hazard.flood.maxDepthLabel ?? "不明"}）`
                    : "浸水想定区域に該当しない区域です"}
                </div>
                <a href="https://www.reinfolib.mlit.go.jp/" target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 underline mt-1 block">
                  不動産情報ライブラリ（国土交通省）
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ForestResultPanel (main) ──────────────────────────────────────────────────

interface Props {
  result: Extract<AnalyzeResult, { ok: true }>;
}

export function ForestResultPanel({ result }: Props) {
  const { forestScore } = result;

  return (
    <div className="space-y-4">
      {/* Score summary */}
      {forestScore && <ForestScoreSummaryCard score={forestScore} />}

      {/* Terrain */}
      {result.forestTerrain && <TerrainCard result={result} />}

      {/* Solar terrain */}
      {result.forestTerrain?.solarTerrain && <SolarTerrainCard result={result} />}

      {/* Sediment zones */}
      {result.sediment && <SedimentZoneCard result={result} />}

      {/* Hoanrin */}
      <HoanrinCard result={result} />

      {/* Transaction records */}
      <ForestTxCard result={result} />

      {/* Reference info (J-SHIS / flood) — collapsible */}
      <ReferenceAccordion result={result} />

      {/* Page-level attribution */}
      <div className="text-center text-xs text-slate-400 pt-2">
        国土地理院 標高タイルを加工して算出
      </div>
    </div>
  );
}
