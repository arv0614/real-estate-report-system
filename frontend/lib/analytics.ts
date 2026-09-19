/**
 * GTM DataLayer ユーティリティ
 *
 * GA4 への計測は Google Tag Manager に一本化している（gtag.js の直接読み込みは
 * 二重計測になるため廃止）。アプリ側は dataLayer にイベントを積むだけで、
 * GA4 への送信は GTM コンテナ側のタグ／トリガー設定が担当する。
 *
 * - GTM が読み込まれる前に呼ばれた場合も配列に積まれ、GTM 初期化後に自動処理される
 * - SSR / Next.js Server Components でも安全（window チェック済み）
 */

export type UserPlanDL = "guest" | "free" | "pro";

/** dataLayer に積むイベントの共通形 */
export interface DLEvent {
  event: string;
  [key: string]: unknown;
}

/** 検索ファネルの主要3イベント。GTM 側で user_plan / search_count_today を参照する */
export interface FunnelDLEvent extends DLEvent {
  event: "generate_report" | "limit_reached" | "begin_checkout";
  user_plan: UserPlanDL;
  search_count_today: number;
}

export interface TrackEventParams {
  action: string;
  category: string;
  label?: string;
  value?: number;
  /** 追加のイベントパラメータ（例: { user_plan: "guest" }）。event_category/event_label とは別に送る */
  params?: Record<string, string | number>;
}

function push(payload: DLEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/** 検索ファネルイベント（generate_report / limit_reached / begin_checkout） */
export function dataLayerPush(payload: FunnelDLEvent): void {
  push(payload);
}

/**
 * 汎用イベント。GA4 の event_category / event_label に対応するキーをそのまま積むので、
 * GTM 側の GA4 イベントタグでイベント名（event）とパラメータを 1:1 で転送できる。
 */
export function trackEvent({ action, category, label, value, params }: TrackEventParams): void {
  push({
    event: action,
    event_category: category,
    ...(label !== undefined && { event_label: label }),
    ...(value !== undefined && { value }),
    ...params,
  });
}

/**
 * 購入イベント（決済完了）
 * @param transactionId  一意な取引ID（重複排除に使用）
 * @param value          購入金額
 * @param currency       通貨コード（例: "JPY"）
 */
export function trackPurchase(transactionId: string, value: number, currency: string): void {
  push({
    event: "purchase",
    transaction_id: transactionId,
    value,
    currency,
  });
}
