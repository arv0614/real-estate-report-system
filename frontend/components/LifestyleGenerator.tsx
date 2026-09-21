"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "firebase/auth";
import { generateHouseImages, type HouseAreaDataPayload, type HouseImagesResponse } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { UserPlan } from "@/lib/userPlan";

/** 入力できるタグの上限。プロンプトが発散するのを防ぐ */
const MAX_TAGS = 12;
/** 1タグあたりの最大文字数（バックエンドの zod 制約と合わせる） */
const MAX_TAG_LENGTH = 40;

interface Props {
  user: User | null;
  plan: UserPlan | null;
  prefecture: string;
  municipality: string;
  district?: string | null;
  /** 気象・ハザード・用途地域などの実データ。プロンプトのブレンド素材として送る */
  areaData?: HouseAreaDataPayload;
  onLoginRequest?: () => void;
  onPlanModalOpen?: () => void;
}

/**
 * 「暮らしのイメージ画像生成」UI。
 *
 * - こだわり条件をフリーテキストでタグ化し、チップ形式で追加・削除できる
 * - 生成は **ボタン押下時のみ**。マウント時や検索完了時に自動で API を叩かない
 *   （画像生成は1回で2枚分のコストがかかるため）
 * - 生成後は外観画像と間取り図画像を並べて表示する
 */
export function LifestyleGenerator({
  user,
  plan,
  prefecture,
  municipality,
  district,
  areaData,
  onLoginRequest,
  onPlanModalOpen,
}: Props) {
  const t = useTranslations("LifestyleGenerator");

  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<HouseImagesResponse | null>(null);

  const isPro = plan === "pro";

  function addTag() {
    const value = input.trim().slice(0, MAX_TAG_LENGTH);
    if (!value) return;
    if (tags.includes(value)) {
      setInput("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(t("errorMaxTags", { max: MAX_TAGS }));
      return;
    }
    setTags((prev) => [...prev, value]);
    setInput("");
    setError(null);
  }

  function removeTag(target: string) {
    setTags((prev) => prev.filter((tag) => tag !== target));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 変換確定の Enter でタグが作られないよう、composing 中は無視する
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    addTag();
  }

  /** ★ここだけが画像生成APIの呼び出し口。ボタン押下以外から呼ばないこと。 */
  async function handleGenerate() {
    if (loading) return;

    if (!user) {
      onLoginRequest?.();
      return;
    }

    // ペイウォール: Pro 以外はここでブロックし、API は絶対に叩かない
    if (!isPro) {
      trackEvent({
        action: "view_plan_modal",
        category: "conversion_funnel",
        label: "lifestyle_generator",
        params: { user_plan: plan ?? "free" },
      });
      onPlanModalOpen?.();
      return;
    }

    trackEvent({
      action: "generate_house_images",
      category: "engagement",
      label: `${prefecture}${municipality}`,
      value: tags.length,
    });

    setLoading(true);
    setError(null);
    try {
      const result = await generateHouseImages({
        prefecture,
        municipality,
        district: district ?? null,
        tags,
        areaData,
      });
      setImages(result);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === "RATE_LIMITED" ? t("errorRateLimited") : t("errorGenerate"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-3">
        <span className="text-2xl">🏠</span>
        <div>
          <h2 className="text-white font-bold text-base leading-tight">{t("title")}</h2>
          <p className="text-indigo-200 text-xs mt-0.5">
            {t("subtitle", { area: `${prefecture}${municipality}` })}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ── タグ入力 ───────────────────────────────── */}
        <div>
          <label
            htmlFor="lifestyle-tag-input"
            className="block text-sm font-semibold text-slate-700 mb-2"
          >
            {t("tagLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="lifestyle-tag-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_TAG_LENGTH}
              placeholder={t("tagPlaceholder")}
              className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              onClick={addTag}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("addBtn")}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">{t("tagHint", { max: MAX_TAGS })}</p>

          {/* チップ一覧 */}
          {tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-3 pr-1.5 text-sm text-indigo-800"
                >
                  <span className="break-all">{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={t("removeTag", { tag })}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-indigo-500 transition-colors hover:bg-indigo-200 hover:text-indigo-900"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-400">{t("tagEmpty")}</p>
          )}
        </div>

        {/* ── 生成ボタン ─────────────────────────────── */}
        <div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? (
              <>
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden
                />
                {t("generatingBtn")}
              </>
            ) : (
              <>
                <span className="text-2xl">✨</span>
                {images ? t("regenerateBtn") : t("generateBtn")}
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">{t("generateNote")}</p>
          {error && (
            <p role="alert" className="mt-2 text-center text-xs text-red-500">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* ── 生成中: スケルトン ─────────────────────── */}
        {loading && (
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              {["exterior", "floorPlan"].map((key) => (
                <div key={key} className="space-y-2">
                  <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100" />
                  <div className="mx-auto h-2.5 w-2/3 animate-pulse rounded bg-indigo-100" />
                </div>
              ))}
            </div>
            <p className="pt-3 text-center text-sm text-slate-500">
              {t("loadingText")}
              <span className="ml-0.5 inline-block animate-bounce">...</span>
            </p>
          </div>
        )}

        {/* ── 生成結果: 外観 + 間取り図 ───────────────── */}
        {!loading && images && (
          <div style={{ animation: "fadeInUp 0.5s ease both" }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure className="overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${images.exterior.mimeType};base64,${images.exterior.imageBase64}`}
                  alt={t("exteriorAlt", { area: `${prefecture}${municipality}` })}
                  className="w-full bg-slate-50 object-cover"
                />
                <figcaption className="bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  {t("exteriorCaption")}
                </figcaption>
              </figure>
              <figure className="overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${images.floorPlan.mimeType};base64,${images.floorPlan.imageBase64}`}
                  alt={t("floorPlanAlt")}
                  className="w-full bg-white object-cover"
                />
                <figcaption className="bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  {t("floorPlanCaption")}
                </figcaption>
              </figure>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">{t("imageNote")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
