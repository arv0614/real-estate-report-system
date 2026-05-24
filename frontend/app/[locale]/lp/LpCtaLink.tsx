"use client";

import Link from "next/link";
import { gtagEvent } from "@/lib/gtag";

interface Props {
  href: string;
  /** 計測ラベル。どの CTA からの流入かを区別する（例: "heroCta" / "bottomCta"）。 */
  label: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * LP の「無料で試す」CTA。クリック時に GA4 へ click_lp_cta（acquisition）を発火しつつ
 * 通常の next/link 遷移を行う。Server Component の lp/page.tsx から利用するため client 境界を切る。
 */
export function LpCtaLink({ href, label, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => gtagEvent({ action: "click_lp_cta", category: "acquisition", label })}
    >
      {children}
    </Link>
  );
}
