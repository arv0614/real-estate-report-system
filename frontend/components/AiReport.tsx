"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { gtagEvent } from "@/lib/gtag";
import type { User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateLifestyleImage } from "@/lib/api";
import { saveLifestyleCache } from "@/lib/lifestyleCache";
import type { UserPlan } from "@/lib/userPlan";

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
  "10": "🌱",
  "11": "🤝",
};

/** タイトル文字列から特定セクション（環境・省エネ）を判定してアイコンを切り替える */
function pickIcon(number: string, title: string): string {
  if (/環境[・･]?省エネ|energy efficiency|省エネ適性/i.test(title)) return "🌱";
  if (/不動産プロ|professional['’]?s perspective|professional perspective/i.test(title)) return "🤝";
  return SECTION_ICONS[number] ?? "📋";
}

const IMAGE_KEY = "image";

/**
 * Gemini が出力する `**bold**` や、対応閉じが欠けた裸の `**` が画面にそのまま
 * 表示されてしまうのを防ぐため、レポート全体から強調記号を除去する。
 * `__bold__` も同様に扱う。
 */
function stripBoldMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/__/g, "");
}

/** マークダウン装飾（bold/italic）を除去して見出し用のプレーンテキストに変換 */
function stripInlineMarkdown(text: string): string {
  return stripBoldMarkdown(text)
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

/**
 * マークダウンを `## N. タイトル` または `## タイトル` で分割してセクション配列に変換。
 *
 * - モデルが先頭にレポート全体のタイトル（番号なし `## ...`）を付けた場合や、
 *   `## 環境・省エネ適性` のように番号付け忘れが発生した場合でも壊れないよう、
 *   番号付き見出しを優先して採用する。
 * - 番号付き見出しが1つでも存在すれば、番号無しは「直前のセクションの本文」として連結する。
 *   ただし、番号付き見出しがまだ登場していない位置の番号無し見出し（＝レポート冒頭タイトル）は無視する。
 * - 番号付き見出しが1つも無い場合は、登場順 1..N で全見出しを採番してフォールバック。
 */
function parseSections(report: string): Section[] {
  const lines = report.split("\n");
  const headingRe = /^#{2,3}\s+(?:(\d+)[\.\):]\s+)?(.+?)\s*$/;

  type ParsedHeading = { number: string | null; title: string };
  const parsedLines: Array<{ kind: "heading"; h: ParsedHeading } | { kind: "text"; text: string }> = [];
  let hasNumbered = false;

  for (const line of lines) {
    const m = line.match(headingRe);
    if (m) {
      const num = m[1] ?? null;
      if (num) hasNumbered = true;
      parsedLines.push({
        kind: "heading",
        h: { number: num, title: stripInlineMarkdown(m[2].trim()) },
      });
    } else {
      parsedLines.push({ kind: "text", text: line });
    }
  }

  const sections: Section[] = [];
  let current: Section | null = null;
  let autoIndex = 0;
  let seenNumberedYet = false;

  for (const item of parsedLines) {
    if (item.kind === "heading") {
      const num = item.h.number;
      if (hasNumbered && !num && !seenNumberedYet) {
        // 番号付きセクションがまだ登場していない位置の番号無し見出し ＝ レポート冒頭タイトル → 無視
        continue;
      }
      if (current) sections.push(current);
      autoIndex += 1;
      const assigned = num ?? String(autoIndex);
      if (num) seenNumberedYet = true;
      current = {
        number: assigned,
        title: item.h.title,
        content: "",
      };
    } else if (current) {
      current.content += item.text + "\n";
    }
  }
  if (current) sections.push(current);

  // 念のため重複番号を一意化
  const seen = new Set<string>();
  return sections.map((s, idx) => {
    if (seen.has(s.number)) {
      s.number = String(idx + 1);
    }
    seen.add(s.number);
    return s;
  });
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
  user?: User | null;
  plan?: UserPlan | null;
  cityCode?: string;
  prefecture?: string;
  municipality?: string;
  lifestyleImage?: string;
  imageGenerating?: boolean;
  defaultLifestyleImage?: string;
  onImageSaved?: (dataUrl: string) => void;
  onLoginRequest?: () => void;
  onPlanModalOpen?: () => void;
}

export function AiReport({
  report,
  user,
  plan,
  cityCode,
  prefecture,
  municipality,
  lifestyleImage,
  imageGenerating = false,
  defaultLifestyleImage,
  onImageSaved,
  onLoginRequest,
  onPlanModalOpen: _onPlanModalOpen,
}: Props) {
  const t = useTranslations("AiReport");
  // Gemini 出力の bold 記号 `**` / `__` をパース前に全て除去。閉じタグが欠けた
  // 裸の `**` が画面にそのまま出る問題を防ぐ。
  const sanitizedReport = stripBoldMarkdown(report);
  const sections = parseSections(sanitizedReport);
  const allKeys = [IMAGE_KEY, ...sections.map((s) => s.number)];

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
    gtagEvent({ action: "generate_lifestyle_image", category: "engagement" });
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateLifestyleImage(prefecture, municipality, areaFeatures);
      const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
      setIsMockImage(result.isMock);
      onImageSaved?.(dataUrl);
      saveLifestyleCache(cityCode, dataUrl, prefecture, municipality).catch((e) =>
        console.error("[AiReport] cache save error:", e)
      );
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("genError"));
    } finally {
      setGenerating(false);
    }
  }

  // パース失敗フォールバック
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-5">
        <SectionBody content={sanitizedReport} />
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
            <h2 className="text-white font-bold text-base leading-tight">{t("title")}</h2>
            <p className="text-purple-200 text-xs mt-0.5">{t("subtitle", { count: 10 })}</p>
          </div>
        </div>
        {/* 汎用暮らしイメージ（提供時のみ表示） */}
        {defaultLifestyleImage && (
          <div className="relative">
            <img
              src={defaultLifestyleImage}
              alt={t("lifestyleAlt", { municipality: municipality ?? "" })}
              crossOrigin="anonymous"
              className="w-full h-40 object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80" />
          </div>
        )}
        {/* ロック本体 */}
        <div className="px-6 py-10 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">
            {t("lockedTitle")}
          </h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            {t("lockedDesc")}
          </p>
          <button
            onClick={onLoginRequest}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {t("loginBtn")}
          </button>
          <p className="text-xs text-slate-400 mt-3">{t("loginFree")}</p>
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
            alt={t("lifestyleAltExpanded")}
            crossOrigin="anonymous"
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
              {t("title")}
            </h2>
            <p className="text-purple-200 text-xs mt-0.5">
              {t("subtitle", { count: sections.length })}
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
            {openSet.size === allKeys.length ? t("collapseAll") : t("expandAll")}
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
                {t("lifestyleTitle")}
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
                {lifestyleImage ? (
                  <div data-pdf-lifestyle-image style={{ animation: "fadeInUp 0.5s ease both" }}>
                    {isMockImage && (
                      <div className="mb-2 flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-1.5">
                        <span className="text-red-500 text-xs font-medium">{t("mockImageWarning")}</span>
                      </div>
                    )}
                    <div
                      className="relative group inline-block cursor-pointer w-full max-w-md"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <img
                        src={lifestyleImage}
                        alt={t("lifestyleAlt", { municipality: municipality ?? "" })}
                        crossOrigin="anonymous"
                        className="w-full h-48 object-cover rounded-lg shadow-sm group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                          {t("zoomIn")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-[10px] text-slate-400 flex-1">
                        {t("imageNote")}
                      </p>
                      {plan === "pro" && (
                        <button
                          onClick={handleGenerate}
                          disabled={generating}
                          className="text-xs text-purple-500 hover:text-purple-700 disabled:opacity-40 transition-colors"
                        >
                          {generating ? t("generating") : t("regenerate")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (generating || imageGenerating) ? (
                  <div className="space-y-2" data-pdf-lifestyle-image>
                    <div className="w-full max-w-md h-32 rounded-lg bg-purple-100/80 animate-pulse" />
                    <p className="text-xs text-slate-400">
                      {t("generatingArea", { area: municipality ?? t("defaultArea") })}
                    </p>
                  </div>
                ) : plan === "pro" ? (
                  <div className="flex items-center gap-3 py-1">
                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1.5 border border-purple-300 text-purple-700 bg-white hover:bg-purple-50 rounded-lg px-4 py-1.5 text-sm transition-colors shadow-sm"
                    >
                      {t("generateBtn")}
                    </button>
                    {genError && <p className="text-xs text-red-500">⚠️ {genError}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">
                    {t("imageNotReady")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 通常セクション ── */}
          {sections.map((section) => {
            const isLocked = false;
            const isOpen = openSet.has(section.number);
            const icon = pickIcon(section.number, section.title);

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

                {isLocked && (
                  <div className="px-5 pb-3 pt-1 relative select-none pointer-events-none">
                    <div className="blur-sm opacity-40 text-sm text-slate-700 line-clamp-3">
                      {section.content.trim().slice(0, 120)}…
                    </div>
                  </div>
                )}

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

          {/* プラン告知（PDF非表示） */}
          <div className="pdf-hide border-t border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 text-center">
            <p className="text-xs text-blue-700">
              📢 <span className="font-semibold">{t("betaBannerBold")}</span> {t("betaBannerSuffix")}
            </p>
          </div>
        </div>

        {/* フッター注記 */}
        <div className="px-5 py-3 bg-purple-50/80 border-t border-purple-100">
          <p className="text-[10px] text-slate-400">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </>
  );
}
