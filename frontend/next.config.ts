import type { NextConfig } from "next";

// ── HTTPセキュリティヘッダー ─────────────────────────────────────────────
// CSP設計:
//   - Firebase Auth/Firestore/Storage: *.googleapis.com, *.firebaseio.com
//   - Google OAuth popup:              accounts.google.com
//   - Google profile photos:           lh3.googleusercontent.com
//   - PostHog analytics:               us.i.posthog.com (NEXT_PUBLIC_POSTHOG_HOST)
//   - 国土地理院地図タイル:             cyberjapandata.gsi.go.jp
//   - Cloud Run バックエンド:           *.run.app
//   - Next.js (inline styles/scripts): unsafe-inline, unsafe-eval
const CSP = [
  "default-src 'self'",
  // Next.js hydration・FirebaseSDK・PostHog
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind / CSS-in-JS
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // 画像: Firebase Storage / Google アカウント写真 / 国土地理院タイル / base64
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://cyberjapandata.gsi.go.jp https://maps.gsi.go.jp",
  // フォント
  "font-src 'self' https://fonts.gstatic.com",
  // API・WebSocket通信
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://us.i.posthog.com https://*.run.app",
  // Google OAuth ポップアップ
  "frame-src 'self' https://accounts.google.com",
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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content Security Policy
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        // すべてのルートに適用
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
