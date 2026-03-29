"use client";

import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { FREE_DAILY_LIMIT, GUEST_DAILY_LIMIT } from "@/lib/userPlan";
import type { UserPlan } from "@/lib/userPlan";

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlan?: UserPlan | null; // null = guest
  uid?: string | null;
  userEmail?: string | null;
}

type Feature = {
  label: string;
  guest: string;
  free: string;
  pro: string;
};

const FEATURES: Feature[] = [
  {
    label: "1日の検索回数",
    guest: `${GUEST_DAILY_LIMIT}回`,
    free: `${FREE_DAILY_LIMIT}回`,
    pro: "無制限",
  },
  {
    label: "取引価格サマリー",
    guest: "○",
    free: "○",
    pro: "○",
  },
  {
    label: "ハザード情報",
    guest: "○",
    free: "○",
    pro: "○",
  },
  {
    label: "生活環境情報",
    guest: "○",
    free: "○",
    pro: "○",
  },
  {
    label: "価格推移グラフ",
    guest: "○",
    free: "○",
    pro: "○",
  },
  {
    label: "AIレポート（全10項目）",
    guest: "✕ ロック",
    free: "3項目まで",
    pro: "全項目",
  },
  {
    label: "暮らしイメージ生成",
    guest: "✕",
    free: "○",
    pro: "○",
  },
  {
    label: "PDF出力",
    guest: "✕",
    free: "✕",
    pro: "○",
  },
  {
    label: "検索履歴の保存",
    guest: "✕",
    free: "○",
    pro: "○",
  },
];

function Cell({ value, highlight }: { value: string; highlight?: boolean }) {
  const isX = value.startsWith("✕");
  const isUnlimited = value === "無制限" || value === "全項目";
  return (
    <td
      className={`px-3 py-3 text-center text-sm border-b border-slate-100 ${
        highlight ? "bg-amber-50" : ""
      } ${
        isX
          ? "text-slate-400"
          : isUnlimited
          ? "text-amber-600 font-semibold"
          : "text-slate-700"
      }`}
    >
      {value}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────
// 🚦 Stripe 審査フラグ
//    審査通過後に `true` へ変更するだけで決済導線が有効になる
//    変更箇所: この1行のみ
// ─────────────────────────────────────────────────────────────
const IS_STRIPE_APPROVED = false;

export function PlanComparisonModal({ open, onClose, currentPlan, uid, userEmail }: Props) {
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);

  if (!open) return null;

  async function handleGoogleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (e) {
      console.error("ログインエラー:", e);
    }
  }

  async function handleUpgrade() {
    // 審査中はStripeへ遷移せず案内メッセージを表示
    if (!IS_STRIPE_APPROVED) {
      alert("現在Stripeによる決済審査中です。数日以内に公開予定ですので、今しばらくお待ちください。");
      return;
    }
    if (!uid) return;
    setCheckoutLoading(true);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, email: userEmail ?? undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "決済セッションの作成に失敗しました。");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      console.error("[Stripe] checkout error:", e);
      alert("決済処理中にエラーが発生しました。");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">プランと料金</h2>
            <p className="text-purple-200 text-xs mt-0.5">あなたに合ったプランを選んでください</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none transition-colors"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* プラン名ヘッダー */}
        <div className="px-6 pt-5 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-sm text-slate-500 font-medium w-40" />
                  <th className="px-3 py-2 text-center w-28">
                    <div className="text-slate-600 font-semibold text-sm">ゲスト</div>
                    <div className="text-slate-400 text-xs">未ログイン</div>
                    <div className="mt-1.5 text-slate-500 font-bold text-base">無料</div>
                  </th>
                  <th className="px-3 py-2 text-center w-28">
                    <div className="text-blue-600 font-semibold text-sm">フリー</div>
                    <div className="text-slate-400 text-xs">無料ログイン</div>
                    <div className="mt-1.5 text-blue-600 font-bold text-base">¥0</div>
                  </th>
                  <th className="px-3 py-2 text-center w-28 relative">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        おすすめ
                      </span>
                    </div>
                    <div className="text-amber-600 font-semibold text-sm pt-3">プロ</div>
                    <div className="text-slate-400 text-xs">有料プラン</div>
                    <div className="mt-1.5 text-amber-600 font-bold text-base">近日公開</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.label} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-3 text-sm text-slate-600 border-b border-slate-100 font-medium">
                      {f.label}
                    </td>
                    <Cell value={f.guest} />
                    <Cell value={f.free} />
                    <Cell value={f.pro} highlight />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 py-5 space-y-3">
          {/* ゲスト → 無料ログインCTA */}
          {!currentPlan && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 text-sm text-blue-800">
                <span className="font-semibold">Googleアカウントで無料ログイン</span>すると、
                1日{FREE_DAILY_LIMIT}回の検索とAIレポートの一部が無料で使えます。
              </div>
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                無料ではじめる
              </button>
            </div>
          )}

          {/* フリー → プロCTA */}
          {currentPlan === "free" && (
            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 text-sm text-amber-800">
                <span className="font-semibold">プロプランにアップグレード</span>すると、
                無制限検索・AIレポート全10項目・PDF出力がすべて使えます。
              </div>
              <button
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm shrink-0 ${
                  IS_STRIPE_APPROVED
                    ? "bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    : "bg-slate-400 cursor-not-allowed"
                }`}
                onClick={handleUpgrade}
                disabled={IS_STRIPE_APPROVED && (checkoutLoading || !uid)}
              >
                {IS_STRIPE_APPROVED ? (
                  checkoutLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>✨ Proプランにアップグレード</>
                  )
                ) : (
                  <>🚀 近日公開予定</>
                )}
              </button>
            </div>
          )}

          {/* プロユーザー */}
          {currentPlan === "pro" && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 text-center">
              ✅ プロプランをご利用いただいています。すべての機能が使えます。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
