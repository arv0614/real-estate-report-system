import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

// ─────────────────────────────────────────────────────────────────
// 文字サニタイズ
// Satori (next/og) の同梱フォント (Noto Sans) のグリフ範囲外の特殊記号は
// ☒ (ballot box with X) に化けるため、レンダリング前に ASCII 系に置換する。
// ─────────────────────────────────────────────────────────────────
const CHAR_MAP: Record<string, string> = {
  // 罫線・横線
  "│": "|",
  "┃": "|",
  // 全角記号
  "＝": "=",
  "÷": "/",
  // 乗除・×記号 (ユーザー要望で必ず x に変換)
  "×": "x",
  "✕": "x",
  "✗": "x",
  "✘": "x",
  // ☒ そのものが入ってきても保険で除去
  "☒": "",
  // 装飾系
  "■": "",
  "□": "",
  "▪": "",
  "▫": "",
  "◆": "",
  "◇": "",
  "●": "",
  "○": "",
  "★": "",
  "☆": "",
};

function sanitize(input: string): string {
  // 連続する横線 (── ── ━━ など) は視覚的な区切りとして残したいので
  // " - " (前後スペース付きハイフン) に置き換え。単発はただのハイフンに。
  let s = input
    .replace(/[─━]{2,}/g, " - ")
    .replace(/[─━]/g, "-");
  // 1 文字ずつのマッピング
  let out = "";
  for (const ch of s) {
    out += CHAR_MAP[ch] ?? ch;
  }
  // 連続スペースは 1 個に圧縮
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

// タイトル長から動的フォントサイズ
function titleFontSize(len: number): number {
  if (len <= 20) return 66;
  if (len <= 30) return 58;
  if (len <= 44) return 48;
  if (len <= 60) return 40;
  return 34;
}

// 文字列ハッシュ → 0..N のインデックス
function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = sanitize(searchParams.get("title") || "ブログ記事").slice(0, 100);
  const description = sanitize(searchParams.get("description") || "").slice(0, 200);
  const tagsRaw = searchParams.get("tags") || "";
  const dateRaw = searchParams.get("date") || "";
  const imageUrl = searchParams.get("image") || "";

  const tags = tagsRaw
    .split(",")
    .map((t) => sanitize(t.trim()))
    .filter(Boolean)
    .slice(0, 6);

  // 日付フォーマット
  let formattedDate = "";
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) {
      formattedDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  // タグクラウド用の固定座標 (画像 URL なしのときのみ表示)
  // 6 ポジションを用意し、tags 配列をループで埋める
  const cloudSlots: Array<{
    top: string;
    horizPos: { left: string } | { right: string };
    fontSize: number;
    opacity: number;
    rotate: number;
  }> = [
    { top: "3%",  horizPos: { left: "3%" },   fontSize: 108, opacity: 0.09, rotate: -6 },
    { top: "10%", horizPos: { right: "5%" },  fontSize: 78,  opacity: 0.075, rotate: 5 },
    { top: "32%", horizPos: { left: "-2%" },  fontSize: 138, opacity: 0.07, rotate: -3 },
    { top: "55%", horizPos: { right: "-3%" }, fontSize: 96,  opacity: 0.075, rotate: 7 },
    { top: "78%", horizPos: { left: "4%" },   fontSize: 60,  opacity: 0.085, rotate: -8 },
    { top: "88%", horizPos: { right: "12%" }, fontSize: 50,  opacity: 0.075, rotate: 4 },
  ];
  const showTagCloud = tags.length > 0 && !imageUrl;

  const titleSize = titleFontSize(title.length);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b1230 0%, #1e3a8a 45%, #0f2a4a 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: "44px 56px",
        }}
      >
        {/* ── レイヤー1: 背景画像 (image= 指定時のみ) ────────────── */}
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "1200px",
                height: "630px",
                objectFit: "cover",
                filter: "blur(8px) brightness(0.42) saturate(0.9)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "1200px",
                height: "630px",
                display: "flex",
                background: "linear-gradient(135deg, rgba(11,18,48,0.65) 0%, rgba(15,42,74,0.55) 100%)",
              }}
            />
          </>
        ) : null}

        {/* ── レイヤー2: タグクラウド透かし (画像なし時) ────────── */}
        {showTagCloud &&
          cloudSlots.map((slot, i) => {
            const tag = tags[i % tags.length];
            const horiz = "left" in slot.horizPos
              ? { left: slot.horizPos.left }
              : { right: slot.horizPos.right };
            return (
              <div
                key={`cloud-${i}-${tag}`}
                style={{
                  display: "flex",
                  position: "absolute",
                  top: slot.top,
                  ...horiz,
                  fontSize: `${slot.fontSize}px`,
                  fontWeight: 900,
                  color: `rgba(191, 219, 254, ${slot.opacity})`,
                  transform: `rotate(${slot.rotate}deg)`,
                  letterSpacing: "-1.5px",
                  whiteSpace: "nowrap",
                  textShadow: "0 0 1px rgba(96,165,250,0.2)",
                }}
              >
                #{tag}
              </div>
            );
          })}

        {/* ── レイヤー3: 装飾の光球 (image なし時のアクセント) ── */}
        {!imageUrl && (
          <>
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: "-180px",
                right: "-120px",
                width: "560px",
                height: "560px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(96,165,250,0.30) 0%, transparent 70%)",
              }}
            />
            <div
              style={{
                display: "flex",
                position: "absolute",
                bottom: "-140px",
                left: "-100px",
                width: "480px",
                height: "480px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 70%)",
              }}
            />
          </>
        )}

        {/* ── 上部: ブランドバッジ + 日付 ─────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(191,219,254,0.30)",
              padding: "8px 18px",
              borderRadius: "999px",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "8px",
                height: "8px",
                background: "#60a5fa",
                borderRadius: "50%",
                boxShadow: "0 0 8px rgba(96,165,250,0.8)",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                fontWeight: 700,
                color: "#dbeafe",
                letterSpacing: "0.3px",
              }}
            >
              物件目利きリサーチ
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "14px",
                fontWeight: 700,
                color: "rgba(191,219,254,0.65)",
                letterSpacing: "2px",
                marginLeft: "4px",
              }}
            >
              BLOG
            </div>
          </div>
          {formattedDate && (
            <div
              style={{
                display: "flex",
                fontSize: "16px",
                color: "rgba(191,219,254,0.85)",
                fontWeight: 600,
                letterSpacing: "1.2px",
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(96,165,250,0.25)",
                padding: "8px 16px",
                borderRadius: "999px",
              }}
            >
              {formattedDate}
            </div>
          )}
        </div>

        {/* ── 中央: タイトル + 説明 + タグ pill (カードパネル) ─ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            background: "rgba(11, 18, 40, 0.72)",
            border: "1px solid rgba(96,165,250,0.30)",
            borderRadius: "24px",
            padding: "36px 44px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            zIndex: 10,
          }}
        >
          {/* タイトル */}
          <div
            style={{
              display: "flex",
              fontSize: `${titleSize}px`,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.22,
              letterSpacing: "-0.5px",
            }}
          >
            {title}
          </div>

          {/* 説明 */}
          {description && (
            <div
              style={{
                display: "flex",
                fontSize: "19px",
                color: "rgba(226,232,240,0.85)",
                lineHeight: 1.55,
              }}
            >
              {description.length > 110 ? description.slice(0, 109) + "…" : description}
            </div>
          )}

          {/* タグ pill (Flexbox の gap + flexWrap でグリッド状に整列) */}
          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "4px",
              }}
            >
              {tags.map((tag, i) => {
                // tag 名のハッシュで色相を決定 (3 色から選択)
                const palette = [
                  { bg: "rgba(59,130,246,0.30)", border: "rgba(96,165,250,0.60)", color: "#dbeafe" },
                  { bg: "rgba(20,184,166,0.28)", border: "rgba(45,212,191,0.55)", color: "#ccfbf1" },
                  { bg: "rgba(168,85,247,0.25)", border: "rgba(192,132,252,0.55)", color: "#f3e8ff" },
                ];
                const c = palette[hashIndex(tag, palette.length)];
                return (
                  <div
                    key={`pill-${i}-${tag}`}
                    style={{
                      display: "flex",
                      fontSize: "16px",
                      color: c.color,
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      padding: "7px 18px",
                      borderRadius: "999px",
                      fontWeight: 600,
                    }}
                  >
                    #{tag}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 下部: タグライン + ドメイン ──────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "15px",
              color: "rgba(191,219,254,0.70)",
              letterSpacing: "0.4px",
              fontWeight: 500,
            }}
          >
            国交省データ x AI で読み解く不動産市況
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "14px",
              color: "rgba(191,219,254,0.85)",
              background: "rgba(96,165,250,0.12)",
              border: "1px solid rgba(96,165,250,0.35)",
              padding: "7px 16px",
              borderRadius: "999px",
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
