"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  title: string;
  url: string;
}

export default function BlogShareButtons({ title, url }: Props) {
  const t = useTranslations("Blog");
  const [copied, setCopied] = useState(false);

  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  const xUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${title} ${url}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(t("copyFailed"));
    }
  }

  // 共通スタイル: スマホでも押しやすい min-h-11 / タップ領域広め
  const btnBase =
    "inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors";

  return (
    <section className="mt-12 border-t border-slate-200 pt-8">
      <h2 className="text-base font-bold text-slate-800 mb-4">{t("shareThisArticle")}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("shareOnX")}
          className={`${btnBase} bg-slate-900 text-white hover:bg-slate-800`}
        >
          <span aria-hidden className="font-bold text-base">𝕏</span>
          <span>{t("shareOnX")}</span>
        </a>
        <a
          href={threadsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("shareOnThreads")}
          className={`${btnBase} border border-slate-900 bg-white text-slate-900 hover:bg-slate-50`}
        >
          <span aria-hidden className="font-bold text-base">@</span>
          <span>{t("shareOnThreads")}</span>
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("shareOnFacebook")}
          className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
        >
          <span aria-hidden className="font-bold text-base">f</span>
          <span>{t("shareOnFacebook")}</span>
        </a>
        <button
          type="button"
          onClick={copyLink}
          aria-label={t("copyLink")}
          aria-live="polite"
          className={`${btnBase} ${
            copied
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span aria-hidden>{copied ? "✓" : "🔗"}</span>
          <span>{copied ? t("copied") : t("copyLink")}</span>
        </button>
      </div>
    </section>
  );
}
