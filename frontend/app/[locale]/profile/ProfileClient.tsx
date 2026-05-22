"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useBookmarks, type Bookmark } from "@/lib/bookmarks";
import { useAuthModal } from "@/components/AuthModalContext";
import {
  getWhiteLabelConfig,
  saveWhiteLabelConfig,
  EMPTY_WHITE_LABEL,
  type WhiteLabelConfig,
} from "@/lib/userPlan";
import { PlanComparisonModal } from "@/components/PlanComparisonModal";
import { gtagEvent } from "@/lib/gtag";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
const MAX_COMPANY_NAME = 50;

export default function ProfileClient() {
  const t = useTranslations("Profile");
  const { user, loading: authLoading, plan, planLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const [config, setConfig] = useState<WhiteLabelConfig>(EMPTY_WHITE_LABEL);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setConfig(EMPTY_WHITE_LABEL);
      setInitialLoaded(true);
      return;
    }
    let cancelled = false;
    getWhiteLabelConfig(user.uid).then((c) => {
      if (cancelled) return;
      setConfig(c);
      setInitialLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  function handleLogin() {
    openAuthModal("signin");
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(t("errorFileType"));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError(t("errorFileSize"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `users/${user.uid}/whitelabel-logo.${ext}`;
      const objectRef = storageRef(storage, path);
      await uploadBytes(objectRef, file, { contentType: file.type });
      const url = await getDownloadURL(objectRef);
      setConfig((prev) => ({ ...prev, companyLogoUrl: url }));
    } catch (err) {
      console.error("[profile] logo upload failed:", err);
      setError(t("errorUpload"));
    } finally {
      setUploading(false);
      // input をリセットして同じファイルを再選択できるようにする
      e.target.value = "";
    }
  }

  async function handleLogoRemove() {
    if (!user) return;
    // Storage 側のファイルは extension が不明な場合があるので、ベストエフォートで削除
    const url = config.companyLogoUrl;
    setConfig((prev) => ({ ...prev, companyLogoUrl: "" }));
    if (!url) return;
    try {
      // download URL から path を逆引き
      const match = url.match(/\/o\/([^?]+)/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        await deleteObject(storageRef(storage, path));
      }
    } catch (err) {
      // Storage 削除失敗は致命的ではない（古いファイルが残るだけ）
      console.warn("[profile] logo delete failed (non-fatal):", err);
    }
  }

  async function handleManageSubscription() {
    if (!user) return;
    setPortalError(null);
    setPortalLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setPortalError(t("manageSubscriptionError"));
        return;
      }
      const res = await fetch(`${getApiBase()}/api/lemonsqueezy/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[profile] portal request failed:", body);
        setPortalError(body.error ?? t("manageSubscriptionError"));
        return;
      }
      const { url } = await res.json();
      if (!url) {
        setPortalError(t("manageSubscriptionError"));
        return;
      }
      window.location.href = url;
    } catch (err) {
      console.error("[profile] portal error:", err);
      setPortalError(t("manageSubscriptionError"));
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const trimmed: WhiteLabelConfig = {
        companyName: config.companyName.trim().slice(0, MAX_COMPANY_NAME),
        companyLogoUrl: config.companyLogoUrl,
      };
      await saveWhiteLabelConfig(user.uid, trimmed);
      setConfig(trimmed);
      setSavedAt(Date.now());
      gtagEvent({ action: "save_whitelabel", category: "engagement", label: trimmed.companyLogoUrl ? "with_logo" : "name_only" });
    } catch (err) {
      console.error("[profile] save failed:", err);
      setError(t("errorSave"));
    } finally {
      setSaving(false);
    }
  }

  const isPro = plan === "pro";
  const showLoadingState = authLoading || (user && (planLoading || !initialLoaded));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            {t("backHome")}
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{t("pageTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("pageSubtitle")}</p>
        </header>

        {showLoadingState && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            <span className="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin align-middle mr-2" />
            Loading...
          </div>
        )}

        {!showLoadingState && !user && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">{t("loginRequiredTitle")}</h2>
            <p className="text-sm text-slate-600 mb-4">{t("loginRequiredBody")}</p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              {t("loginButton")}
            </button>
          </div>
        )}

        {!showLoadingState && user && !isPro && (
          <FreeLockedCard
            onUpgrade={() => {
              gtagEvent({ action: "view_plan_modal", category: "conversion_funnel", label: "profile" });
              setPlanModalOpen(true);
            }}
          />
        )}

        {!showLoadingState && user && isPro && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{t("subscriptionTitle")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("subscriptionBody")}</p>
              </div>
              <div>
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
                >
                  {portalLoading && (
                    <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  )}
                  {portalLoading ? t("manageSubscriptionLoading") : t("manageSubscription")}
                </button>
                {portalError && (
                  <p className="mt-2 text-sm text-red-600">{portalError}</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("companyNameLabel")}
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={config.companyName}
                  maxLength={MAX_COMPANY_NAME}
                  onChange={(e) => setConfig((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder={t("companyNamePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">{t("companyNameHelp")}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("companyLogoLabel")}
                </label>
                <p className="text-xs text-slate-500 mb-2">{t("companyLogoHelp")}</p>

                {config.companyLogoUrl ? (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.companyLogoUrl}
                      alt="logo"
                      className="h-14 w-auto max-w-[200px] object-contain bg-white rounded border border-slate-200 px-2 py-1"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="inline-flex items-center justify-center text-xs px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                        {uploading ? t("companyLogoUploading") : t("companyLogoChange")}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="sr-only"
                          onChange={handleLogoChange}
                          disabled={uploading}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {t("companyLogoRemove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                    <span>📤</span>
                    {uploading ? t("companyLogoUploading") : t("companyLogoSelect")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="sr-only"
                      onChange={handleLogoChange}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || uploading}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
                >
                  {saving ? t("saving") : t("saveButton")}
                </button>
                {savedAt && Date.now() - savedAt < 3000 && (
                  <span className="text-sm text-green-600 font-medium">✓ {t("saved")}</span>
                )}
              </div>
            </div>

            {/* プレビュー */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">{t("previewTitle")}</h3>
              <p className="text-xs text-slate-500 mb-3">{t("previewNote")}</p>
              <WhiteLabelPreview config={config} />
            </div>
          </div>
        )}

        {/* 保存したエリア（プランに関係なくログインユーザーに表示） */}
        {!showLoadingState && user && (
          <div className="mt-6">
            <BookmarksSection uid={user.uid} />
          </div>
        )}
      </div>

      <PlanComparisonModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlan={plan}
        uid={user?.uid}
        userEmail={user?.email}
      />
    </main>
  );
}

function FreeLockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  const t = useTranslations("Profile");
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <h2 className="text-lg font-bold text-amber-900">{t("freeLockTitle")}</h2>
        <p className="mt-2 text-sm text-amber-800">{t("freeLockBody")}</p>
        <button
          onClick={onUpgrade}
          className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow"
        >
          {t("freeLockCta")}
        </button>
      </div>

      {/* ロック状態の UI プレビュー（操作不可） */}
      <div className="relative bg-white rounded-xl border border-slate-200 p-6 select-none">
        <div className="pointer-events-none opacity-50 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("companyNameLabel")}
            </label>
            <input
              type="text"
              disabled
              placeholder={t("companyNamePlaceholder")}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">{t("companyNameHelp")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("companyLogoLabel")}
            </label>
            <p className="text-xs text-slate-500 mb-2">{t("companyLogoHelp")}</p>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-400 bg-slate-50">
              <span>📤</span>
              {t("companyLogoSelect")}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border-2 border-amber-400 text-amber-700 font-bold text-sm shadow-lg hover:bg-amber-50 transition-colors"
          >
            🔒 {t("freeLockCta")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookmarksSection({ uid }: { uid: string }) {
  const t = useTranslations("Bookmarks");
  const { items, loading, error, remove } = useBookmarks(uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await remove(id);
    } catch (err) {
      console.error("[profile] bookmark delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t("sectionTitle")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("sectionDescription")}</p>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">{t("loading")}</p>
      )}
      {error && !loading && (
        <p className="mt-4 text-sm text-red-600">{t("loadError")}</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">{t("empty")}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
          {items.map((b) => (
            <BookmarkRow
              key={b.id}
              bookmark={b}
              deleting={deletingId === b.id}
              onDelete={() => handleDelete(b.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookmarkRow({
  bookmark,
  deleting,
  onDelete,
}: {
  bookmark: Bookmark;
  deleting: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations("Bookmarks");
  const href = `/?lat=${bookmark.lat}&lng=${bookmark.lng}&zoom=${bookmark.zoom}`;
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
      <Link href={href} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{bookmark.title}</p>
        <p className="text-xs text-slate-500">
          {bookmark.lat.toFixed(4)}, {bookmark.lng.toFixed(4)}
          {bookmark.createdAt
            ? ` · ${new Date(bookmark.createdAt).toLocaleDateString()}`
            : ""}
        </p>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={t("delete")}
        className="text-xs px-2.5 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
      >
        {deleting ? t("deleting") : t("delete")}
      </button>
    </li>
  );
}

function WhiteLabelPreview({ config }: { config: WhiteLabelConfig }) {
  const hasLogo = !!config.companyLogoUrl;
  const hasName = !!config.companyName.trim();
  if (!hasLogo && !hasName) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-400">
        —
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex items-center gap-4">
      {hasLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.companyLogoUrl}
          alt="logo"
          className="h-10 w-auto max-w-[160px] object-contain"
        />
      )}
      {hasName && (
        <div className="text-sm font-semibold text-slate-700">{config.companyName}</div>
      )}
      <div className="ml-auto text-[10px] text-slate-400 uppercase tracking-wide">
        Property Report
      </div>
    </div>
  );
}
