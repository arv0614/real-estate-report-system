"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  report: string;
}

export function AiReport({ report }: Props) {
  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div>
          <h2 className="text-white font-bold text-base leading-tight">
            AI不動産コンサルタントのエリア分析
          </h2>
          <p className="text-purple-200 text-xs mt-0.5">Powered by Google Gemini</p>
        </div>
      </div>

      {/* マークダウン本文 */}
      <div className="px-5 py-5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <h2 className="text-sm font-bold text-purple-800 mt-5 mb-2 first:mt-0 flex items-center gap-2 border-b border-purple-200 pb-1">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold text-slate-700 mt-3 mb-1">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-slate-700 leading-relaxed mb-2">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1 mb-3 ml-1">{children}</ul>
            ),
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
              <blockquote className="border-l-4 border-purple-300 bg-purple-50 pl-3 py-1 rounded-r text-xs text-slate-500 my-2 italic">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="border-purple-200 my-3" />,
          }}
        >
          {report}
        </ReactMarkdown>
      </div>

      {/* フッター注記 */}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-slate-400 border-t border-purple-100 pt-3">
          ※ このレポートはAIが自動生成したものです。補助金・開発計画等の情報は変更される場合があります。
          投資判断の際は必ず最新の公式情報をご確認ください。
        </p>
      </div>
    </div>
  );
}
