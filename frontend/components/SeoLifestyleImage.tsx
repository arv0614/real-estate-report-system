"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 12000;

/**
 * SEOレポートページ用ライフスタイル画像コンポーネント。
 *
 * - ロード中: スケルトンアニメーション
 * - 読み込み成功: フェードイン表示
 * - エラー (初回生成中など): 自動リトライ（リロード不要）
 *
 * src にはバックエンドの /api/property/seo-image エンドポイント URL を渡す。
 * 初回アクセス時は Gemini が画像生成するため数十秒かかる場合があるが、
 * コンポーネント側でリトライするためユーザーにリロードを求めない。
 */
export function SeoLifestyleImage({ src, alt, className = "" }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [imgSrc, setImgSrc] = useState(src);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // src prop が変わったらリセット
  useEffect(() => {
    setState("loading");
    setRetryCount(0);
    setImgSrc(src);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [src]);

  function handleError() {
    if (retryCount < MAX_RETRIES) {
      // 画像生成中はしばらく待ってから自動再試行
      retryTimerRef.current = setTimeout(() => {
        const next = retryCount + 1;
        setRetryCount(next);
        setState("loading");
        setImgSrc(`${src}${src.includes("?") ? "&" : "?"}_r=${next}`);
      }, RETRY_DELAY_MS);
    } else {
      setState("error");
    }
  }

  const isRetrying = state === "loading" && retryCount > 0;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* スケルトン（ロード中のみ表示） */}
      {state === "loading" && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex flex-col items-center justify-center gap-2" aria-hidden>
          {isRetrying && (
            <p className="text-xs text-slate-400 text-center px-4">
              暮らしイメージを生成中です…
            </p>
          )}
        </div>
      )}

      {/* 画像本体 */}
      <img
        key={imgSrc}
        src={imgSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          state === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
        onLoad={() => setState("loaded")}
        onError={handleError}
      />

      {/* リトライ上限後（再試行しても取得できなかった場合のみ） */}
      {state === "error" && (
        <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">🏙️</span>
          <p className="text-xs text-slate-400 text-center px-4">
            暮らしイメージを準備中です
          </p>
        </div>
      )}
    </div>
  );
}
