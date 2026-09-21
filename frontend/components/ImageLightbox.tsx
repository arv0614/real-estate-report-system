"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface Props {
  /** 表示する画像の data URL（`data:image/png;base64,...`） */
  src: string;
  alt: string;
  /** モーダル上部に出すキャプション（「外観イメージ」など） */
  caption: string;
  /** ダウンロード時のファイル名（拡張子込み） */
  downloadName: string;
  onClose: () => void;
}

/**
 * 生成画像の拡大表示（Lightbox）。
 *
 * - 背景クリック / × ボタン / Esc キーで閉じる
 * - モーダル内からそのままダウンロードできる
 * - 開いている間は背面のスクロールを止める
 */
export function ImageLightbox({ src, alt, caption, downloadName, onClose }: Props) {
  const t = useTranslations("LifestyleGenerator");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      {/* 画像本体。背景クリックでのみ閉じたいので、内側のクリックは伝播させない */}
      {/* アニメーションは内側だけに掛ける（fixed な背景に transform を掛けると位置がずれるため） */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeInUp 0.2s ease both" }}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-700">{caption}</p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={src}
              download={downloadName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <DownloadIcon />
              {t("downloadBtn")}
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("closeBtn")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-900/5 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
        </div>
      </div>
    </div>
  );
}

/** ダウンロードアイコン（下向き矢印 + トレイ） */
export function DownloadIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
