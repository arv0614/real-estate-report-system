"use client";

import type { PropertyType } from "@/types/research";

interface Props {
  type: Extract<PropertyType, "forest" | "farmland">;
  onBack: () => void;
  isEn: boolean;
}

const FOREST_ITEMS_JA = [
  "傾斜量・標高による作業性評価",
  "土砂災害警戒区域の指定状況",
  "山林取引価格の参考相場",
  "保安林指定の有無",
  "太陽光・再エネ適地としての参考評価",
];

const FARMLAND_ITEMS_JA = [
  "農地ナビによる農地区分（青地・白地）",
  "農地転用許可の難易度（参考）",
  "農地取引価格の参考相場",
  "農地中間管理機構による貸借可能性",
];

const FOREST_ITEMS_EN = [
  "Workability assessment by slope and elevation",
  "Landslide warning zone designation status",
  "Reference market prices for forest land",
  "Protected forest (hoanrin) designation check",
  "Suitability for solar / renewable energy use",
];

const FARMLAND_ITEMS_EN = [
  "Farmland classification via MAFF Farmland Navi (aochi/shirochi)",
  "Farmland conversion permit difficulty (reference)",
  "Reference market prices for agricultural land",
  "Lease availability via Farmland Banks",
];

export function ComingSoonPanel({ type, onBack, isEn }: Props) {
  const isForest = type === "forest";

  const icon = isForest ? "🌲" : "🌾";
  const titleJa = isForest ? "山林モード（準備中）" : "農地モード（準備中）";
  const titleEn = isForest ? "Forest Mode (Coming Soon)" : "Farmland Mode (Coming Soon)";
  const descJa = isForest
    ? "山林・林地の評価機能は現在準備中です。"
    : "農地の評価機能は現在準備中です。";
  const descEn = isForest
    ? "Forest and woodland evaluation is currently in development."
    : "Farmland evaluation is currently in development.";
  const itemsJa = isForest ? FOREST_ITEMS_JA : FARMLAND_ITEMS_JA;
  const itemsEn = isForest ? FOREST_ITEMS_EN : FARMLAND_ITEMS_EN;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-base font-bold text-slate-900">
          {isEn ? titleEn : titleJa}
        </h2>
      </div>

      <p className="text-sm text-slate-600 mb-5">
        {isEn ? descEn : descJa}
      </p>

      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {isEn ? "Planned evaluation items:" : "公開予定の評価項目:"}
        </p>
        <ul className="space-y-1.5">
          {(isEn ? itemsEn : itemsJa).map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-teal-500 mt-0.5 flex-shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-400 mb-5">
        {isEn
          ? "Launch date will be announced on the service blog."
          : "公開時期はサービスブログでお知らせします。"}
      </p>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors"
      >
        ← {isEn ? "Back to Apartment / House mode" : "マンション・戸建のモードに戻る"}
      </button>
    </div>
  );
}
