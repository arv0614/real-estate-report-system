import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// ── HTTPセキュリティヘッダー ─────────────────────────────────────────────
// CSP設計:
//   - Firebase Auth/Firestore/Storage: *.googleapis.com, *.firebaseio.com
//   - Firebase Auth hidden iframe:     *.firebaseapp.com
//   - Firebase Auth 動的スクリプト:    apis.google.com, www.gstatic.com
//   - Google OAuth popup:              accounts.google.com
//   - Google profile photos:           lh3.googleusercontent.com
//   - PostHog analytics:               us.i.posthog.com, us-assets.i.posthog.com
//   - 国土地理院地図タイル:             cyberjapandata.gsi.go.jp
//   - 国土地理院住所検索API:            msearch.gsi.go.jp, mreversegeocoder.gsi.go.jp
//   - Cloud Run バックエンド:           *.run.app
//   - Lemon Squeezy 決済:              app.lemonsqueezy.com, assets.lemonsqueezy.com
//   - GTM + GA4:                       www.googletagmanager.com, www.google-analytics.com
//   - Next.js (inline styles/scripts): unsafe-inline, unsafe-eval
const CSP = [
  "default-src 'self'",
  // Next.js・FirebaseSDK・PostHog・Google API・GTM・GA4
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://us-assets.i.posthog.com https://assets.lemonsqueezy.com https://www.googletagmanager.com https://www.google-analytics.com",
  // Tailwind / CSS-in-JS
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.lemonsqueezy.com",
  // 画像: Firebase Storage / Google アカウント写真 / 国土地理院タイル / Lemon Squeezy / base64 / GTMピクセル
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://cyberjapandata.gsi.go.jp https://maps.gsi.go.jp https://assets.lemonsqueezy.com https://www.googletagmanager.com https://www.google-analytics.com",
  // フォント
  "font-src 'self' https://fonts.gstatic.com https://assets.lemonsqueezy.com",
  // API・WebSocket通信 + GA4データ収集
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.run.app https://msearch.gsi.go.jp https://mreversegeocoder.gsi.go.jp https://*.firebaseapp.com https://app.lemonsqueezy.com https://api.lemonsqueezy.com https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com",
  // Google OAuth ポップアップ + Firebase Auth hidden iframe + Lemon Squeezy チェックアウト + GTM noscript iframe
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://app.lemonsqueezy.com https://www.googletagmanager.com",
  // Service Worker
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  // HTTPS強制 (2年)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // MIMEスニッフィング防止
  { key: "X-Content-Type-Options", value: "nosniff" },
  // クリックジャッキング防止
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // XSS (レガシーブラウザ向け)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // リファラー制御
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 不要なブラウザAPI無効化
  { key: "Permissions-Policy", value: "camera=(), microphone=()" },
  // Content Security Policy
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        // すべてのルートに適用
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
