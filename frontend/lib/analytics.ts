import { sendGAEvent } from "@next/third-parties/google";

/**
 * GA4 / GTM 計測ユーティリティ
 *
 * GA4 測定ID。frontend/app/layout.tsx の <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> に渡す。
 * 送信先は GA4 プロパティ「Mekiki-Research - GA4」(312222045) の測定ID G-4Y1CLF7J2P。
 * レポート系スクリプトが読む scripts/ga4_config.js のプロパティIDと必ず対応させる。
 *
 * GTM（NEXT_PUBLIC_GTM_ID）はマーケティング用ポップアップ等の配信のために維持するが、
 * GA4タグの配信はGTMコンテナ側で停止済み（2026-09-16）。GA4計測（ページビュー・
 * カスタムイベント）は @next/third-parties/google の <GoogleAnalytics> とこのモジュールの
 * trackEvent()/trackPurchase()（sendGAEvent 経由）でコード完結管理する（2026-09-21）。
 *
 * - dataLayerPush() は検索ファネル専用。GTM コンテナ側のトリガー（マーケティング用
 *   ポップアップの表示条件など）だけを目的とし、GA4 へは送らない。
 * - trackEvent()/trackPurchase() は sendGAEvent() で GA4 に直接届く。<GoogleAnalytics>
 *   コンポーネントが layout.tsx でマウントされている前提（sendGAEvent の要件）。
 * - いずれも SSR / Next.js Server Components でも安全（window チェック済み）。
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-4Y1CLF7J2P";

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

/**
 * 検索ファネルイベント（generate_report / limit_reached / begin_checkout）を GTM の
 * dataLayer に積む。GTM コンテナ側のトリガー用途専用で、GA4 には送らない
 * （GA4 への到達は trackEvent()/trackPurchase() が別途担当する）。
 */
export function dataLayerPush(payload: FunnelDLEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/**
 * GA4 カスタムイベント送信（sendGAEvent 経由でコード完結管理）。
 */
export function trackEvent({ action, category, label, value, params }: TrackEventParams): void {
  if (typeof window === "undefined") return;
  sendGAEvent("event", action, {
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
export function trackPurchase(transactionId: string, value: number, currency: string): void {
  if (typeof window === "undefined") return;
  sendGAEvent("event", "purchase", {
    transaction_id: transactionId,
    value,
    currency,
  });
}
