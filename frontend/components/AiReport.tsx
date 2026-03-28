"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

/** マークダウンを ## N. タイトル で分割してセクション配列に変換 */
function parseSections(report: string): Section[] {
  const sections: Section[] = [];
  const lines = report.split("\n");
  let current: Section | null = null;

  for (const line of lines) {
    const match = line.match(/^#{2,3} (\d+)\.\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { number: match[1], title: match[2].trim(), content: "" };
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
}

export function AiReport({ report }: Props) {
  const sections = parseSections(report);

  // 最初からopen状態のセクション番号Set（デフォルト: セクション1のみ展開）
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(["1"]));

  function toggle(num: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  // パース失敗フォールバック: セクション分割できなかった場合はそのまま表示
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-5">
        <SectionBody content={report} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div className="flex-1">
          <h2 className="text-white font-bold text-base leading-tight">
            AI不動産コンサルタントのエリア分析
          </h2>
          <p className="text-purple-200 text-xs mt-0.5">Powered by Google Gemini · {sections.length}項目</p>
        </div>
        {/* 全展開 / 全折りたたみ */}
        <button
          onClick={() =>
            setOpenSet(
              openSet.size === sections.length
                ? new Set(["1"])
                : new Set(sections.map((s) => s.number))
            )
          }
          className="text-xs text-purple-200 hover:text-white border border-purple-400 hover:border-white rounded px-2 py-1 transition-colors shrink-0"
        >
          {openSet.size === sections.length ? "すべて折りたたむ" : "すべて展開"}
        </button>
      </div>

      {/* アコーディオン */}
      <div className="divide-y divide-purple-100">
        {sections.map((section) => {
          const isOpen = openSet.has(section.number);
          const icon = SECTION_ICONS[section.number] ?? "📋";
          const isFirst = section.number === "1";

          return (
            <div key={section.number} className="bg-white/60">
              {/* セクションヘッダー（クリックで開閉） */}
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
                {/* 展開インジケーター */}
                <span
                  className={`text-purple-400 text-xs shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* セクション本文（アコーディオン） */}
              {isOpen && (
                <div className="px-5 pb-4 pt-1">
                  {/* セクション1は内容をそのまま表示 */}
                  {isFirst && section.content.trim() === "" ? null : (
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
  );
}
