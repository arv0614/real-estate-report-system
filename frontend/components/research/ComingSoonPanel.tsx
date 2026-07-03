"use client";

import type { PropertyType } from "@/types/research";

interface Props {
  type: Extract<PropertyType, "farmland">;
  onBack: () => void;
  isEn: boolean;
}

const FARMLAND_ITEMS_JA = [
  "農地ナビによる農地区分（青地・白地）",
  "農地転用許可の難易度（参考）",
  "農地取引価格の参考相場",
  "農地中間管理機構による貸借可能性",
];

const FARMLAND_ITEMS_EN = [
  "Farmland classification via MAFF Farmland Navi (aochi/shirochi)",
  "Farmland conversion permit difficulty (reference)",
  "Reference market prices for agricultural land",
  "Lease availability via Farmland Banks",
];

export function ComingSoonPanel({ onBack, isEn }: Props) {
  const items = isEn ? FARMLAND_ITEMS_EN : FARMLAND_ITEMS_JA;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🌾</span>
        <h2 className="text-base font-bold text-slate-900">
          {isEn ? "Farmland Mode (Coming Soon)" : "農地モード（準備中）"}
        </h2>
      </div>

      <p className="text-sm text-slate-600 mb-5">
        {isEn
          ? "Farmland evaluation is currently in development."
          : "農地の情報提供機能は現在準備中です。"}
      </p>

      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {isEn ? "Planned items:" : "公開予定の項目:"}
        </p>
        <ul className="space-y-1.5">
          {items.map((item) => (
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
