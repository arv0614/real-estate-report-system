"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { ALL_LOCALES, type Locale } from "@/lib/locale";

type Props = {
  currentLocale: Locale;
  /**
   * オプション。指定された場合、リストにないロケールへの切替ボタンは
   * 視覚的に「未翻訳」として無効化される。ブログ詳細ページで「この記事は
   * 該当言語版がない」場合にボタンを抑止するために使用。
   */
  availableLocales?: Locale[];
};

const LABELS: Record<Locale, { short: string; full: string }> = {
  ja: { short: "JA", full: "日本語" },
  en: { short: "EN", full: "English" },
  "zh-TW": { short: "繁", full: "繁體中文" },
  "zh-CN": { short: "简", full: "简体中文" },
};

export default function LanguageToggle({ currentLocale, availableLocales }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (target: Locale) => {
    if (target === currentLocale) return;
    // next-intl/navigation は path を locale-agnostic に保持するため、
    // locale だけ差し替えれば router 側で正しく `/` or `/en/` 等に変換される。
    router.replace(pathname, { locale: target });
  };

  const isAvailable = (loc: Locale) => !availableLocales || availableLocales.includes(loc);

  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-white text-xs overflow-hidden"
      role="group"
      aria-label="Language switcher"
    >
      {ALL_LOCALES.map((loc) => {
        const isActive = loc === currentLocale;
        const enabled = isAvailable(loc);
        return (
          <button
            key={loc}
            type="button"
            disabled={!enabled || isActive}
            onClick={() => switchTo(loc)}
            aria-pressed={isActive}
            title={!enabled ? "Not translated" : LABELS[loc].full}
            className={[
              "px-2.5 py-1.5 font-semibold transition-colors",
              isActive
                ? "bg-slate-800 text-white cursor-default"
                : enabled
                  ? "text-slate-600 hover:bg-slate-100 cursor-pointer"
                  : "text-slate-300 cursor-not-allowed",
            ].join(" ")}
          >
            {LABELS[loc].short}
          </button>
        );
      })}
    </div>
  );
}
