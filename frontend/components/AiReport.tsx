"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateLifestyleImage } from "@/lib/api";
import { updateLifestyleImage } from "@/lib/history";

interface Section {
  number: string;
  title: string;
  content: string;
}

const SECTION_ICONS: Record<string, string> = {
  "1": "🏙️",
  "2": "👨‍👩‍👧‍👦",
  "3": "📜",
  "4": "🏗️",
  "5": "💰",
  "6": "📰",
  "7": "🔮",
  "8": "📊",
  "9": "🏠",
  "10": "🤝",
};

const IMAGE_KEY = "image";

/** マークダウン装飾（**bold**, __bold__）を除去してプレーンテキストに変換 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

/** マークダウンを ## N. タイトル で分割してセクション配列に変換 */
function parseSections(report: string): Section[] {
  const sections: Section[] = [];
  const lines = report.split("\n");
  let current: Section | null = null;

  for (const line of lines) {
    const match = line.match(/^#{2,3} (\d+)\.\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      // タイトルはプレーンテキストとして表示するためインラインマークダウンを除去
      current = { number: match[1], title: stripInlineMarkdown(match[2].trim()), content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** セクションの本文を ReactMarkdown でレンダリング */
function SectionBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-slate-700 mt-3 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-slate-700 leading-relaxed mb-2">{children}</p>
        ),
        ul: ({ children }) => <ul className="space-y-1 mb-3 ml-1">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-1 mb-3 ml-4 list-decimal">{children}</ol>,
        li: ({ children }) => (
          <li className="text-sm text-slate-700 flex gap-2 leading-relaxed">
            <span className="text-purple-400 shrink-0 mt-0.5">•</span>
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-800">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-purple-300 bg-purple-50 pl-3 py-1.5 rounded-r text-xs text-slate-500 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-purple-100 my-2" />,
      }}
    >
      {content.trim()}
    </ReactMarkdown>
  );
}

interface Props {
  report: string;
  /** 画像生成機能用（任意） */
  user?: User | null;
  cityCode?: string;
  prefecture?: string;
  municipality?: string;
  lifestyleImage?: string;
  onImageSaved?: (dataUrl: string) => void;
}

