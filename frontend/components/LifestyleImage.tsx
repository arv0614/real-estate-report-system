"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { generateLifestyleImage } from "@/lib/api";
import { updateLifestyleImage } from "@/lib/history";

interface Props {
  user: User | null;
  cityCode: string;
  prefecture: string;
  municipality: string;
  /** AIレポートのセクション1サマリーなどを渡すとプロンプトが精度UP */
  areaFeatures?: string;
  /** Firestoreから復元した既存画像（data URL） */
  cachedImage?: string;
  /** 生成・復元後に親へ通知（再生成時の state 更新用） */
  onImageSaved: (dataUrl: string) => void;
}

export function LifestyleImage({
  user,
  cityCode,
  prefecture,
  municipality,
  areaFeatures,
  cachedImage,
  onImageSaved,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ログイン中のみ表示
  if (!user) return null;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateLifestyleImage(prefecture, municipality, areaFeatures);
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      await updateLifestyleImage(user!.uid, cityCode, dataUrl);
      onImageSaved(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center gap-3">
        <span className="text-2xl">🖼️</span>
        <div className="flex-1">
          <h2 className="text-white font-bold text-base leading-tight">
            この街での暮らしをイメージする
          </h2>
          <p className="text-emerald-200 text-xs mt-0.5">
            Powered by Google Imagen · AI生成画像
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* 画像あり（キャッシュ or 生成直後） */}
        {cachedImage ? (
          <div style={{ animation: "fadeInUp 0.6s ease both" }}>
            <img
              src={cachedImage}
              alt={`${municipality}の暮らしイメージ`}
              className="w-full rounded-lg shadow-md"
            />
            <p className="text-xs text-slate-400 mt-2 text-center">
              ※ AIが生成した架空のイメージ画像です。実際の物件・街並みとは異なります。
            </p>
            <div className="mt-3 text-center">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-emerald-600 hover:text-emerald-800 underline underline-offset-2 disabled:opacity-50 transition-colors"
              >
                {generating ? "生成中..." : "🔄 再生成する"}
              </button>
            </div>
          </div>
        ) : generating ? (
          /* スケルトンローディング */
          <div className="space-y-3">
            <div className="w-full h-52 rounded-lg bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-100 animate-pulse" />
            <div className="h-2.5 bg-emerald-100 rounded animate-pulse w-2/3 mx-auto" />
            <p className="text-center text-sm text-slate-500 pt-1">
              AIが<strong>{municipality}</strong>の暮らしイメージを生成中
              <span className="inline-block animate-bounce ml-0.5">...</span>
            </p>
          </div>
        ) : (
          /* 未生成 */
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 mb-1">
              AIが<strong>{municipality}</strong>の街の雰囲気をもとに、
            </p>
            <p className="text-sm text-slate-600 mb-5">
              理想の暮らしイメージ画像を生成します
            </p>
            {error && (
              <p className="text-xs text-red-500 mb-4">⚠️ {error}</p>
            )}
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <span>✨</span>
              暮らしイメージを生成する
            </button>
            <p className="text-xs text-slate-400 mt-3">
              生成した画像は検索履歴に自動保存されます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
