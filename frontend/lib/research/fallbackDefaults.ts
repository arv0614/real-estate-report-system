import type { PropertyType } from "@/types/research";
import type { AreaDefaults } from "@/app/[locale]/research/areaDefaultsActions";

/**
 * National reference medians used when local area data is unavailable.
 * Source: MLIT 不動産取引価格情報 2022-2023 approximate nationwide figures.
 */
export const FALLBACK_DEFAULTS: Record<PropertyType, Omit<AreaDefaults, "sampleSize">> = {
  mansion: { priceMedian: 2500, areaMedian: 60,  builtYearMedian: 2005 },
  house:   { priceMedian: 2000, areaMedian: 105, builtYearMedian: 1993 },
};

export const FALLBACK_SOURCE_LABEL = {
  ja: "全国参考値",
  en: "National reference",
} as const;
