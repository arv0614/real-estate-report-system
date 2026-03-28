"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateLifestyleImage } from "@/lib/api";
import { updateLifestyleImage } from "@/lib/history";
import type { UserPlan } from "@/lib/userPlan";

/** 無料プランで閲覧できるセクション番号の上限（これ以下は表示） */
const FREE_VISIBLE_SECTIONS = 3;

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
  /** ユーザープラン。null=未ログイン, "free"=無料, "pro"=有料 */
  plan?: UserPlan | null;
  cityCode?: string;
  prefecture?: string;
  municipality?: string;
  lifestyleImage?: string;
  onImageSaved?: (dataUrl: string) => void;
  /** 未ログイン時にログインUIを開くコールバック */
  onLoginRequest?: () => void;
}

export function AiReport({
  report,
  user,
  plan,
  cityCode,
  prefecture,
  municipality,
  lifestyleImage,
  onImageSaved,
  onLoginRequest,
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

  // ── 未ログイン: コンポーネント全体をロックUIに差し替え ──────────
  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* ヘッダー */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h2 className="text-white font-bold text-base leading-tight">AI不動産コンサルタントのエリア分析</h2>
            <p className="text-purple-200 text-xs mt-0.5">Powered by Google Gemini · 10項目</p>
          </div>
        </div>
        {/* ロック本体 */}
        <div className="px-6 py-10 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">
            AI住環境分析・プロの所見を読む
          </h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            10項目のエリア分析レポート（リアルな住環境・注意点・プロのクロージングアドバイスを含む）は、
            無料アカウントでログインすると閲覧できます。
          </p>
          <button
            onClick={onLoginRequest}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google で無料ログイン
          </button>
          <p className="text-xs text-slate-400 mt-3">登録・利用は無料です</p>
        </div>
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
            const sectionNum = Number(section.number);
            const isLocked = plan === "free" && sectionNum > FREE_VISIBLE_SECTIONS;
            const isOpen = openSet.has(section.number);
            const icon = SECTION_ICONS[section.number] ?? "📋";

            return (
              <div key={section.number} className="bg-white/60">
                <button
                  type="button"
                  onClick={() => !isLocked && toggle(section.number)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                    isLocked
                      ? "cursor-default opacity-60"
                      : "hover:bg-purple-50/60"
                  }`}
                  aria-expanded={isLocked ? false : isOpen}
                >
                  <span className="text-lg shrink-0">{isLocked ? "🔒" : icon}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-700">
                    <span className="text-purple-500 mr-1">{section.number}.</span>
                    {section.title}
                  </span>
                  {!isLocked && (
                    <span
                      className={`text-purple-400 text-xs shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  )}
                </button>

                {/* ロックされたセクションのぼかしプレビュー */}
                {isLocked && (
                  <div className="px-5 pb-3 pt-1 relative select-none pointer-events-none">
                    <div className="blur-sm opacity-40 text-sm text-slate-700 line-clamp-3">
                      {section.content.trim().slice(0, 120)}…
                    </div>
                  </div>
                )}

                {/* 通常の展開コンテンツ */}
                {!isLocked && isOpen && (
                  <div className="px-5 pb-4 pt-1">
                    {section.content.trim() === "" ? null : (
                      <SectionBody content={section.content} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── 無料プラン: セクション4以降のアップグレードCTA ── */}
          {plan === "free" && (
            <div className="border-t border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-5 text-center">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                🔒 この続きの独自分析・補助金情報・営業トークはプロプラン限定です
              </p>
              <p className="text-xs text-amber-700 mb-4">
                都市開発動向・投資価値・将来予測・総合スコア・リアルな住環境・プロのクロージングアドバイス（セクション4〜10）を解放
              </p>
              <button
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors shadow-sm text-sm"
                onClick={() => alert("プロプランへのアップグレードページは近日公開予定です。")}
              >
                ✨ プロプランにアップグレード
              </button>
            </div>
          )}
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
