import type { PropertyType } from "@/types/research";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";

/**
 * National reference medians used when local area data is unavailable.
 * Source: MLIT 不動産取引価格情報 2022-2023 approximate nationwide figures.
 */
export const FALLBACK_DEFAULTS: Record<PropertyType, Omit<AreaDefaults, "sampleSize">> = {
  mansion:  { priceMedian: 2500, areaMedian: 60,  builtYearMedian: 2005 },
  house:    { priceMedian: 2000, areaMedian: 105, builtYearMedian: 1993 },
  forest:   { priceMedian:  500, areaMedian: 500, builtYearMedian: 2000 },
  farmland: { priceMedian:  300, areaMedian: 300, builtYearMedian: 2000 },
};

export const FALLBACK_SOURCE_LABEL = {
  ja: "全国参考値",
  en: "National reference",
} as const;
