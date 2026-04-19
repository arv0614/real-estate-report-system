import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mekiki-research.com";

function gradeColor(grade: string): string {
  if (grade === "A+") return "#34d399";
  if (grade === "A")  return "#6ee7b7";
  if (grade === "B+") return "#2dd4bf";
  if (grade === "B")  return "#60a5fa";
  if (grade === "C")  return "#fbbf24";
  if (grade === "D")  return "#f97316";
  return "#94a3b8"; // — (insufficient)
}

function modeLabel(mode: string, type: string): string {
  const typePart = type === "house" ? "🏠 戸建" : "🏢 マンション";
  const modePart = mode === "investment" ? "投資物件" : "自宅購入";
  return `${typePart}・${modePart}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const grade      = searchParams.get("grade")      ?? "B";
  const area       = searchParams.get("area")       ?? "物件";
  const score      = searchParams.get("score")      ?? "";
  const mode       = searchParams.get("mode")       ?? "home";
  const type       = searchParams.get("type")       ?? "mansion";
  const autoFilled = searchParams.get("autoFilled") === "true";

  const color   = gradeColor(grade);
  const modeLbl = modeLabel(mode, type);

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
        {/* Background decoration */}
        <div style={{ display: "flex", position: "absolute", top: "-120px", right: "-80px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)" }} />
        <div style={{ display: "flex", position: "absolute", bottom: "-100px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "40px 56px 0" }}>
          <div style={{ display: "flex", fontSize: "24px", color: "#a78bfa", fontWeight: 700 }}>
            物件目利きリサーチ
          </div>
          <div style={{ display: "flex", marginLeft: "16px", fontSize: "13px", color: "#94a3b8", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "20px", padding: "4px 14px" }}>
            {modeLbl}
          </div>
        </div>

        {/* Main content: Grade + Area */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 56px", gap: "64px" }}>
          {/* Grade circle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "200px", height: "200px", borderRadius: "50%", border: `6px solid ${color}`, background: `${color}18`, flexShrink: 0 }}>
            <div style={{ display: "flex", fontSize: "100px", fontWeight: 900, color, lineHeight: 1 }}>
              {grade}
            </div>
            {score && (
              <div style={{ display: "flex", fontSize: "20px", color: color, fontWeight: 700, marginTop: "4px" }}>
                {score}点
              </div>
            )}
          </div>

          {/* Area and description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", fontSize: "56px", fontWeight: 800, color: "#ffffff", lineHeight: 1.2, maxWidth: "800px" }}>
              {area}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", width: "8px", height: "8px", borderRadius: "50%", background: color }} />
              <div style={{ display: "flex", fontSize: "18px", color: "#94a3b8" }}>
                総合評価 {grade}
                {score ? `（${score}点）` : ""}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: "16px", color: "rgba(148,163,184,0.7)" }}>
              相場・災害リスク・将来性を総合分析
            </div>
          </div>
        </div>

        {/* Auto-filled badge (U8) */}
        {autoFilled && (
          <div style={{
            display: "flex",
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(100,100,100,0.8)",
            color: "white",
            fontSize: "12px",
            padding: "6px 12px",
            borderRadius: "10px",
            fontWeight: 600,
          }}>
            ※参考値を含む
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px 32px" }}>
          <div style={{ display: "flex", fontSize: "14px", color: "rgba(148,163,184,0.7)" }}>
            国土交通省・J-SHIS・e-Stat データを活用した物件分析
          </div>
          <div style={{ display: "flex", fontSize: "14px", color: "rgba(148,163,184,0.7)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 16px", borderRadius: "20px" }}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
