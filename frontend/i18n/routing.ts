import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ja", "en", "zh-TW", "zh-CN"],
  defaultLocale: "ja",
  localePrefix: "as-needed",
});
