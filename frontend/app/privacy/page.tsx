import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | 物件目利きリサーチ",
  description:
    "物件目利きリサーチにおける個人情報の取り扱いについて説明します。",
};

const LAST_UPDATED = "2026年4月1日";
const SERVICE_NAME = "物件目利きリサーチ";
const OPERATOR_NAME = "木下 開";
const OPERATOR_EMAIL = "realestate.report.support@gmail.com";
const OPERATOR_ADDRESS = "東京都葛飾区東新小岩7-13-20";

export default function PrivacyPage() {
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
        {/* タイトル */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-slate-500">最終更新日: {LAST_UPDATED}</p>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {OPERATOR_NAME}（以下「運営者」）は、{SERVICE_NAME}（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-slate-700">

          {/* 第1条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第1条（取得する個人情報）
            </h2>
            <p className="mb-3">運営者は、本サービスの提供にあたり、以下の情報を取得する場合があります。</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-2/5">情報の種類</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">取得タイミング・手段</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["メールアドレス", "Googleアカウント連携時・ウェイティングリスト登録時"],
                    ["氏名（表示名）", "Googleアカウント連携時（Googleプロフィールより取得）"],
                    ["検索履歴（緯度経度・エリア情報）", "ログイン中ユーザーが不動産調査を実行した際"],
                    ["利用状況・行動ログ", "PostHogによる自動収集（後述）"],
                    ["決済関連情報", "有料プランご利用時（Stripeによる収集。詳細は後述）"],
                  ].map(([type, timing]) => (
                    <tr key={type} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-600">{type}</td>
                      <td className="px-4 py-2.5 text-slate-600">{timing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 第2条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第2条（利用目的）
            </h2>
            <p className="mb-2">取得した個人情報は、以下の目的に限り利用します。</p>
            <ul className="space-y-1.5">
              {[
                "本サービスの提供・運営・機能改善",
                "ユーザー認証およびアカウント管理",
                "有料プランの請求処理・決済管理",
                "検索履歴の表示・利便性向上",
                "サービスに関する重要なお知らせの送信",
                "お問い合わせへの対応",
                "利用規約違反への対応",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 第3条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第3条（利用する外部サービス）
            </h2>
            <p className="mb-4">本サービスは以下の外部サービスを利用しており、各サービスのプライバシーポリシーが適用されます。</p>

            <div className="space-y-3">
              {/* Firebase */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">認証</span>
                  <span className="font-semibold text-slate-800">Firebase Authentication（Google LLC）</span>
                </div>
                <p className="text-slate-600">
                  Googleアカウントを使ったログイン認証に使用します。メールアドレスおよびGoogleプロフィール情報がFirebaseに保存されます。
                </p>
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1.5 inline-block">
                  Firebase プライバシーポリシー →
                </a>
              </div>

              {/* Stripe */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">決済</span>
                  <span className="font-semibold text-slate-800">Stripe（Stripe, Inc.）</span>
                </div>
                <p className="text-slate-600">
                  有料プランの決済処理に使用します。クレジットカード番号等の決済情報はStripeが直接取得・管理し、<strong className="text-slate-800">運営者のサーバーには一切保存されません</strong>。
                </p>
                <a href="https://stripe.com/jp/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1.5 inline-block">
                  Stripe プライバシーポリシー →
                </a>
              </div>

              {/* PostHog */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-700">アクセス解析</span>
                  <span className="font-semibold text-slate-800">PostHog（PostHog, Inc.）</span>
                </div>
                <p className="text-slate-600">
                  サービス改善・利用状況分析のために使用します。Cookieおよびローカルストレージ等のトラッキング技術によりページビュー、クリック、機能の使用状況等の行動ログを収集します。収集データは個人を直接特定する目的では使用しません。
                </p>
                <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1.5 inline-block">
                  PostHog プライバシーポリシー →
                </a>
              </div>

              {/* Google Cloud */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">インフラ</span>
                  <span className="font-semibold text-slate-800">Google Cloud Platform（Google LLC）</span>
                </div>
                <p className="text-slate-600">
                  本サービスのサーバーおよびデータストレージはGoogle Cloud Platform上で運営されています。データはアジア太平洋地域（asia-northeast1 / 東京）のデータセンターに保存されます。
                </p>
              </div>
            </div>
          </section>

          {/* 第4条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第4条（第三者提供）
            </h2>
            <p>
              運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
            </p>
            <ul className="mt-2 space-y-1.5">
              {[
                "ユーザーの事前の同意がある場合",
                "法令に基づく場合（裁判所・警察等の公的機関からの適法な要請）",
                "人命・身体・財産の保護に必要で、ユーザーの同意取得が困難な場合",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 第5条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第5条（データの保管・安全管理）
            </h2>
            <p>
              運営者は、個人情報の漏洩・滅失・毀損を防ぐため、適切なセキュリティ対策（アクセス制御、通信の暗号化等）を実施します。ただし、インターネット上の完全なセキュリティを保証するものではありません。
            </p>
          </section>

          {/* 第6条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第6条（ユーザーの権利）
            </h2>
            <p className="mb-2">ユーザーは、自己の個人情報について以下の権利を有します。</p>
            <ul className="space-y-1.5">
              {[
                "開示・訂正・削除の請求",
                "利用停止・第三者提供停止の請求",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              ご請求の際は、下記お問い合わせ先までご連絡ください。本人確認のうえ、合理的な期間内に対応いたします。
            </p>
          </section>

          {/* 第7条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第7条（Cookieおよびトラッキング技術について）
            </h2>
            <p>
              本サービスは、サービス改善・利用状況分析のためにCookieおよびこれに類する技術（ローカルストレージ等）を使用しています。ブラウザの設定によりCookieを無効化できますが、一部の機能が正常に動作しない場合があります。
            </p>
          </section>

          {/* 第8条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第8条（本ポリシーの変更）
            </h2>
            <p>
              運営者は、必要に応じて本ポリシーを改定することがあります。重要な変更がある場合は、本サービス上またはメールにてお知らせします。改定後のポリシーは本ページに掲示された時点から効力を生じます。
            </p>
          </section>

          {/* お問い合わせ */}
          <section className="bg-slate-100 rounded-xl px-5 py-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">個人情報に関するお問い合わせ</h2>
            <p className="mb-3 text-slate-600">個人情報の開示・訂正・削除等のご請求、またはプライバシーに関するお問い合わせは下記までご連絡ください。</p>
            <dl className="space-y-1.5">
              {[
                { label: "運営者", value: OPERATOR_NAME },
                { label: "所在地", value: OPERATOR_ADDRESS },
                { label: "メールアドレス", value: OPERATOR_EMAIL },
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

      {/* フッター */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 {SERVICE_NAME} / {OPERATOR_NAME}</span>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-600 transition-colors">利用規約</Link>
            <Link href="/privacy" className="font-medium text-slate-600">プライバシーポリシー</Link>
            <Link href="/about#legal" className="hover:text-slate-600 transition-colors">特定商取引法</Link>
            <Link href="/" className="hover:text-slate-600 transition-colors">トップへ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
