"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { trackEvent } from "@/lib/posthog";

interface Props {
  prefecture: string;
  municipality: string;
  /** 検索に使った緯度 */
  lat: number;
  /** 検索に使った経度 */
  lng: number;
  /** 平均坪単価（円/㎡）。null の場合はスコア表示を省略 */
  avgUnitPrice: number | null;
  /** 平均取引価格（円）*/
  avgTradePrice: number;
  /** 洪水リスクあり */
  hasFloodRisk: boolean;
  /** OGP用: 総合スコア (0-100)。null の場合は OGP スコアカードを省略 */
  ogScore: number | null;
  /** OGP用: 平均取引単価の表示文字列（例: "45万円/㎡"）。null の場合は省略 */
  ogPriceLabel: string | null;
}

type Platform = "x" | "line" | "facebook" | "copy" | "native";

export function ShareActions({ prefecture, municipality, lat, lng, avgUnitPrice, avgTradePrice, hasFloodRisk, ogScore, ogPriceLabel }: Props) {
  const t = useTranslations("ShareActions");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const area = `${prefecture}${municipality}`;

  // Build share text based on locale
  const priceText = ogPriceLabel
    ? t("shareTextUnitPrice", { price: ogPriceLabel })
    : avgUnitPrice
    ? t("shareTextUnitPrice", { price: `${Math.round(avgUnitPrice / 10000).toLocaleString()}${locale === "en" ? "k/㎡" : "万円/㎡"}` })
    : t("shareTextAvgPrice", { price: Math.round(avgTradePrice / 10000).toLocaleString() });
  const hazardText = hasFloodRisk ? t("floodRisk") : t("floodSafe");
  const shareText = t("shareText", { area, price: priceText, hazard: hazardText });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "https://mekiki-research.com");

  function buildShareUrl(platform: Platform): string {
    const params = new URLSearchParams({
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      address: area,
      ref: `share_sns_${platform}`,
      flood: hasFloodRisk ? "1" : "0",
    });
    if (ogScore !== null) params.set("score", String(ogScore));
    if (ogPriceLabel) params.set("price", ogPriceLabel);
    return `${base}/?${params}`;
  }

  const track = useCallback((platform: Platform) => {
    trackEvent("share_button_clicked", {
      platform,
      prefecture,
      municipality,
      has_flood_risk: hasFloodRisk,
    });
  }, [prefecture, municipality, hasFloodRisk]);

  async function handleNativeShare() {
    track("native");
    const shareUrl = buildShareUrl("native");
    try {
      await navigator.share({ title: t("nativeTitle", { area }), text: shareText, url: shareUrl });
    } catch {
      // キャンセルは無視
    }
  }

  function handleXShare() {
    track("x");
    const shareUrl = buildShareUrl("x");
    const params = new URLSearchParams({ text: `${shareText}\n${shareUrl}` });
    window.open(`https://twitter.com/intent/tweet?${params}`, "_blank", "noopener,noreferrer");
  }

  function handleFacebookShare() {
    track("facebook");
    const shareUrl = buildShareUrl("facebook");
    const params = new URLSearchParams({ u: shareUrl });
    window.open(`https://www.facebook.com/sharer/sharer.php?${params}`, "_blank", "noopener,noreferrer");
  }

  function handleLineShare() {
    track("line");
    const shareUrl = buildShareUrl("line");
    const params = new URLSearchParams({ url: shareUrl, text: shareText });
    window.open(`https://social-plugins.line.me/lineit/share?${params}`, "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    track("copy");
    const shareUrl = buildShareUrl("copy");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="pdf-hide bg-white rounded-xl border border-slate-200 px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* 左: ラベル */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700">{t("shareTitle")}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{shareText.slice(0, 60)}…</p>
        </div>

        {/* 右: ボタン群 */}
        <div className="flex items-center gap-2 flex-wrap">
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
              aria-label={t("share")}
            >
              <ShareIcon />
              {t("share")}
            </button>
          )}

          <button
            onClick={handleXShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            aria-label={t("post")}
          >
            <XIcon />
            {t("post")}
          </button>

          <button
            onClick={handleFacebookShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1877F2] text-white text-xs font-semibold hover:bg-[#1460cc] transition-colors"
            aria-label="Facebook"
          >
            <FacebookIcon />
            FB
          </button>

          <button
            onClick={handleLineShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#06C755] text-white text-xs font-semibold hover:bg-[#05b34c] transition-colors"
            aria-label="LINE"
          >
            <LineIcon />
            LINE
          </button>

          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              copied
                ? "bg-green-500 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={t("urlCopy")}
          >
            {copied ? (
              <>
                <CheckIcon />
                {t("copied")}
              </>
            ) : (
              <>
                <CopyIcon />
                {t("urlCopy")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── アイコン ──────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.627.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
