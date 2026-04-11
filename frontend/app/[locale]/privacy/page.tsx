/**
 * /[locale]/privacy — ロケール対応プライバシーポリシーページ
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
      title: "Privacy Policy | Mekiki Research",
      description: "Privacy Policy for Mekiki Research — how we handle personal information.",
      alternates: { canonical: `${SITE_URL}/en/privacy` },
    };
  }
  return {
    title: "プライバシーポリシー | 物件目利きリサーチ",
    description: "物件目利きリサーチにおける個人情報の取り扱いについて説明します。",
    alternates: { canonical: `${SITE_URL}/privacy` },
  };
}

export default async function LocalePrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PrivacyPage" });
  const isEn = locale === "en";

  const homeHref = isEn ? "/en" : "/";
  const serviceName = isEn ? "Mekiki Research" : "物件目利きリサーチ";
  const operator = isEn ? "Kai Kinoshita" : "木下 開";

  // Third-party services block
  const ThirdPartyBlock = ({
    badge, badgeColor, name, desc, privacyUrl, privacyLabel,
  }: {
    badge: string; badgeColor: string; name: string; desc: string;
    privacyUrl: string; privacyLabel: string;
  }) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>{badge}</span>
        <span className="font-semibold text-slate-800">{name}</span>
      </div>
      <p className="text-slate-600">{desc}</p>
      <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1.5 inline-block">
        {privacyLabel} →
      </a>
    </div>
  );

  // External transmission table rows
  const transmissionRows = isEn
    ? [
        {
          dest: "PostHog, Inc.\n(USA)",
          info: "Page URL, clicks, browser type, anonymised IP, session ID",
          purpose: "Usage analytics & improvement",
        },
        {
          dest: "Google LLC\n(Firebase / GCP)",
          info: "Email address, UID, auth token",
          purpose: "User authentication & data storage",
        },
        {
          dest: "Stripe, Inc.\n(USA)",
          info: "Payment form input (card number etc.), email address",
          purpose: "Payment processing (not stored on our servers)",
        },
      ]
    : [
        {
          dest: "PostHog, Inc.\n（米国）",
          info: "ページURL・クリック操作・ブラウザ種別・IPアドレス（匿名化）・セッションID",
          purpose: "利用状況分析・機能改善",
        },
        {
          dest: "Google LLC\n（Firebase / GCP）",
          info: "メールアドレス・UID・認証トークン",
          purpose: "ユーザー認証・データ保管",
        },
        {
          dest: "Stripe, Inc.\n（米国）",
          info: "決済フォーム入力情報（カード番号等）・メールアドレス",
          purpose: "決済処理（当サービスサーバーには保存されません）",
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
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {t("intro", { operator, service: serviceName })}
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-slate-700">

          {/* Article 1 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s1title")}</h2>
            <p className="mb-3">{t("s1lead")}</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-2/5">{t("s1col1")}</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">{t("s1col2")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {([1,2,3,4,5] as const).map((n) => (
                    <tr key={n} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-600">{t(`s1r${n}type` as Parameters<typeof t>[0])}</td>
                      <td className="px-4 py-2.5 text-slate-600">{t(`s1r${n}timing` as Parameters<typeof t>[0])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s2title")}</h2>
            <p className="mb-2">{t("s2lead")}</p>
            <ul className="space-y-1.5">
              {([1,2,3,4,5,6,7] as const).map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{t(`s2i${n}` as Parameters<typeof t>[0])}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s3title")}</h2>
            <p className="mb-4">{t("s3lead")}</p>
            <div className="space-y-3">
              <ThirdPartyBlock
                badge={isEn ? "Auth" : "認証"}
                badgeColor="bg-orange-100 text-orange-700"
                name="Firebase Authentication (Google LLC)"
                desc={isEn
                  ? "Used for Google account login authentication. Email addresses and Google profile information are stored in Firebase."
                  : "Googleアカウントを使ったログイン認証に使用します。メールアドレスおよびGoogleプロフィール情報がFirebaseに保存されます。"}
                privacyUrl="https://firebase.google.com/support/privacy"
                privacyLabel={isEn ? "Firebase Privacy Policy" : "Firebase プライバシーポリシー"}
              />
              <ThirdPartyBlock
                badge={isEn ? "Payments" : "決済"}
                badgeColor="bg-purple-100 text-purple-700"
                name="Stripe (Stripe, Inc.)"
                desc={isEn
                  ? "Used for paid plan payment processing. Credit card information is managed directly by Stripe and is not stored on Operator servers."
                  : "有料プランの決済処理に使用します。クレジットカード番号等の決済情報はStripeが直接取得・管理し、運営者のサーバーには一切保存されません。"}
                privacyUrl="https://stripe.com/privacy"
                privacyLabel={isEn ? "Stripe Privacy Policy" : "Stripe プライバシーポリシー"}
              />
              <ThirdPartyBlock
                badge={isEn ? "Analytics" : "アクセス解析"}
                badgeColor="bg-teal-100 text-teal-700"
                name="PostHog (PostHog, Inc.)"
                desc={isEn
                  ? "Used for service improvement and usage analysis. Collects behaviour logs (page views, clicks, feature usage, etc.) via cookies and local storage. Data is not used to directly identify individuals."
                  : "サービス改善・利用状況分析のために使用します。Cookieおよびローカルストレージ等によりページビュー、クリック、機能の使用状況等の行動ログを収集します。収集データは個人を直接特定する目的では使用しません。"}
                privacyUrl="https://posthog.com/privacy"
                privacyLabel={isEn ? "PostHog Privacy Policy" : "PostHog プライバシーポリシー"}
              />
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    {isEn ? "Infrastructure" : "インフラ"}
                  </span>
                  <span className="font-semibold text-slate-800">Google Cloud Platform (Google LLC)</span>
                </div>
                <p className="text-slate-600">
                  {isEn
                    ? "The service's servers and data storage run on Google Cloud Platform. Data is stored in the Asia-Pacific region (asia-northeast1 / Tokyo) data centre."
                    : "本サービスのサーバーおよびデータストレージはGoogle Cloud Platform上で運営されています。データはアジア太平洋地域（asia-northeast1 / 東京）のデータセンターに保存されます。"}
                </p>
              </div>
            </div>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s4title")}</h2>
            <p>{t("s4p1")}</p>
            <ul className="mt-2 space-y-1.5">
              {[t("s4i1"), t("s4i2"), t("s4i3")].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s5title")}</h2>
            <p>{t("s5p1")}</p>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s6title")}</h2>
            <p className="mb-2">{t("s6lead")}</p>
            <ul className="space-y-1.5">
              {[t("s6i1"), t("s6i2")].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">{t("s6p2")}</p>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s7title")}</h2>
            <p>{t("s7p1")}</p>
          </section>

          {/* Article 7-2 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s72title")}</h2>
            <p className="mb-3">{t("s72p1")}</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 font-semibold text-slate-700 w-1/4">{t("s72col1")}</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700 w-1/3">{t("s72col2")}</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">{t("s72col3")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transmissionRows.map((row) => (
                    <tr key={row.dest} className="hover:bg-slate-50">
                      <td className="px-3 py-3 text-slate-600 whitespace-pre-line text-xs">{row.dest}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{row.info}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{t("s8title")}</h2>
            <p>{t("s8p1")}</p>
          </section>

          {/* Contact */}
          <section className="bg-slate-100 rounded-xl px-5 py-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">{t("contactTitle")}</h2>
            <p className="mb-3 text-slate-600">{t("contactLead")}</p>
            <dl className="space-y-1.5">
              {[
                { label: t("contactOperator"), value: OPERATOR_NAME },
                { label: t("contactAddress"), value: OPERATOR_ADDRESS },
                { label: t("contactEmail"), value: OPERATOR_EMAIL },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-36 shrink-0 font-semibold text-slate-600">{label}</dt>
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
            <Link href={isEn ? "/en/terms" : "/terms"} className="hover:text-slate-600 transition-colors">{t("footerTerms")}</Link>
            <Link href={isEn ? "/en/privacy" : "/privacy"} className="font-medium text-slate-600">{t("footerPrivacy")}</Link>
            <Link href={isEn ? "/en/about#legal" : "/about#legal"} className="hover:text-slate-600 transition-colors">{t("footerCommercial")}</Link>
            <Link href={isEn ? "/en/licenses" : "/licenses"} className="hover:text-slate-600 transition-colors">{t("footerLicenses")}</Link>
            <Link href={homeHref} className="hover:text-slate-600 transition-colors">{t("footerTop")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
