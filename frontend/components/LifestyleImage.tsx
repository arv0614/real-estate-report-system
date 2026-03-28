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
  /** AIレポートのサマリーなどを渡すとプロンプトが精度UP */
  areaFeatures?: string;
  /** Firestoreから復元した既存画像（data URL） */
  cachedImage?: string;
  /** 生成後に親へ通知 */
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

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateLifestyleImage(prefecture, municipality, areaFeatures);
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;

      // Base64をそのまま親stateに渡して即時表示（CORSエラーが出ない）
      onImageSaved(dataUrl);

      // Storage保存はバックグラウンドで実行（失敗しても表示には影響しない）
      updateLifestyleImage(user.uid, cityCode, dataUrl).catch((err) => {
        console.error("[LifestyleImage] Storage保存エラー:", err);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-3">
        <span className="text-2xl">🖼️</span>
        <div className="flex-1">
          <h2 className="text-white font-bold text-base leading-tight">
            この街での暮らしをイメージする
          </h2>
          <p className="text-blue-200 text-xs mt-0.5">
            Powered by Google Gemini · AI生成画像
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* 未ログイン時: ログイン誘導プレースホルダー */}
        {!user ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 py-8 text-center">
            <p className="text-3xl mb-3">🔒</p>
            <p className="text-sm font-medium text-slate-600">
              画像生成機能を使うにはログインしてください
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Googleアカウントでログインすると、AIが{municipality}の暮らしイメージを生成します
            </p>
          </div>
        ) : cachedImage ? (
          /* 画像あり（キャッシュ or 生成直後） */
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
                className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 disabled:opacity-50 transition-colors"
              >
                {generating ? "生成中..." : "🔄 再生成する"}
              </button>
            </div>
          </div>
        ) : generating ? (
          /* スケルトンローディング */
          <div className="space-y-3">
            <div className="w-full h-52 rounded-lg bg-gradient-to-r from-blue-100 via-indigo-100 to-blue-100 animate-pulse" />
            <div className="h-2.5 bg-blue-100 rounded animate-pulse w-2/3 mx-auto" />
            <p className="text-center text-sm text-slate-500 pt-1">
              AIが<strong>{municipality}</strong>の暮らしイメージを生成中
              <span className="inline-block animate-bounce ml-0.5">...</span>
            </p>
          </div>
        ) : (
          /* 未生成 — 大きくて目立つボタン */
          <div className="py-4">
            <p className="text-sm text-slate-600 text-center mb-5">
              AIが<strong>{municipality}</strong>の街の雰囲気をもとに、理想の暮らしイメージ画像を生成します
            </p>
            {error && (
              <p className="text-xs text-red-500 text-center mb-4">⚠️ {error}</p>
            )}
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="text-2xl">✨</span>
              暮らしイメージを生成する
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              生成した画像は検索履歴に自動保存されます（約10〜15秒）
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
