import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

// ブログ記事用の OGP 画像 (1200x630, summary_large_image)。
// クエリパラメータ:
//   - title (required, 〜100文字推奨)
//   - description (optional)
//   - tags (optional, カンマ区切り、上位4件まで採用)
//   - date (optional, ISO 8601 / YYYY-MM-DD)
//
// 画像は X の OGP scraper や Slack/Facebook クローラから取得される。
// 既存の /api/og (物件リサーチ結果用) と完全に分離して干渉を避ける。
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = (searchParams.get("title") || "ブログ記事").slice(0, 100);
  const description = (searchParams.get("description") || "").slice(0, 160);
  const tagsRaw = searchParams.get("tags") || "";
  const dateRaw = searchParams.get("date") || "";

  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);

  // タイトル長で動的にフォントサイズを調整 (日本語前提)
  const titleFontSize =
    title.length <= 22 ? 68
    : title.length <= 32 ? 58
    : title.length <= 46 ? 50
    : title.length <= 64 ? 42
    : 36;

  // 日付フォーマット
  let formattedDate = "";
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) {
      formattedDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e3a5f 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: "56px 64px",
        }}
      >
        {/* 装飾円 */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "-160px",
            right: "-110px",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.28) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "-120px",
            left: "-90px",
            width: "460px",
            height: "460px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
          }}
        />

        {/* ── 上部: ブランド + 日付 ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "10px",
                height: "32px",
                background: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
                borderRadius: "3px",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                fontWeight: 700,
                color: "#bfdbfe",
                letterSpacing: "0.5px",
              }}
            >
              物件目利きリサーチ
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "16px",
                fontWeight: 600,
                color: "rgba(191,219,254,0.55)",
                letterSpacing: "2px",
                marginLeft: "6px",
              }}
            >
              BLOG
            </div>
          </div>
          {formattedDate && (
            <div
              style={{
                display: "flex",
                fontSize: "18px",
                color: "rgba(148,163,184,0.85)",
                fontWeight: 500,
                letterSpacing: "1px",
              }}
            >
              {formattedDate}
            </div>
          )}
        </div>

        {/* ── 中央: タイトル + 説明 + タグ ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: `${titleFontSize}px`,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.22,
              letterSpacing: "-0.5px",
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                color: "rgba(226,232,240,0.82)",
                lineHeight: 1.55,
              }}
            >
              {description.length > 100 ? description.slice(0, 99) + "…" : description}
            </div>
          )}

          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "4px",
              }}
            >
              {tags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: "flex",
                    fontSize: "16px",
                    color: "#dbeafe",
                    background: "rgba(59,130,246,0.20)",
                    border: "1px solid rgba(96,165,250,0.45)",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    fontWeight: 600,
                  }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 下部: タグライン + ドメイン ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "16px",
              color: "rgba(148,163,184,0.85)",
              letterSpacing: "0.3px",
            }}
          >
            国交省データ × AI で読み解く不動産市況
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "15px",
              color: "rgba(191,219,254,0.85)",
              background: "rgba(96,165,250,0.10)",
              border: "1px solid rgba(96,165,250,0.30)",
              padding: "8px 18px",
              borderRadius: "22px",
              fontWeight: 600,
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
    },
  );
}
