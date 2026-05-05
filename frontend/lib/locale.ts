// クライアント/サーバ両対応の Locale 定数。
// `lib/blog.ts` は Node の fs に依存するため、Locale 型と ALL_LOCALES を
// 参照するだけのクライアントコンポーネントは、こちらからインポートする。

export type Locale = "ja" | "en" | "zh-TW" | "zh-CN";

export const ALL_LOCALES: Locale[] = ["ja", "en", "zh-TW", "zh-CN"];
