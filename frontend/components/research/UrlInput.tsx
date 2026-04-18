"use client";

import { useState, useTransition } from "react";
import { parsePropertyUrl } from "@/app/[locale]/research/urlActions";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";

interface Props {
  onParsed: (data: ParsedPropertyData) => void;
  isEn: boolean;
}

export function UrlInput({ onParsed, isEn }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = {
    toggle:      isEn ? "Auto-fill from property URL (optional)" : "物件URLから自動入力（任意）",
    placeholder: isEn ? "https://suumo.jp/..." : "https://suumo.jp/...",
    fetch:       isEn ? "Fetch" : "取得",
    fetching:    isEn ? "Fetching…" : "取得中…",
    success:     isEn ? "Filled from:" : "取得元:",
    hint:        isEn
      ? "Paste a listing URL to auto-fill price, area, and address. Not all sites are supported."
      : "物件掲載URLを貼り付けると、価格・面積・住所を自動入力します。取得できない場合は手動で入力してください。",
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    setError(null);
    setSuccessTitle(null);

    startTransition(async () => {
      const result = await parsePropertyUrl(url.trim());
      if (result.ok) {
        onParsed(result.data);
        setSuccessTitle(result.title || url);
        setUrl("");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {t.toggle}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">{t.hint}</p>

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder={t.placeholder}
              disabled={isPending}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={isPending || !url.trim()}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {isPending ? t.fetching : t.fetch}
            </button>
          </div>

          {error && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {successTitle && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t.success} {successTitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
