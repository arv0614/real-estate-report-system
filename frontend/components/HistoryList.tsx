"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { subscribeHistory, type SearchHistoryItem } from "@/lib/history";

interface Props {
  uid: string;
  onReplay: (lat: number, lng: number) => void;
}

export function HistoryList({ uid, onReplay }: Props) {
  const t = useTranslations("HistoryList");
  const locale = useLocale();
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeHistory(uid, setItems);
    return unsubscribe;
  }, [uid]);

  function handleItemClick(item: SearchHistoryItem) {
    onReplay(item.lat, item.lng);
    setOpen(false);
  }

  const portal =
    mounted && open
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <div
              ref={panelRef}
              className="fixed bottom-[88px] right-6 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[60vh]"
            >
              {/* ヘッダー（固定） */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-slate-700">{t("title")}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                  aria-label={t("close")}
                >
                  ×
                </button>
              </div>

              {/* リスト（スクロール） */}
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  {t("empty")}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto">
                  {items.map((item) => {
                    const dateLocale = locale === "en" ? "en-US" : "ja-JP";
                    const date = item.searchedAt?.toDate
                      ? item.searchedAt.toDate().toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";
                    const yearsLabel =
                      item.years.length === 1
                        ? t("yearsSingle", { year: item.years[0] })
                        : t("yearsRange", { from: item.years[0], to: item.years[item.years.length - 1] });

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
                            {yearsLabel} · {t("transactions", { count: item.totalCount })}
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
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("title")}
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
