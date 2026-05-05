import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type RoutingLocale = (typeof routing.locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Ensure locale is valid; fall back to default
  if (!locale || !routing.locales.includes(locale as RoutingLocale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
