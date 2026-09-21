"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "firebase/auth";
import { generateHouseImages, type HouseAreaDataPayload, type HouseImagesResponse } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { TagInput } from "@/components/TagInput";
import { ImageLightbox, DownloadIcon } from "@/components/ImageLightbox";
import type { UserPlan } from "@/lib/userPlan";

interface Props {
  user: User | null;
  plan: UserPlan | null;
  prefecture: string;
  municipality: string;
  district?: string | null;
  /** 気象・ハザード・用途地域などの実データ。プロンプトのブレンド素材として送る */
  areaData?: HouseAreaDataPayload;
  /** マイページに保存済みのこだわり条件。タグの初期値として読み込む */
  initialTags?: string[];
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
  initialTags,
  onLoginRequest,
  onPlanModalOpen,
}: Props) {
  const t = useTranslations("LifestyleGenerator");

  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<HouseImagesResponse | null>(null);
  /** 拡大表示中の画像。null なら Lightbox を閉じている */
  const [lightbox, setLightbox] = useState<"exterior" | "floorPlan" | null>(null);
  /** ユーザーがこの画面でタグを触ったら、後から届く初期値で上書きしない */
  const editedRef = useRef(false);

  const isPro = plan === "pro";
  // ダウンロードファイル名に使うエリア名（パス区切りなど使えない文字だけ除去）
  const areaSlug = `${prefecture}${municipality}`.replace(/[\\/:*?"<>|\s]+/g, "-");
  // 設計コンセプト。旧バックエンドは返さないので prompts 側も見てフォールバックする
  const concept = images?.conceptExplanation?.trim() || images?.prompts?.conceptExplanation?.trim() || "";

  // マイページ保存分（Firestore）は検索より後に届くことがあるため、届いた時点で反映する。
  // ただしユーザーが既に編集していれば尊重する。
  const initialKey = (initialTags ?? []).join("\u0000");
  useEffect(() => {
    if (editedRef.current) return;
    setTags(initialTags ?? []);
    // initialKey で内容変化のみを検知する（配列の参照変化では再実行しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  function handleTagsChange(next: string[]) {
    editedRef.current = true;
    setTags(next);
    setError(null);
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
    setLightbox(null);
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
          <TagInput
            tags={tags}
            onChange={handleTagsChange}
            inputId="lifestyle-tag-input"
            disabled={loading}
          />
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
            {/* AI が考えた設計コンセプト（提案の理由）。画像より先に読ませる */}
            {concept && (
              <figure className="mb-4 overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                <figcaption className="flex items-center gap-2 border-b border-indigo-200/70 bg-white/60 px-4 py-2.5">
                  <span className="text-base" aria-hidden>
                    💡
                  </span>
                  <span className="text-sm font-bold text-indigo-900">{t("conceptTitle")}</span>
                </figcaption>
                <blockquote className="px-4 py-3.5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{concept}</p>
                </blockquote>
              </figure>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <GeneratedImageCard
                src={`data:${images.exterior.mimeType};base64,${images.exterior.imageBase64}`}
                alt={t("exteriorAlt", { area: `${prefecture}${municipality}` })}
                caption={t("exteriorCaption")}
                downloadName={buildDownloadName("exterior", areaSlug, images.exterior.mimeType)}
                imageClassName="bg-slate-50"
                onExpand={() => setLightbox("exterior")}
              />
              <GeneratedImageCard
                src={`data:${images.floorPlan.mimeType};base64,${images.floorPlan.imageBase64}`}
                alt={t("floorPlanAlt")}
                caption={t("floorPlanCaption")}
                downloadName={buildDownloadName("floor-plan", areaSlug, images.floorPlan.mimeType)}
                imageClassName="bg-white"
                onExpand={() => setLightbox("floorPlan")}
              />
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">{t("imageNote")}</p>
          </div>
        )}
      </div>

      {/* ── 拡大表示（Lightbox） ───────────────────── */}
      {images && lightbox && (
        <ImageLightbox
          src={`data:${images[lightbox].mimeType};base64,${images[lightbox].imageBase64}`}
          alt={
            lightbox === "exterior"
              ? t("exteriorAlt", { area: `${prefecture}${municipality}` })
              : t("floorPlanAlt")
          }
          caption={lightbox === "exterior" ? t("exteriorCaption") : t("floorPlanCaption")}
          downloadName={buildDownloadName(
            lightbox === "exterior" ? "exterior" : "floor-plan",
            areaSlug,
            images[lightbox].mimeType,
          )}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/** 生成画像1枚のカード。クリックで拡大、下部にダウンロードボタンを持つ。 */
function GeneratedImageCard({
  src,
  alt,
  caption,
  downloadName,
  imageClassName,
  onExpand,
}: {
  src: string;
  alt: string;
  caption: string;
  downloadName: string;
  imageClassName: string;
  onExpand: () => void;
}) {
  const t = useTranslations("LifestyleGenerator");

  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={onExpand}
        aria-label={t("expandImage", { caption })}
        className="group relative block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`w-full object-cover ${imageClassName}`} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
          🔍 {t("expandHint")}
        </span>
      </button>
      <figcaption className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
        <span className="truncate text-xs font-semibold text-slate-600">{caption}</span>
        <a
          href={src}
          download={downloadName}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-400 hover:text-indigo-700"
        >
          <DownloadIcon />
          {t("downloadBtn")}
        </a>
      </figcaption>
    </figure>
  );
}

/** `mekiki-exterior-tokyo-minato.png` のようなダウンロードファイル名を組み立てる */
function buildDownloadName(kind: string, areaSlug: string, mimeType: string): string {
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  return `mekiki-${kind}${areaSlug ? `-${areaSlug}` : ""}.${ext}`;
}
