import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://realestate-frontend-2hctlfcy6a-an.a.run.app";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const address = searchParams.get("address") ?? "未指定エリア";
  const scoreRaw = searchParams.get("score");
  const price = searchParams.get("price"); // 例: "45万円/㎡"
  const flood = searchParams.get("flood"); // "0" | "1"

  const score = scoreRaw ? parseInt(scoreRaw, 10) : null;

  // スコアに応じた色
  const scoreColor =
    score === null ? "#94a3b8"
    : score >= 80   ? "#34d399"
    : score >= 60   ? "#fbbf24"
    :                  "#f87171";

  const scoreLabel =
    score === null ? "—"
    : score >= 80   ? "優良"
    : score >= 60   ? "普通"
    :                  "注意";

  const hasFlood = flood === "1";
  const floodLabel = hasFlood ? "危険 あり" : "安全 低";
  const floodColor = hasFlood ? "#f87171" : "#34d399";
  const floodBorder = hasFlood ? "rgba(248,113,113,0.5)" : "rgba(52,211,153,0.4)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 背景装飾 */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "-100px",
            left: "-60px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
          }}
        />

        {/* ── ヘッダー ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "40px 56px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "#a78bfa",
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            AI不動産診断レポート
          </div>
        </div>

        {/* ── 住所 ── */}
        <div
          style={{
            display: "flex",
            padding: "24px 56px 0",
            fontSize: "52px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            lineHeight: 1.15,
            maxWidth: "900px",
          }}
        >
          {address}
        </div>

        {/* ── メトリクス行 ── */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            padding: "32px 56px 0",
            alignItems: "stretch",
          }}
        >
          {/* スコアカード */}
          {score !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: `2px solid ${scoreColor}`,
                borderRadius: "20px",
                padding: "20px 36px",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>
                総合スコア
              </div>
              <div style={{ display: "flex", fontSize: "64px", fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                {String(score)}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: scoreColor,
                  background: `${scoreColor}22`,
                  padding: "3px 12px",
                  borderRadius: "20px",
                }}
              >
                {scoreLabel}
              </div>
            </div>
          )}

          {/* 坪単価カード */}
          {price && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: "1.5px solid rgba(255,255,255,0.15)",
                borderRadius: "20px",
                padding: "20px 32px",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>
                平均取引単価
              </div>
              <div style={{ display: "flex", fontSize: "36px", fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>
                {price}
              </div>
            </div>
          )}

          {/* ハザードカード */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: "rgba(255,255,255,0.08)",
              border: `1.5px solid ${floodBorder}`,
              borderRadius: "20px",
              padding: "20px 28px",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>
              洪水リスク
            </div>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 800, color: floodColor }}>
              {floodLabel}
            </div>
          </div>
        </div>

        {/* ── フッター ── */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px 32px",
          }}
        >
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(148,163,184,0.8)" }}>
            国土交通省「不動産情報ライブラリ」データを活用
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "14px",
              color: "rgba(148,163,184,0.7)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "6px 16px",
              borderRadius: "20px",
            }}
          >
            {SITE_URL.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
