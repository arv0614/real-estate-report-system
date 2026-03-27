"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeHistory, type SearchHistoryItem } from "@/lib/history";

interface Props {
  uid: string;
  onReplay: (lat: number, lng: number) => void;
}

export function HistoryList({ uid, onReplay }: Props) {
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeHistory(uid, setItems);
    return unsubscribe;
  }, [uid]);

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleItemClick(item: SearchHistoryItem) {
    onReplay(item.lat, item.lng);
    setOpen(false);
  }

  return (
    <>
      {/* フローティングアクションボタン */}
      <button
        ref={fabRef}
        onClick={() => setOpen((v) => !v)}
        title="検索履歴"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
      >
        {/* 時計アイコン */}
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

      {/* ポップアップパネル */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">検索履歴</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              検索履歴はまだありません
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
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
      )}
    </>
  );
}
