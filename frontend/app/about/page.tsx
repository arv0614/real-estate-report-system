import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://realestate-frontend-2hctlfcy6a-an.a.run.app";

export const metadata: Metadata = {
  title: "サービス紹介・料金プラン",
  description:
    "AIと国土交通省データを活用した不動産資産価値・リスク診断SaaS。取引価格の可視化、ハザード情報、AIによる10項目エリア分析、暮らしのイメージ生成、PDF出力機能を提供。不動産営業・投資家・購入検討者向け。",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/about`,
    title: "サービス紹介・料金プラン | AI不動産診断レポート",
    description:
      "AIと国土交通省データを活用した不動産資産価値・リスク診断SaaS。Proプランは月額980円で無制限診断・PDF出力対応。",
    images: [{ url: `${SITE_URL}/ogp.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "サービス紹介・料金プラン | AI不動産診断レポート",
    description: "AIで不動産の資産価値とリスクを瞬時に分析。月額980円のProプランで無制限診断・PDF出力。",
    images: [`${SITE_URL}/ogp.png`],
  },
};

// ── Features data ────────────────────────────────────────────
const FEATURES = [
  {
    icon: "📊",
    title: "取引価格の可視化",
    desc: "国土交通省「不動産情報ライブラリ」の実取引データをもとに、周辺エリアの平均坪単価・価格推移グラフをリアルタイムで表示。価格交渉の根拠に使える客観データを即時取得できます。",
  },
  {
    icon: "🌊",
    title: "ハザード・生活環境データ",
    desc: "洪水・土砂・地震リスクをハザードマップと連動して表示。用途地域、学区、最寄り駅、医療機関など生活環境情報も一覧でまとめて確認できます。",
  },
  {
    icon: "✨",
    title: "AIによる10項目のエリア分析",
    desc: "Google Gemini が不動産コンサルタントの視点で、エリア総評・人口動態・投資価値・将来予測・プロのクロージングアドバイスなど10項目を自動レポート。商談前の事前調査を劇的に効率化します。",
  },
  {
    icon: "🖼️",
    title: "暮らしのイメージ画像生成",
    desc: "AI（Google Imagen）がそのエリアの実際の特徴（雪国・都市部・海沿いなど）を踏まえたリアルな「暮らしのイメージ画像」を自動生成。顧客への提案資料として活用できます。",
  },
  {
    icon: "📄",
    title: "PDF出力機能",
    desc: "サマリー・ハザード・グラフ・AIレポート・取引事例一覧を含む診断レポートをワンクリックでPDF化。地図・イメージ画像の出力有無をカスタマイズして、そのまま顧客への提案資料として提出できます。",
  },
  {
    icon: "🗂️",
    title: "検索履歴の自動保存",
    desc: "過去に調査したエリアの診断結果・画像をクラウドに自動保存。履歴から一瞬で再表示でき、継続的なエリア研究や複数物件の比較に役立ちます。",
  },
];

// ── Pricing data ─────────────────────────────────────────────
const PLANS = [
  {
    name: "Guest",
    label: "お試し",
    price: "無料",
    priceNote: "登録不要",
    color: "border-slate-200",
    badge: null,
    features: [
      { text: "1日1回の診断", ok: true },
      { text: "取引価格サマリー表示", ok: true },
      { text: "ハザード情報表示", ok: true },
      { text: "AIエリア分析レポート", ok: false },
      { text: "暮らしのイメージ生成", ok: false },
      { text: "検索履歴の保存", ok: false },
      { text: "PDF出力", ok: false },
    ],
    cta: "無料で試す",
    ctaHref: "/",
    ctaStyle: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  },
  {
    name: "Free",
    label: "無料プラン",
    price: "¥0",
    priceNote: "Googleアカウントで登録",
    color: "border-blue-200",
    badge: null,
    features: [
      { text: "1日3回の診断", ok: true },
      { text: "取引価格サマリー表示", ok: true },
      { text: "ハザード情報表示", ok: true },
      { text: "AIエリア分析（3項目まで）", ok: true },
      { text: "暮らしのイメージ生成", ok: false },
      { text: "検索履歴の保存", ok: true },
      { text: "PDF出力", ok: false },
    ],
    cta: "無料で登録",
    ctaHref: "/",
    ctaStyle: "bg-blue-600 text-white hover:bg-blue-700",
  },
  {
    name: "Pro",
    label: "プロプラン",
    price: "¥980",
    priceNote: "/ 月（税込）",
    color: "border-amber-400 ring-2 ring-amber-300",
    badge: "おすすめ",
    features: [
      { text: "無制限の診断", ok: true },
      { text: "取引価格サマリー表示", ok: true },
      { text: "ハザード情報表示", ok: true },
      { text: "AIエリア分析（全10項目）", ok: true },
      { text: "暮らしのイメージ生成", ok: true },
      { text: "検索履歴の保存", ok: true },
      { text: "PDF出力（フルカスタム）", ok: true },
    ],
    cta: "近日公開予定",
    ctaHref: "#pricing",
    ctaStyle: "bg-amber-500 text-white hover:bg-amber-600 cursor-not-allowed opacity-70",
  },
];

