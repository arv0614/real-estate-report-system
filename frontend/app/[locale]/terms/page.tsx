/**
 * /[locale]/terms — ロケール対応利用規約ページ
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

const LAST_UPDATED_JA = "2026年4月1日";
const LAST_UPDATED_EN = "April 1, 2026";
const OPERATOR_NAME = "木下 開 (Kai Kinoshita)";
const OPERATOR_EMAIL = "realestate.report.support@gmail.com";
const OPERATOR_ADDRESS = "東京都葛飾区東新小岩7-13-20, Tokyo, Japan";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale === "en") {
    return {
      title: "Terms of Service | Mekiki Research",
      description: "Terms of Service for Mekiki Research.",
      alternates: { canonical: `${SITE_URL}/en/terms` },
    };
  }
  return {
    title: "利用規約 | 物件目利きリサーチ",
    description: "物件目利きリサーチのご利用にあたっての利用規約です。",
    alternates: { canonical: `${SITE_URL}/terms` },
  };
}

export default async function LocaleTermsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TermsPage" });
  const isEn = locale === "en";

  const homeHref = isEn ? "/en" : "/";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";
  const operator = isEn ? "Kai Kinoshita" : "木下 開";

  const sections = [
    {
      title: t("s1title"),
      content: (
        <>
          <p>{t("s1p1", { operator, service: serviceName })}</p>
          <p className="mt-2">{t("s1p2")}</p>
        </>
      ),
    },
    {
      title: t("s2title"),
      content: (
        <>
          <p>{t("s2p1")}</p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
            <p className="font-semibold text-amber-800 mb-2">{t("s2disclaimerTitle")}</p>
            <ul className="space-y-2 text-amber-700">
              {[t("s2d1"), t("s2d2"), t("s2d3")].map((d, i) => (
                <li key={i} className="flex gap-2"><span className="shrink-0">•</span><span>{d}</span></li>
              ))}
            </ul>
          </div>
        </>
      ),
    },
    {
      title: t("s3title"),
      content: (
        <ol className="space-y-2 list-none">
          {[t("s3i1"), t("s3i2"), t("s3i3"), t("s3i4")].map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: t("s4title"),
      content: (
        <ol className="space-y-2 list-none">
          {[t("s4i1"), t("s4i2"), t("s4i3"), t("s4i4")].map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: t("s5title"),
      content: (
        <>
          <p className="mb-3">{t("s5lead")}</p>
          <ul className="space-y-1.5">
            {[t("s5i1"), t("s5i2"), t("s5i3"), t("s5i4"), t("s5i5"), t("s5i6"), t("s5i7")].map((text, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-slate-400">•</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: t("s6title"),
      content: (
        <ol className="space-y-2 list-none">
          {[t("s6i1"), t("s6i2"), t("s6i3")].map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: t("s62title"),
      content: (
        <ol className="space-y-2 list-none">
          {[t("s62i1"), t("s62i2"), t("s62i3"), t("s62i4")].map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: t("s63title"),
      content: (
        <>
          <p className="mb-2">{t("s63p1")}</p>
          <ul className="space-y-1.5">
            {[t("s63i1"), t("s63i2"), t("s63i3")].map((text, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-slate-400">•</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: t("s7title"),
      content: <p>{t("s7p1")}</p>,
    },
    {
      title: t("s8title"),
      content: <p>{t("s8p1")}</p>,
    },
    {
      title: t("s9title"),
      content: <p>{t("s9p1")}</p>,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-2 group">
            <img src="/logo_mekiki_research.png" alt="" className="h-8 w-8 object-contain shrink-0" />
            <span className="text-base font-bold text-slate-800 group-hover:text-slate-600 transition-colors">
              {serviceName}
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("lastUpdated")} {isEn ? LAST_UPDATED_EN : LAST_UPDATED_JA}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-slate-700">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{s.title}</h2>
              {s.content}
            </section>
          ))}

          {/* Contact */}
          <section className="bg-slate-100 rounded-xl px-5 py-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">{t("contactTitle")}</h2>
            <dl className="space-y-1.5">
              {[
                { label: t("contactOperator"), value: OPERATOR_NAME },
                { label: t("contactAddress"), value: OPERATOR_ADDRESS },
                { label: t("contactEmail"), value: OPERATOR_EMAIL },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-slate-600">{label}</dt>
                  <dd className="text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {serviceName} / {operator}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href={isEn ? "/en/terms" : "/terms"} className="font-medium text-slate-600">{t("footerTerms")}</Link>
            <Link href={isEn ? "/en/privacy" : "/privacy"} className="hover:text-slate-600 transition-colors">{t("footerPrivacy")}</Link>
            <Link href={isEn ? "/en/about#legal" : "/about#legal"} className="hover:text-slate-600 transition-colors">{t("footerCommercial")}</Link>
            <Link href={isEn ? "/en/licenses" : "/licenses"} className="hover:text-slate-600 transition-colors">{t("footerLicenses")}</Link>
            <Link href={homeHref} className="hover:text-slate-600 transition-colors">{t("footerTop")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
