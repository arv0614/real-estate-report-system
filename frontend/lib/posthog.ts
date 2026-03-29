"use client";

import posthog from "posthog-js";

let initialized = false;

/**
 * PostHog を初期化する（クライアントサイドのみ・冪等）
 * NEXT_PUBLIC_POSTHOG_KEY が未設定の場合はノーオペレーション
 */
export function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false, // 手動イベントのみ
    persistence: "localStorage",
  });
  initialized = true;
}

/**
 * イベントを PostHog に送信する
 * キーが未設定 / 初期化前でも安全にノーオペレーション
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture(event, properties);
    }
  } catch {
    // 計測エラーは握り潰してメイン機能に影響させない
  }
}
