"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeHistory, type SearchHistoryItem } from "@/lib/history";

interface Props {
  uid: string;
  onReplay: (lat: number, lng: number, lifestyleImage?: string) => void;
}

export function HistoryList({ uid, onReplay }: Props) {
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portal は SSR では使えないのでクライアントマウント後にのみ有効にする
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeHistory(uid, setItems);
    return unsubscribe;
  }, [uid]);

  function handleItemClick(item: SearchHistoryItem) {
    onReplay(item.lat, item.lng, item.lifestyleImage);
    setOpen(false);
  }

  // オーバーレイ + パネルを document.body 直下にPortalで描画
  // → Leaflet の stacking context から完全に独立し、確実に最前面へ
  const portal =
    mounted && open
      ? createPortal(
          <>
            {/* パネル外クリック用オーバーレイ */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* ポップアップパネル
                FAB上端: bottom-6(24px) + h-14(56px) = 80px
                パネル: bottom-[88px] で8pxギャップを確保し上方向に展開 */}
            <div
              ref={panelRef}
              className="fixed bottom-[88px] right-6 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[60vh]"
            >
              {/* ヘッダー（固定） */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-slate-700">検索履歴</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              {/* リスト（スクロール） */}
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  検索履歴はまだありません
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto">
                  {items.map((item) => {
                    const date = item.searchedAt?.toDate
                      ? item.searchedAt.toDate().toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";
                    const yearsLabel =
                      item.years.length === 1
                        ? `${item.years[0]}年`
                        : `${item.years[0]}〜${item.years[item.years.length - 1]}年`;

                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium text-sm text-slate-800 truncate">
                            {item.prefecture} {item.municipality}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {yearsLabel} · {item.totalCount}件
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{date}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {/* フローティングアクションボタン（Portal不要、通常のfixedで十分） */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="検索履歴"
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {portal}
    </>
  );
}
