export const GA_MEASUREMENT_ID = "G-MF8SLJ81D2";

interface GtagEventParams {
  action: string;
  category: string;
  label?: string;
  value?: number;
  /** GA4 カスタムイベントパラメータ（例: { user_plan: "guest" }）。event_category/event_label とは別に送る */
  params?: Record<string, string | number>;
}

export function gtagEvent({ action, category, label, value, params }: GtagEventParams) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", action, {
    event_category: category,
    ...(label !== undefined && { event_label: label }),
    ...(value !== undefined && { value }),
    ...params,
  });
}

/**
 * GA4 purchase イベント（決済完了）
 * @param transactionId  一意な取引ID（重複排除に使用）
 * @param value          購入金額
 * @param currency       通貨コード（例: "JPY"）
 */
export function gtagPurchase(transactionId: string, value: number, currency: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "purchase", {
    transaction_id: transactionId,
    value,
    currency,
  });
}
