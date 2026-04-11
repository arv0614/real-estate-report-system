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
    // and excluding API routes, static assets
    "/((?!api|_next/static|_next/image|favicon.ico|reports/|seo-images/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|js|css|map)).*)",
    // Explicitly include /en/* to support English locale for all paths (including reports)
    "/en/:path*",
  ],
};
