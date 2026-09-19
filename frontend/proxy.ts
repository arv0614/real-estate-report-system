import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Handle locale routing for all pages EXCEPT /reports/* (kept as SSG at root level)
    // and excluding API routes, static assets, and crawler metadata files
    // (sitemap.xml, robots.txt — see next.config.ts rewrites that map them to /api/*).
    // /lifelog/* is also excluded: it's proxied via next.config.ts rewrites to the
    // mekiki-lifelog Cloud Run service and must never be rewritten to /ja/lifelog etc.
    // by next-intl first (that 404s since the destination has no locale routing).
    "/((?!api|_next/static|_next/image|favicon.ico|reports/|seo-images/|lifelog|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|js|css|map|xml|txt)).*)",
    // Include /<locale>/* for each non-default locale, while excluding /<locale>/api/*
    // and /<locale>/_next/* so middleware doesn't intercept API calls or static assets
    "/en/((?!api|_next/).*)",
    "/zh-TW/((?!api|_next/).*)",
    "/zh-CN/((?!api|_next/).*)",
  ],
};
