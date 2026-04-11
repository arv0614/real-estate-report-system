/**
 * /[locale]/licenses — ロケール対応OSSライセンスページ
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale === "en") {
    return {
      title: "Open Source Licenses | Mekiki Research",
      description: "Open source licenses for software used in Mekiki Research.",
      alternates: { canonical: `${SITE_URL}/en/licenses` },
    };
  }
  return {
    title: "オープンソースライセンス | 物件目利きリサーチ",
    description: "物件目利きリサーチが使用しているオープンソースソフトウェアのライセンス情報です。",
    alternates: { canonical: `${SITE_URL}/licenses` },
  };
}

type LicenseEntry = {
  name: string;
  version: string;
  license: string;
  copyright: string;
  url: string;
};

const FRONTEND_LICENSES: LicenseEntry[] = [
  { name: "Next.js", version: "16.x", license: "MIT", copyright: "Copyright (c) 2024 Vercel, Inc.", url: "https://github.com/vercel/next.js" },
  { name: "React", version: "19.x", license: "MIT", copyright: "Copyright (c) Meta Platforms, Inc. and affiliates.", url: "https://github.com/facebook/react" },
  { name: "Leaflet", version: "1.9.x", license: "BSD-2-Clause", copyright: "Copyright (c) 2010-2024, Vladimir Agafonkin\nCopyright (c) 2010-2011, CloudMade", url: "https://github.com/Leaflet/Leaflet" },
  { name: "react-leaflet", version: "5.x", license: "Hippocratic License 2.1", copyright: "Copyright 2020 Paul Le Cam and contributors", url: "https://github.com/PaulLeCam/react-leaflet" },
  { name: "leaflet-defaulticon-compatibility", version: "0.1.x", license: "BSD-2-Clause", copyright: "Copyright (c) ghybs", url: "https://github.com/ghybs/leaflet-defaulticon-compatibility" },
  { name: "Recharts", version: "3.x", license: "MIT", copyright: "Copyright (c) 2015-2024 Recharts Group", url: "https://github.com/recharts/recharts" },
  { name: "Firebase JS SDK", version: "12.x", license: "Apache-2.0", copyright: "Copyright (c) Google LLC", url: "https://github.com/firebase/firebase-js-sdk" },
  { name: "posthog-js", version: "1.x", license: "Apache-2.0", copyright: "Copyright 2020 Posthog / Hiberly, Inc.\nCopyright 2015 Mixpanel, Inc.", url: "https://github.com/PostHog/posthog-js" },
  { name: "Tailwind CSS", version: "4.x", license: "MIT", copyright: "Copyright (c) Tailwind Labs, Inc.", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "jsPDF", version: "4.x", license: "MIT", copyright: "Copyright (c) 2010 James Hall\nCopyright (c) 2015-2024 yWorks GmbH", url: "https://github.com/parallax/jsPDF" },
  { name: "html2canvas-pro", version: "2.x", license: "MIT", copyright: "Copyright (c) Niklas von Hertzen\nCopyright (c) 2023 yorickshan", url: "https://github.com/yorickshan/html2canvas-pro" },
  { name: "react-markdown", version: "10.x", license: "MIT", copyright: "Copyright (c) 2015 Espen Hovlandsdal", url: "https://github.com/remarkjs/react-markdown" },
  { name: "lucide-react", version: "1.x", license: "ISC", copyright: "Copyright (c) 2022 Lucide Contributors", url: "https://github.com/lucide-icons/lucide" },
  { name: "clsx", version: "2.x", license: "MIT", copyright: "Copyright (c) Luke Edwards", url: "https://github.com/lukeed/clsx" },
  { name: "tailwind-merge", version: "3.x", license: "MIT", copyright: "Copyright (c) 2021 Dany Castillo", url: "https://github.com/dcastil/tailwind-merge" },
  { name: "class-variance-authority", version: "0.7.x", license: "Apache-2.0", copyright: "Copyright (c) Joe Bell", url: "https://github.com/joe-bell/cva" },
];

const BACKEND_LICENSES: LicenseEntry[] = [
  { name: "Hono", version: "4.x", license: "MIT", copyright: "Copyright (c) 2021 - present, Yusuke Wada", url: "https://github.com/honojs/hono" },
  { name: "@google/generative-ai", version: "0.24.x", license: "Apache-2.0", copyright: "Copyright (c) Google LLC", url: "https://github.com/google-gemini/generative-ai-js" },
  { name: "firebase-admin", version: "13.x", license: "Apache-2.0", copyright: "Copyright (c) Google LLC", url: "https://github.com/firebase/firebase-admin-node" },
  { name: "@google-cloud/storage", version: "7.x", license: "Apache-2.0", copyright: "Copyright (c) Google LLC", url: "https://github.com/googleapis/nodejs-storage" },
  { name: "Stripe Node.js Library", version: "21.x", license: "MIT", copyright: "Copyright (c) Stripe, Inc.", url: "https://github.com/stripe/stripe-node" },
  { name: "Zod", version: "3.x", license: "MIT", copyright: "Copyright (c) 2020 Colin McDonnell", url: "https://github.com/colinhacks/zod" },
  { name: "dotenv", version: "16.x", license: "BSD-2-Clause", copyright: "Copyright (c) 2015, Scott Motte", url: "https://github.com/motdotla/dotenv" },
  { name: "axios", version: "1.x", license: "MIT", copyright: "Copyright (c) 2014-present Matt Zabriskie & Collaborators", url: "https://github.com/axios/axios" },
];

const LICENSE_BADGE_COLOR: Record<string, string> = {
  "MIT": "bg-green-100 text-green-700",
  "Apache-2.0": "bg-blue-100 text-blue-700",
  "BSD-2-Clause": "bg-sky-100 text-sky-700",
  "ISC": "bg-teal-100 text-teal-700",
  "Hippocratic License 2.1": "bg-purple-100 text-purple-700",
};

function LicenseTable({ entries, colPackage, colLicense, colCopyright }: {
  entries: LicenseEntry[];
  colPackage: string;
  colLicense: string;
  colCopyright: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700">{colPackage}</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700">{colLicense}</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 hidden sm:table-cell">{colCopyright}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.name} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <a href={entry.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                  {entry.name}
                </a>
                <span className="ml-1.5 text-xs text-slate-400">{entry.version}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${LICENSE_BADGE_COLOR[entry.license] ?? "bg-slate-100 text-slate-600"}`}>
                  {entry.license}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell whitespace-pre-line">
                {entry.copyright}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LocaleLicensesPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LicensesPage" });
  const isEn = locale === "en";

  const homeHref = isEn ? "/en" : "/";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";

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
          <p className="text-sm text-slate-600 leading-relaxed">{t("description")}</p>
        </div>

        <div className="space-y-10 text-sm">
          {/* Data Sources */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              {t("sectionData")}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">{t("colDataSource")}</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">{t("colDataLicense")}</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 hidden sm:table-cell">{t("colDataCredit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{t("data0name")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">CC BY 4.0</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{t("data0credit")}</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{t("data1name")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">{t("data1license")}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{t("data1credit")}</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{t("data2name")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">CC BY 4.0</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{t("data2credit")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              CC BY 4.0:{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {t("ccLink")}
              </a>
            </p>
          </section>

          {/* Frontend */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              {t("sectionFrontend")}
            </h2>
            <LicenseTable
              entries={FRONTEND_LICENSES}
              colPackage={t("colPackage")}
              colLicense={t("colLicense")}
              colCopyright={t("colCopyright")}
            />
          </section>

          {/* Backend */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              {t("sectionBackend")}
            </h2>
            <LicenseTable
              entries={BACKEND_LICENSES}
              colPackage={t("colPackage")}
              colLicense={t("colLicense")}
              colCopyright={t("colCopyright")}
            />
          </section>

          {/* Note */}
          <section className="bg-slate-100 rounded-xl px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900 mb-2">{t("noteTitle")}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{t("noteBody")}</p>
          </section>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {serviceName}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href={isEn ? "/en/terms" : "/terms"} className="hover:text-slate-600 transition-colors">{t("footerTerms")}</Link>
            <Link href={isEn ? "/en/privacy" : "/privacy"} className="hover:text-slate-600 transition-colors">{t("footerPrivacy")}</Link>
            <Link href={isEn ? "/en/about#legal" : "/about#legal"} className="hover:text-slate-600 transition-colors">{t("footerCommercial")}</Link>
            <Link href={isEn ? "/en/licenses" : "/licenses"} className="font-medium text-slate-600">{t("footerLicenses")}</Link>
            <Link href={homeHref} className="hover:text-slate-600 transition-colors">{t("footerTop")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
