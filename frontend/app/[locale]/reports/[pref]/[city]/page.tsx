// Re-export the existing area report page under the [locale] route.
// generateStaticParams covers pref/city params; locale is handled by the parent layout.
// revalidate must be declared directly (cannot be re-exported per Next.js rules).
export const revalidate = 86400; // 24h ISR

export {
  default,
  generateMetadata,
  generateStaticParams,
} from "../../../../reports/[pref]/[city]/page";
