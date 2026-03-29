"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/posthog";

/** PostHog をクライアントサイドで初期化するだけのコンポーネント */
export default function PostHogInit() {
  useEffect(() => {
    initPostHog();
  }, []);
  return null;
}