// ── Components ───────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* ── ナビゲーション ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 hover:text-slate-600 transition-colors">
            <span className="text-xl">🏠</span>
            <span className="text-sm leading-tight">不動産価値・リスク<br className="hidden sm:block" />診断レポート</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">機能</a>
            <a href="#pricing" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">料金</a>
            <a href="#legal" className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors">運営者情報</a>
            <Link
              href="/"
              className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              アプリを開く
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.25),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            国土交通省 公式APIデータ × Google Gemini AI
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
            AIが瞬時に不動産価値と<br />
            リスクを分析。<br className="sm:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-cyan-300">
              プロの視点をあなたの手に。
            </span>
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            緯度・経度を入力するだけで、周辺の取引価格推移・ハザード情報・AIによる10項目のエリア分析レポートを即座に生成。
            不動産営業・投資家・購入検討者のための次世代診断ツールです。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-bold text-base hover:bg-slate-100 transition-colors shadow-lg"
            >
              🔍 無料で診断してみる
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white font-medium text-base hover:bg-white/10 transition-colors"
            >
              機能を見る ↓
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-400">クレジットカード不要 · Googleアカウントで即時利用開始</p>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { num: "10項目", label: "AIエリア分析" },
            { num: "全国対応", label: "国交省データ" },
            { num: "数秒", label: "レポート生成時間" },
            { num: "PDF対応", label: "提案資料を即出力" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-extrabold text-slate-800">{s.num}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
            診断から提案まで、すべてが1ページで完結
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            物件調査にかかっていた数時間を、数秒に。現場のプロが求める情報を、ワンストップで提供します。
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
              シンプルな料金プラン
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              登録不要のお試しから、不動産のプロ向けフルプランまで。まずは無料で始められます。
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border-2 ${plan.color} p-6 flex flex-col`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{plan.label}</p>
                  <p className="text-3xl font-extrabold text-slate-900">{plan.price}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.priceNote}</p>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2.5">
                      {f.ok ? <CheckIcon /> : <XIcon />}
                      <span className={`text-sm ${f.ok ? "text-slate-700" : "text-slate-400"}`}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaHref}
                  className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors ${plan.ctaStyle}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">
            ※ 料金は予告なく変更する場合があります。Proプランは近日公開予定です。
          </p>
        </div>
      </section>

      {/* ── Legal / 特定商取引法 ── */}
      <section id="legal" className="max-w-3xl mx-auto px-4 py-20">
        <h2 className="text-xl font-extrabold text-slate-900 mb-8 pb-3 border-b border-slate-200">
          特定商取引法に基づく表記
        </h2>
        <div className="space-y-0 divide-y divide-slate-100">
          {[
            { label: "販売事業者名", value: "木下 開" },
            { label: "代表者名", value: "木下 開" },
            { label: "所在地", value: "東京都葛飾区東新小岩7-13-20" },
            { label: "電話番号", value: "070-8397-8965（受付時間: 平日 10:00〜18:00）" },
            { label: "メールアドレス", value: "realestate.report.support@gmail.com" },
            { label: "サービス名称", value: "不動産価値・リスク診断レポート（β版）" },
            { label: "サービスの内容", value: "国土交通省「不動産情報ライブラリ」データ及びAIを活用した不動産エリア診断SaaSサービス" },
            {
              label: "販売価格",
              value: "Guestプラン: 無料 / Freeプラン: 無料（Googleアカウント登録必須）/ Proプラン: 月額980円（税込）※Proプランは近日公開予定",
            },
            { label: "お支払方法", value: "クレジットカード決済（Stripe）。Visa / Mastercard / JCB / American Express 対応予定" },
            { label: "お支払時期", value: "Proプランへのアップグレード時に課金が発生し、以降は毎月同日に自動更新されます" },
            {
              label: "返金・キャンセルポリシー",
              value:
                "Proプランはいつでもキャンセル可能です。解約した場合、当月末日までサービスをご利用いただけます。日割り返金は行っておりません。ただし、サービスの重大な瑕疵により利用できなかった場合は、個別にご相談ください。",
            },
            { label: "サービスの提供時期", value: "お支払い確認後、即時にProプランの機能が有効化されます" },
            { label: "動作環境", value: "最新バージョンのGoogle Chrome / Safari / Firefox / Edge（インターネット接続必須）" },
          ].map(({ label, value }) => (
            <div key={label} className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-slate-600 mb-1 sm:mb-0">{label}</dt>
              <dd className="text-sm text-slate-700 sm:col-span-2 leading-relaxed">{value}</dd>
            </div>
          ))}
        </div>


      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 mt-0">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-semibold">
            <span>🏠</span>
            <span className="text-sm">不動産価値・リスク診断レポート</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-5 text-xs">
            <Link href="/" className="hover:text-white transition-colors">アプリを開く</Link>
            <a href="#features" className="hover:text-white transition-colors">機能紹介</a>
            <a href="#pricing" className="hover:text-white transition-colors">料金プラン</a>
            <a href="#legal" className="hover:text-white transition-colors">特定商取引法</a>
          </nav>
          <p className="text-xs">
            データソース: 国土交通省「不動産情報ライブラリ」
          </p>
        </div>
      </footer>
    </div>
  );
}
