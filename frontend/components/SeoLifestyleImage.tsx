"use client";

import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/**
 * SEOレポートページ用ライフスタイル画像コンポーネント。
 *
 * - ロード中: スケルトンアニメーション
 * - 読み込み成功: フェードイン表示
 * - エラー (初回生成中など): 「準備中」プレースホルダー表示
 *
 * src にはバックエンドの /api/property/seo-image エンドポイント URL を渡す。
 * 初回アクセス時は Gemini が画像生成するため表示まで数十秒かかる場合がある。
 */
export function SeoLifestyleImage({ src, alt, className = "" }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* スケルトン（ロード中のみ表示） */}
      {state === "loading" && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse" aria-hidden />
      )}

      {/* 画像本体 */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          state === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />

      {/* エラー時（初回生成中 or 失敗） */}
      {state === "error" && (
        <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">🏙️</span>
          <p className="text-xs text-slate-400 text-center px-4">
            暮らしイメージを準備中です
            <br />
            しばらく経ってからリロードしてください
          </p>
        </div>
      )}
    </div>
  );
}
