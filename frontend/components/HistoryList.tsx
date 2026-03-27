"use client";

import { useEffect, useState } from "react";
import { subscribeHistory, type SearchHistoryItem } from "@/lib/history";

interface Props {
  uid: string;
  onReplay: (lat: number, lng: number) => void;
}

export function HistoryList({ uid, onReplay }: Props) {
  const [items, setItems] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeHistory(uid, setItems);
    return unsubscribe;
  }, [uid]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
        検索履歴はまだありません
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">検索履歴</h2>
      </div>
      <ul className="divide-y divide-slate-100 max-h-[calc(100vh-200px)] overflow-y-auto">
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
                onClick={() => onReplay(item.lat, item.lng)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="font-medium text-sm text-slate-800 truncate">
                  {item.prefecture} {item.municipality}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{yearsLabel} · {item.totalCount}件</div>
                <div className="text-xs text-slate-400 mt-0.5">{date}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