export function AiReport({
  report,
  user,
  cityCode,
  prefecture,
  municipality,
  lifestyleImage,
  onImageSaved,
}: Props) {
  const sections = parseSections(report);
  const allKeys = [IMAGE_KEY, ...sections.map((s) => s.number)];

  // セクション1「エリア総評」のテキストを画像生成プロンプトに流し込む
  const areaFeatures = sections.find((s) => s.number === "1")?.content.trim() || undefined;

  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set([IMAGE_KEY, "1"]));
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isMockImage, setIsMockImage] = useState(false);

  function toggle(key: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    if (!user || !cityCode || !prefecture || !municipality) return;
    setGenerating(true);
    setGenError(null);

    // Step1: 画像生成（失敗したらエラー表示して終了）
    let result;
    try {
      result = await generateLifestyleImage(prefecture, municipality, areaFeatures);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "生成に失敗しました");
      setGenerating(false);
      return;
    }

    // Step2: 生成成功 → Base64 data URL で即時表示（CORSエラーなし）
    const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
    setIsMockImage(result.isMock);
    onImageSaved?.(dataUrl);
    setGenerating(false);

    // Step3: Storage保存はバックグラウンド（失敗しても throw せずコンソール出力のみ）
    updateLifestyleImage(user.uid, cityCode, dataUrl).catch((e) =>
      console.error("[AiReport] Storage保存エラー:", e)
    );
  }

  // パース失敗フォールバック
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-5">
        <SectionBody content={report} />
      </div>
    );
  }

  const imageIsOpen = openSet.has(IMAGE_KEY);

  return (
    <>
      {/* ライトボックス */}
      {lightboxOpen && lifestyleImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={lifestyleImage}
            alt="暮らしイメージ 拡大"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base leading-tight">
              AI不動産コンサルタントのエリア分析
            </h2>
            <p className="text-purple-200 text-xs mt-0.5">
              Powered by Google Gemini · {sections.length}項目
            </p>
          </div>
          <button
            onClick={() =>
              setOpenSet(
                openSet.size === allKeys.length
                  ? new Set([IMAGE_KEY, "1"])
                  : new Set(allKeys)
              )
            }
            className="text-xs text-purple-200 hover:text-white border border-purple-400 hover:border-white rounded px-2 py-1 transition-colors shrink-0"
          >
            {openSet.size === allKeys.length ? "すべて折りたたむ" : "すべて展開"}
          </button>
        </div>

        <div className="divide-y divide-purple-100">
          {/* ── 暮らしのイメージ セクション（固定・最上部） ── */}
          <div className="bg-white/60">
            <button
              type="button"
              onClick={() => toggle(IMAGE_KEY)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-purple-50/60 transition-colors"
              aria-expanded={imageIsOpen}
            >
              <span className="text-lg shrink-0">🖼️</span>
              <span className="flex-1 text-sm font-semibold text-slate-700">
                <span className="text-purple-500 mr-1">✦</span>
                暮らしのイメージ
              </span>
              <span
                className={`text-purple-400 text-xs shrink-0 transition-transform duration-200 ${
                  imageIsOpen ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {imageIsOpen && (
              <div className="px-5 pb-4 pt-2">
                {!user ? (
                  /* 未ログイン */
                  <p className="text-xs text-slate-400 py-2">
                    🔒 ログインするとAIが{municipality ?? "このエリア"}の暮らしイメージを生成できます
                  </p>
                ) : lifestyleImage ? (
                  /* 画像あり */
                  <div style={{ animation: "fadeInUp 0.5s ease both" }}>
                    {/* モック画像警告 */}
                    {isMockImage && (
                      <div className="mb-2 flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-1.5">
                        <span className="text-red-500 text-xs font-medium">⚠️ APIエラーのためダミー画像を表示しています（実際のエリアとは異なります）</span>
                      </div>
                    )}
                    <div
                      className="relative group inline-block cursor-pointer w-full max-w-md"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <img
                        src={lifestyleImage}
                        alt={`${municipality ?? ""}の暮らしイメージ`}
                        className="w-full h-48 object-cover rounded-lg shadow-sm group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                          🔍 クリックで拡大
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-[10px] text-slate-400 flex-1">
                        ※ AIが生成した架空のイメージです
                      </p>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-xs text-purple-500 hover:text-purple-700 disabled:opacity-40 transition-colors"
                      >
                        {generating ? "生成中…" : "🔄 再生成"}
                      </button>
                    </div>
                  </div>
                ) : generating ? (
                  /* スケルトン */
                  <div className="space-y-2">
                    <div className="w-full max-w-md h-32 rounded-lg bg-purple-100/80 animate-pulse" />
                    <p className="text-xs text-slate-400">
                      {municipality ?? "エリア"}の暮らしイメージを生成中…
                    </p>
                  </div>
                ) : (
                  /* 未生成 */
                  <div className="flex items-center gap-3 py-1">
                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1.5 border border-purple-300 text-purple-700 bg-white hover:bg-purple-50 rounded-lg px-4 py-1.5 text-sm transition-colors shadow-sm"
                    >
                      ✨ 暮らしイメージを生成
                    </button>
                    {genError && (
                      <p className="text-xs text-red-500">⚠️ {genError}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      約10〜15秒、履歴に自動保存
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 通常セクション ── */}
          {sections.map((section) => {
            const isOpen = openSet.has(section.number);
            const icon = SECTION_ICONS[section.number] ?? "📋";

            return (
              <div key={section.number} className="bg-white/60">
                <button
                  type="button"
                  onClick={() => toggle(section.number)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-purple-50/60 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg shrink-0">{icon}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-700">
                    <span className="text-purple-500 mr-1">{section.number}.</span>
                    {section.title}
                  </span>
                  <span
                    className={`text-purple-400 text-xs shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1">
                    {section.content.trim() === "" ? null : (
                      <SectionBody content={section.content} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッター注記 */}
        <div className="px-5 py-3 bg-purple-50/80 border-t border-purple-100">
          <p className="text-[10px] text-slate-400">
            ※ このレポートはAIが自動生成したものです。補助金・開発計画・人口予測等は変更される場合があります。
            投資判断の際は必ず最新の公式情報をご確認ください。
          </p>
        </div>
      </div>
    </>
  );
}
