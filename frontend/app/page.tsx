// This route is handled by app/[locale]/page.tsx via next-intl middleware.
// Requests to / are internally rewritten to /ja by the middleware.
import { notFound } from "next/navigation";
export default function RootPage() {
  notFound();
}
