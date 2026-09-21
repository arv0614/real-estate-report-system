"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** 入力できるタグの上限。プロンプトが発散するのを防ぐ */
export const MAX_TAGS = 12;
/** 1タグあたりの最大文字数（バックエンドの zod 制約と合わせる） */
export const MAX_TAG_LENGTH = 40;

/**
 * 「定番の条件」プリセット。messages の `LifestyleGenerator.presetTags`（配列）が
 * 各言語版を持つが、翻訳が壊れていても UI が消えないようフォールバックを持つ。
 */
export const DEFAULT_PRESET_TAGS = [
  "駐車場2台",
  "平屋",
  "3階建て",
  "テレワーク部屋",
  "アイランドキッチン",
  "吹き抜け",
  "庭・ウッドデッキ",
  "水害対策",
];

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** 同一ページに複数設置する場合に label と input を紐づけるための id */
  inputId?: string;
  disabled?: boolean;
}

/**
 * こだわり条件のフリーテキスト入力 + チップ表示。
 *
 * ダッシュボードの <LifestyleGenerator> とマイページの「AI建築・こだわり条件設定」で
 * 共有する。タグの追加（ボタン / Enter）・重複排除・上限チェック・削除だけを担当し、
 * 保存や画像生成は呼び出し側が行う。
 */
export function TagInput({ tags, onChange, inputId = "tag-input", disabled = false }: Props) {
  const t = useTranslations("LifestyleGenerator");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 翻訳ファイルに配列が無い / 壊れている場合でも定番タグを出す
  const rawPresets = t.raw("presetTags");
  const presetTags: string[] =
    Array.isArray(rawPresets) && rawPresets.every((p) => typeof p === "string")
      ? (rawPresets as string[])
      : DEFAULT_PRESET_TAGS;

  /** タグを1件追加する。追加できたら true、重複・上限で追加しなければ false */
  function pushTag(raw: string): boolean {
    const value = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!value || tags.includes(value)) return false;
    if (tags.length >= MAX_TAGS) {
      setError(t("errorMaxTags", { max: MAX_TAGS }));
      return false;
    }
    onChange([...tags, value]);
    setError(null);
    return true;
  }

  function addTag() {
    if (!input.trim()) return;
    // 重複時も入力欄はクリアする（同じ語を打ち直させない）
    if (pushTag(input) || tags.includes(input.trim().slice(0, MAX_TAG_LENGTH))) {
      setInput("");
    }
  }

  function removeTag(target: string) {
    onChange(tags.filter((tag) => tag !== target));
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 変換確定の Enter でタグが作られないよう、composing 中は無視する
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    addTag();
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_TAG_LENGTH}
          disabled={disabled}
          placeholder={t("tagPlaceholder")}
          className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || !input.trim()}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("addBtn")}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{t("tagHint", { max: MAX_TAGS })}</p>

      {/* ── 定番の条件から選ぶ ─────────────────────── */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600">{t("presetLabel")}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {presetTags.map((preset) => {
            const selected = tags.includes(preset);
            return (
              <li key={preset}>
                <button
                  type="button"
                  onClick={() => pushTag(preset)}
                  disabled={disabled || selected}
                  aria-pressed={selected}
                  aria-label={selected ? t("presetAdded", { tag: preset }) : t("presetAdd", { tag: preset })}
                  className={
                    selected
                      ? "inline-flex cursor-default items-center gap-1 rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
                      : "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  <span aria-hidden>{selected ? "✓" : "＋"}</span>
                  {preset}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-3 pr-1.5 text-sm text-indigo-800"
            >
              <span className="break-all">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={t("removeTag", { tag })}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-indigo-500 transition-colors hover:bg-indigo-200 hover:text-indigo-900 disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400">{t("tagEmpty")}</p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-500">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
