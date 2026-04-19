"use client";

import { useState, useTransition } from "react";
import { Check, X, AlertCircle, Link2 } from "lucide-react";
import { parsePropertyUrl } from "@/app/[locale]/research/urlActions";
import type { ParsedPropertyData } from "@/app/[locale]/research/urlActions";
import { SUPPORTED_SITE_NAMES } from "@/lib/parsers/supportedSites";

interface Props {
  onParsed: (data: ParsedPropertyData) => void;
  isEn: boolean;
}

interface PreviewItem {
  field: keyof ParsedPropertyData;
  label: string;
  value: string | undefined;
}

function buildPreview(data: ParsedPropertyData, isEn: boolean): PreviewItem[] {
  return [
    { field: "price",     label: isEn ? "Price"      : "価格",   value: data.price     ? `${data.price.toLocaleString()}万円` : undefined },
    { field: "address",   label: isEn ? "Address"    : "住所",   value: data.address },
    { field: "area",      label: isEn ? "Floor area" : "専有面積", value: data.area     ? `${data.area}㎡` : undefined },
    { field: "builtYear", label: isEn ? "Year built" : "建築年",  value: data.builtYear ? `${data.builtYear}年` : undefined },
  ];
}

export function UrlInput({ onParsed, isEn }: Props) {
  const [url,       setUrl]       = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [preview,   setPreview]   = useState<{ data: ParsedPropertyData; siteLabel: string; items: PreviewItem[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = {
    title:       isEn ? "Auto-fill from property URL" : "物件URLから自動入力",
    placeholder: isEn ? "Paste a property listing URL" : "物件掲載ページのURLを貼り付け",
    fetch:       isEn ? "Fetch" : "取得",
    fetching:    isEn ? "Fetching…" : "取得中…",
    hint:        isEn
      ? `Paste a listing URL from ${SUPPORTED_SITE_NAMES} to auto-fill the form.`
      : `${SUPPORTED_SITE_NAMES} などの物件URLから価格・面積・住所を自動入力します。`,
    apply:   isEn ? "Apply to form" : "この内容で入力",
    discard: isEn ? "Discard" : "破棄",
    source:  isEn ? "Source:" : "取得元:",
    na:      isEn ? "Not found" : "取得できませんでした",
    failMsg: isEn
      ? "Could not extract information from this URL. Please fill in the form manually."
      : "このURLからは情報を取得できませんでした。下のフォームに直接ご入力ください。",
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    setError(null);
    setPreview(null);
    startTransition(async () => {
      const result = await parsePropertyUrl(url.trim());
      if (result.ok) {
        setPreview({ data: result.data, siteLabel: result.siteLabel, items: buildPreview(result.data, isEn) });
        setUrl("");
      } else {
        setError(t.failMsg);
      }
    });
  };

  const handleApply = () => {
    if (preview) { onParsed(preview.data); setPreview(null); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link2 className="w-3.5 h-3.5" />
        {t.title}
      </div>
      <p className="text-xs text-slate-400">{t.hint}</p>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          placeholder={t.placeholder}
          disabled={isPending}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={isPending || !url.trim()}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {isPending ? t.fetching : t.fetch}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{error}</p>
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
          {preview.siteLabel && (
            <p className="text-xs text-blue-600 font-semibold">{t.source} {preview.siteLabel}</p>
          )}
          <div className="space-y-1">
            {preview.items.map(({ field, label, value }) => (
              <div key={field} className="flex items-center gap-2 text-xs">
                {value !== undefined
                  ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : <X className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                <span className="text-slate-500 w-16 flex-shrink-0">{label}</span>
                {value !== undefined
                  ? <span className="font-medium text-slate-800">{value}</span>
                  : <span className="text-slate-400">{t.na}</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleApply}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
              {t.apply}
            </button>
            <button type="button" onClick={() => setPreview(null)}
              className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
              {t.discard}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
