"use client";

import { useState } from "react";

interface Props {
  grade: string;
  score: number;
  address: string;
  isEn: boolean;
  autoFilled?: boolean;
  propertyType?: "house" | "mansion";
}

const SITE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
  "https://mekiki-research.com";

export function ShareResearch({ grade, score, address, isEn, autoFilled, propertyType }: Props) {
  const [copied, setCopied] = useState(false);

  // Derive a short area label (city + ward level) from the address
  const areaLabel = address.replace(/[0-9０-９\-ー―－]+/g, "").trim().slice(0, 20) || address.slice(0, 20);

  const typeSuffix = propertyType === "house"
    ? (isEn ? " [House]" : "（戸建）")
    : (isEn ? " [Apartment]" : "（マンション）");

  const shareText = isEn
    ? `Property analysis complete! Grade: ${grade} (${score}pts) — ${areaLabel}${typeSuffix}`
    : `物件リサーチ結果: ${areaLabel}${typeSuffix} → 評価 ${grade}（${score}点）`;

  const autoFilledParam = autoFilled ? "&autoFilled=true" : "";
  const typeParam = propertyType ? `&type=${propertyType}` : "";
  const shareUrl = `${SITE_URL}${isEn ? "/en" : ""}/research?grade=${encodeURIComponent(grade)}&score=${score}&area=${encodeURIComponent(areaLabel)}&mode=home${autoFilledParam}${typeParam}`;

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const t = {
    label:  isEn ? "Share result" : "結果をシェア",
    copy:   isEn ? "Copy" : "コピー",
    copied: isEn ? "Copied!" : "コピーしました",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 mb-3">{t.label}</p>
      <div className="flex gap-2 flex-wrap">
        {/* X (Twitter) */}
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </a>

        {/* LINE */}
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#06C755] text-white text-sm font-semibold hover:bg-[#05b04c] transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          LINE
        </a>

        {/* Copy */}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </div>
  );
}
