"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/lib/blog";

type Props = {
  currentLocale: Locale;
  /**
   * オプション。指定された場合、リストにないロケールへの切替ボタンは
   * 視覚的に「未翻訳」として無効化される。ブログ詳細ページで「この記事は
   * 英語版がない」場合に EN ボタンを抑止するために使用。
   */
  availableLocales?: Locale[];
};

const LABELS: Record<Locale, { short: string; full: string }> = {
  ja: { short: "JA", full: "日本語" },
  en: { short: "EN", full: "English" },
};

export default function LanguageToggle({ currentLocale, availableLocales }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (target: Locale) => {
    if (target === currentLocale) return;
    // next-intl/navigation は path を locale-agnostic に保持するため、
    // locale だけ差し替えれば router 側で正しく `/` or `/en/` に変換される。
    router.replace(pathname, { locale: target });
  };

  const isAvailable = (loc: Locale) => !availableLocales || availableLocales.includes(loc);

  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-white text-xs overflow-hidden"
      role="group"
      aria-label="Language switcher"
    >
      {(["ja", "en"] as Locale[]).map((loc) => {
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
              "px-3 py-1.5 font-semibold transition-colors",
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
