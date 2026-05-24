"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FirebaseError } from "firebase/app";
import { getAdditionalUserInfo } from "firebase/auth";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPasswordReset,
} from "@/lib/firebase";
import { gtagEvent } from "@/lib/gtag";
import type { AuthModalMode } from "./AuthModalContext";

interface Props {
  open: boolean;
  mode: AuthModalMode;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
}

function mapAuthError(t: ReturnType<typeof useTranslations<"Auth">>, code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return t("errorInvalidEmail");
    case "auth/missing-password":
    case "auth/weak-password":
      return t("errorWeakPassword");
    case "auth/email-already-in-use":
      return t("errorEmailInUse");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return t("errorInvalidCredential");
    case "auth/too-many-requests":
      return t("errorTooManyRequests");
    case "auth/network-request-failed":
      return t("errorNetwork");
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/popup-blocked":
      return ""; // ユーザー操作によるキャンセルはエラー表示しない
    default:
      return t("errorUnknown");
  }
}

export function AuthModal({ open, mode, onModeChange, onClose }: Props) {
  const t = useTranslations("Auth");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // モーダルを閉じたタイミングで状態をリセット
  useEffect(() => {
    if (!open) {
      const tm = setTimeout(() => {
        setEmail("");
        setPassword("");
        setError(null);
        setSubmitting(false);
        setResetSent(false);
      }, 200);
      return () => clearTimeout(tm);
    }
  }, [open]);

  // モード切替時もエラーや一時状態をクリアする
  useEffect(() => {
    setError(null);
    setResetSent(false);
  }, [mode]);

  if (!open) return null;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t("errorEmailRequired"));
      return;
    }

    if (mode === "reset") {
      setSubmitting(true);
      try {
        await sendPasswordReset(trimmedEmail);
        setResetSent(true);
      } catch (err) {
        const code = err instanceof FirebaseError ? err.code : "";
        setError(mapAuthError(t, code) || t("errorUnknown"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError(t("errorPasswordRequired"));
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError(t("errorWeakPassword"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(trimmedEmail, password);
        // createUserWithEmailAndPassword は常に新規ユーザー作成なので無条件で計測
        gtagEvent({ action: "sign_up", category: "engagement", label: "email" });
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      onClose();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(mapAuthError(t, code) || t("errorUnknown"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const cred = await signInWithGoogle();
      // 既存ユーザーのログインは除外し、新規サインアップ時のみ計測する
      if (getAdditionalUserInfo(cred)?.isNewUser) {
        gtagEvent({ action: "sign_up", category: "engagement", label: "google" });
      }
      onClose();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      const message = mapAuthError(t, code);
      if (message) setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "signin" ? t("signInTitle") :
    mode === "signup" ? t("signUpTitle") :
    t("resetTitle");

  const subtitle =
    mode === "signin" ? t("signInSubtitle") :
    mode === "signup" ? t("signUpSubtitle") :
    t("resetSubtitle");

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-modal-title" className="text-white font-bold text-lg leading-tight">
              {title}
            </h2>
            <p className="text-blue-100 text-xs mt-1 leading-snug">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none transition-colors -mr-1"
            aria-label={t("closeBtn")}
          >
            ×
          </button>
        </div>

        {/* タブ切替（reset 中は非表示） */}
        {mode !== "reset" && (
          <div className="px-6 pt-4">
            <div className="flex gap-1 p-1 rounded-lg bg-slate-100">
              <button
                type="button"
                onClick={() => onModeChange("signin")}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === "signin"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("tabSignIn")}
              </button>
              <button
                type="button"
                onClick={() => onModeChange("signup")}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === "signup"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("tabSignUp")}
              </button>
            </div>
          </div>
        )}

        {/* ボディ */}
        <div className="px-6 py-5">
          {mode === "reset" && resetSent ? (
            <div className="text-center py-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-slate-800 text-sm mb-1">{t("resetSentTitle")}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{t("resetSentDesc")}</p>
              <button
                type="button"
                onClick={() => onModeChange("signin")}
                className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                {t("backToSignIn")}
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t("emailLabel")}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {mode !== "reset" && (
                  <div>
                    <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {t("passwordLabel")}
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 6 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? t("passwordPlaceholderSignUp") : t("passwordPlaceholder")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {mode === "signup" && (
                      <p className="mt-1 text-[10px] text-slate-400">{t("passwordHint")}</p>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-600 flex items-start gap-1">
                    <span>⚠</span> <span className="flex-1">{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t("submitting")}
                    </>
                  ) : (
                    mode === "signin" ? t("signInButton") :
                    mode === "signup" ? t("signUpButton") :
                    t("resetButton")
                  )}
                </button>
              </form>

              {/* リセットモードへの遷移/復帰 */}
              <div className="flex items-center justify-between mt-3 text-xs">
                {mode === "reset" ? (
                  <button
                    type="button"
                    onClick={() => onModeChange("signin")}
                    className="text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    ← {t("backToSignIn")}
                  </button>
                ) : (
                  <>
                    <span className="text-slate-400" />
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => onModeChange("reset")}
                        className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        {t("forgotPassword")}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 区切り線 + Google ログイン（reset 中は非表示） */}
              {mode !== "reset" && (
                <>
                  <div className="my-4 flex items-center gap-3">
                    <span className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">
                      {t("orDivider")}
                    </span>
                    <span className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t("googleButton")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
