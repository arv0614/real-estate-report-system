import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 | 物件目利きリサーチ",
  description:
    "物件目利きリサーチのご利用にあたっての利用規約です。",
};

const LAST_UPDATED = "2026年4月1日";
const SERVICE_NAME = "物件目利きリサーチ";
const OPERATOR_NAME = "木下 開";
const OPERATOR_EMAIL = "realestate.report.support@gmail.com";
const OPERATOR_ADDRESS = "東京都葛飾区東新小岩7-13-20";

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">利用規約</h1>
          <p className="text-sm text-slate-500">最終更新日: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-slate-700">

          {/* 第1条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第1条（適用）
            </h2>
            <p>
              本利用規約（以下「本規約」）は、{OPERATOR_NAME}（以下「運営者」）が提供するウェブサービス「{SERVICE_NAME}」（以下「本サービス」）の利用に関する条件を、本サービスを利用するすべてのユーザー（以下「ユーザー」）との間で定めるものです。
            </p>
            <p className="mt-2">
              ユーザーは本サービスを利用することにより、本規約のすべての条項に同意したものとみなします。
            </p>
          </section>

          {/* 第2条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第2条（サービスの定義）
            </h2>
            <p>
              本サービスは、国土交通省「不動産情報ライブラリ」等の公開データおよび不動産に関する専門的知見を組み合わせ、ユーザーが指定したエリアの不動産市場に関する参考情報（取引価格サマリー、価格推移、エリア特性レポート等）を提供するウェブアプリケーションです。
            </p>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
              <p className="font-semibold text-amber-800 mb-2">⚠ 重要な免責事項</p>
              <ul className="space-y-2 text-amber-700">
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>本サービスが提供する情報は、不動産の鑑定評価に関する法律（不動産鑑定士法）に基づく「不動産鑑定評価」ではありません。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>本サービスが提供する情報は、金融商品取引法に基づく「投資助言」または「投資勧誘」ではありません。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>本サービスの情報はあくまでも参考情報です。不動産の購入・売却・投資等の判断は、必ず有資格の専門家（宅地建物取引士、不動産鑑定士等）にご相談のうえ、ご自身の責任において行ってください。</span>
                </li>
              </ul>
            </div>
          </section>

          {/* 第3条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第3条（アカウント登録）
            </h2>
            <ol className="space-y-2 list-none">
              {[
                "本サービスの一部機能は、Googleアカウントを利用したログイン（Firebase Authentication）が必要です。",
                "ユーザーは、自己のGoogleアカウントの管理について責任を負います。",
                "アカウントの不正使用が発生した場合は、速やかに運営者へご連絡ください。",
                "一つのアカウントを複数人で共有する行為は禁止します。",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 第4条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第4条（料金プランと決済）
            </h2>
            <ol className="space-y-2 list-none">
              {[
                "本サービスは無料プランと有料プラン（Proプラン、月額980円税込）を提供します。各プランの機能・制限は本サービス内に表示する内容に従います。",
                "有料プランの決済は、Stripe, Inc.（以下「Stripe」）の決済サービスを通じて行われます。クレジットカード情報はStripeが直接管理し、運営者のサーバーには保存されません。",
                "Proプランはいつでもキャンセル可能です。解約した場合、当月末日までサービスをご利用いただけます。日割り返金は行っておりません。ただし、サービスの重大な瑕疵により利用できなかった場合は、個別にご相談ください。",
                "料金は予告なく変更される場合があります。変更がある場合は、本サービス上で事前にお知らせします。",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 第5条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第5条（禁止事項）
            </h2>
            <p className="mb-3">ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
            <ul className="space-y-1.5">
              {[
                "本サービスのデータ・コンテンツの自動取得（スクレイピング、クローリング等）",
                "本サービスのリバースエンジニアリング、逆コンパイル、逆アセンブル",
                "アカウントの第三者への譲渡・貸与・不正共有",
                "本サービスを通じて取得した情報の無断での商業的利用・再販",
                "本サービスのサーバーへの過度な負荷をかける行為",
                "法令または公序良俗に反する行為",
                "その他、運営者が不適切と判断する行為",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 第6条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第6条（免責事項）
            </h2>
            <ol className="space-y-2 list-none">
              {[
                "本サービスで提供する情報（取引価格データ、エリア特性レポート等）はすべて参考情報です。その正確性・完全性・最新性を保証するものではなく、情報の利用によって生じた損害について運営者は一切責任を負いません。",
                "本サービスのシステム障害、メンテナンス、第三者サービス（Firebase、Stripe、国土交通省API等）の障害等によりサービスが利用できない場合でも、運営者はそれによって生じた損害について責任を負いません。",
                "運営者は、事前の予告なく本サービスの内容変更または提供終了を行う場合があります。",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 第7条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第7条（知的財産権）
            </h2>
            <p>
              本サービスに含まれるコンテンツ（文章、デザイン、ロゴ、レポートテキスト等）に関する著作権その他の知的財産権は、運営者または正当な権利者に帰属します。ユーザーは、個人的な閲覧目的以外でこれらを無断で複製・転載・改変・配布することはできません。
            </p>
          </section>

          {/* 第8条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第8条（規約の変更）
            </h2>
            <p>
              運営者は、必要と判断した場合、本規約をいつでも変更できるものとします。変更後の本規約は、本サービス上に掲示した時点から効力を生じます。重要な変更がある場合は、本サービス上またはメールにてお知らせします。
            </p>
          </section>

          {/* 第9条 */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
              第9条（準拠法・管轄裁判所）
            </h2>
            <p>
              本規約の解釈・適用は日本法に準拠します。本サービスに関して紛争が生じた場合は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          {/* お問い合わせ */}
          <section className="bg-slate-100 rounded-xl px-5 py-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">お問い合わせ</h2>
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
            <Link href="/terms" className="font-medium text-slate-600">利用規約</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">プライバシーポリシー</Link>
            <Link href="/about#legal" className="hover:text-slate-600 transition-colors">特定商取引法</Link>
            <Link href="/" className="hover:text-slate-600 transition-colors">トップへ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
