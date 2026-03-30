import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "オープンソースライセンス | 物件目利きリサーチ",
  description:
    "物件目利きリサーチが使用しているオープンソースソフトウェアのライセンス情報です。",
};

const SERVICE_NAME = "物件目利きリサーチ";

type LicenseEntry = {
  name: string;
  version: string;
  license: string;
  copyright: string;
  url: string;
};

/** フロントエンドの主要OSSライセンス */
const FRONTEND_LICENSES: LicenseEntry[] = [
  {
    name: "Next.js",
    version: "16.x",
    license: "MIT",
    copyright: "Copyright (c) 2024 Vercel, Inc.",
    url: "https://github.com/vercel/next.js",
  },
  {
    name: "React",
    version: "19.x",
    license: "MIT",
    copyright: "Copyright (c) Meta Platforms, Inc. and affiliates.",
    url: "https://github.com/facebook/react",
  },
  {
    name: "Leaflet",
    version: "1.9.x",
    license: "BSD-2-Clause",
    copyright: "Copyright (c) 2010-2024, Vladimir Agafonkin\nCopyright (c) 2010-2011, CloudMade",
    url: "https://github.com/Leaflet/Leaflet",
  },
  {
    name: "react-leaflet",
    version: "5.x",
    license: "Hippocratic License 2.1",
    copyright: "Copyright 2020 Paul Le Cam and contributors",
    url: "https://github.com/PaulLeCam/react-leaflet",
  },
  {
    name: "leaflet-defaulticon-compatibility",
    version: "0.1.x",
    license: "BSD-2-Clause",
    copyright: "Copyright (c) ghybs",
    url: "https://github.com/ghybs/leaflet-defaulticon-compatibility",
  },
  {
    name: "Recharts",
    version: "3.x",
    license: "MIT",
    copyright: "Copyright (c) 2015-2024 Recharts Group",
    url: "https://github.com/recharts/recharts",
  },
  {
    name: "Firebase JS SDK",
    version: "12.x",
    license: "Apache-2.0",
    copyright: "Copyright (c) Google LLC",
    url: "https://github.com/firebase/firebase-js-sdk",
  },
  {
    name: "posthog-js",
    version: "1.x",
    license: "Apache-2.0",
    copyright: "Copyright 2020 Posthog / Hiberly, Inc.\nCopyright 2015 Mixpanel, Inc.",
    url: "https://github.com/PostHog/posthog-js",
  },
  {
    name: "Tailwind CSS",
    version: "4.x",
    license: "MIT",
    copyright: "Copyright (c) Tailwind Labs, Inc.",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "jsPDF",
    version: "4.x",
    license: "MIT",
    copyright: "Copyright (c) 2010 James Hall\nCopyright (c) 2015-2024 yWorks GmbH",
    url: "https://github.com/parallax/jsPDF",
  },
  {
    name: "html2canvas-pro",
    version: "2.x",
    license: "MIT",
    copyright: "Copyright (c) Niklas von Hertzen\nCopyright (c) 2023 yorickshan",
    url: "https://github.com/yorickshan/html2canvas-pro",
  },
  {
    name: "react-markdown",
    version: "10.x",
    license: "MIT",
    copyright: "Copyright (c) 2015 Espen Hovlandsdal",
    url: "https://github.com/remarkjs/react-markdown",
  },
  {
    name: "lucide-react",
    version: "1.x",
    license: "ISC",
    copyright: "Copyright (c) 2022 Lucide Contributors",
    url: "https://github.com/lucide-icons/lucide",
  },
  {
    name: "clsx",
    version: "2.x",
    license: "MIT",
    copyright: "Copyright (c) Luke Edwards",
    url: "https://github.com/lukeed/clsx",
  },
  {
    name: "tailwind-merge",
    version: "3.x",
    license: "MIT",
    copyright: "Copyright (c) 2021 Dany Castillo",
    url: "https://github.com/dcastil/tailwind-merge",
  },
  {
    name: "class-variance-authority",
    version: "0.7.x",
    license: "Apache-2.0",
    copyright: "Copyright (c) Joe Bell",
    url: "https://github.com/joe-bell/cva",
  },
];

