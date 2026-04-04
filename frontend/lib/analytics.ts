/**
 * GTM DataLayer ユーティリティ
 *
 * window.dataLayer.push() のラッパー。
 * GTM が読み込まれる前に呼ばれた場合も配列に積まれ、
 * GTM 初期化後に自動的に処理される。
 */

export type UserPlanDL = "guest" | "free" | "pro";

export interface DLEvent {
  event: "generate_report" | "limit_reached" | "begin_checkout";
  user_plan: UserPlanDL;
  search_count_today: number;
  [key: string]: unknown;
}

export function dataLayerPush(payload: DLEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}
