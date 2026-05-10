import { useTranslations } from "next-intl";

type SourceKey = "mlit" | "openMeteo";

const URLS: Record<SourceKey, string> = {
  mlit: "https://www.reinfolib.mlit.go.jp/",
  openMeteo: "https://open-meteo.com/",
};

interface Props {
  source: SourceKey;
  /** 末尾に追加表示する補足テキスト（例: 期間表示） */
  suffix?: string;
  className?: string;
}

/**
 * データ出典のテキストリンク。アプリ全体で表記とURLを統一するための共通コンポーネント。
 * i18n キー: Sources.prefix / Sources.{mlit|openMeteo}
 */
export function SourceLink({ source, suffix, className }: Props) {
  const t = useTranslations("Sources");
  const url = URLS[source];
  const label = source === "mlit" ? t("mlit") : t("openMeteo");

  return (
    <p className={`text-[11px] text-slate-500 ${className ?? ""}`}>
      {t("prefix")}{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {label}
      </a>
      {suffix ? <span className="text-slate-400"> {suffix}</span> : null}
    </p>
  );
}