/** バックエンドの主要OSSライセンス */
const BACKEND_LICENSES: LicenseEntry[] = [
  {
    name: "Hono",
    version: "4.x",
    license: "MIT",
    copyright: "Copyright (c) 2021 - present, Yusuke Wada",
    url: "https://github.com/honojs/hono",
  },
  {
    name: "@google/generative-ai",
    version: "0.24.x",
    license: "Apache-2.0",
    copyright: "Copyright (c) Google LLC",
    url: "https://github.com/google-gemini/generative-ai-js",
  },
  {
    name: "firebase-admin",
    version: "13.x",
    license: "Apache-2.0",
    copyright: "Copyright (c) Google LLC",
    url: "https://github.com/firebase/firebase-admin-node",
  },
  {
    name: "@google-cloud/storage",
    version: "7.x",
    license: "Apache-2.0",
    copyright: "Copyright (c) Google LLC",
    url: "https://github.com/googleapis/nodejs-storage",
  },
  {
    name: "Stripe Node.js Library",
    version: "21.x",
    license: "MIT",
    copyright: "Copyright (c) Stripe, Inc.",
    url: "https://github.com/stripe/stripe-node",
  },
  {
    name: "Zod",
    version: "3.x",
    license: "MIT",
    copyright: "Copyright (c) 2020 Colin McDonnell",
    url: "https://github.com/colinhacks/zod",
  },
  {
    name: "dotenv",
    version: "16.x",
    license: "BSD-2-Clause",
    copyright: "Copyright (c) 2015, Scott Motte",
    url: "https://github.com/motdotla/dotenv",
  },
  {
    name: "axios",
    version: "1.x",
    license: "MIT",
    copyright: "Copyright (c) 2014-present Matt Zabriskie & Collaborators",
    url: "https://github.com/axios/axios",
  },
];

const LICENSE_BADGE_COLOR: Record<string, string> = {
  "MIT": "bg-green-100 text-green-700",
  "Apache-2.0": "bg-blue-100 text-blue-700",
  "BSD-2-Clause": "bg-sky-100 text-sky-700",
  "ISC": "bg-teal-100 text-teal-700",
  "Hippocratic License 2.1": "bg-purple-100 text-purple-700",
};

function LicenseTable({ entries }: { entries: LicenseEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700">パッケージ</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700">ライセンス</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 hidden sm:table-cell">著作権表記</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.name} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
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

export default function LicensesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ナビバー */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/logo_mekiki_research.png"
              alt=""
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="text-base font-bold text-slate-800 group-hover:text-slate-600 transition-colors">
              {SERVICE_NAME}
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">オープンソースライセンス</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            本サービスは以下のオープンソースソフトウェアを使用しています。各ライセンスの条件に従い、著作権表記を掲示します。
          </p>
        </div>

        <div className="space-y-10 text-sm">
          {/* 国交省・地図データ */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              データソース・地図
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">データソース</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">ライセンス</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 hidden sm:table-cell">出典</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">国土交通省「不動産情報ライブラリ」</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">CC BY 4.0</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      © 国土交通省 — 加工して作成
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">国土地理院 地図タイル</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">国土地理院コンテンツ利用規約</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      © 国土地理院
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">国土交通省「ハザードマップポータルサイト」</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">CC BY 4.0</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      © 国土交通省
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              CC BY 4.0: <a href="https://creativecommons.org/licenses/by/4.0/deed.ja" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">クリエイティブ・コモンズ 表示 4.0 国際</a>
            </p>
          </section>

          {/* フロントエンド */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              フロントエンド
            </h2>
            <LicenseTable entries={FRONTEND_LICENSES} />
          </section>

          {/* バックエンド */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              バックエンド
            </h2>
            <LicenseTable entries={BACKEND_LICENSES} />
          </section>

          {/* 特記事項 */}
          <section className="bg-slate-100 rounded-xl px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900 mb-2">特記事項</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              react-leaflet は Hippocratic License 2.1 のもとで提供されています。本ライセンスは MIT 等との互換性がなく、Human Rights Laws および Human Rights Principles に準拠した利用が求められます。本サービスはその条件のもとで適法に使用しています。
            </p>
          </section>
        </div>
      </main>

      {/* フッター */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {SERVICE_NAME}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-600 transition-colors">利用規約</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">プライバシーポリシー</Link>
            <Link href="/about#legal" className="hover:text-slate-600 transition-colors">特定商取引法</Link>
            <Link href="/licenses" className="font-medium text-slate-600">OSSライセンス</Link>
            <Link href="/" className="hover:text-slate-600 transition-colors">トップへ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
