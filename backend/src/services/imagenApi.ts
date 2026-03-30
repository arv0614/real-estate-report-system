import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

// ============================================================
// 暮らしイメージ画像生成
// Stage1: gemini-2.5-flash でエリア固有の英語プロンプトを生成
// Stage2: Imagen 4 Fast → gemini-2.5-flash-image → SVG モック
// ============================================================

const IMAGEN4_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict";

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  isMock: boolean;
}

// ============================================================
// Stage1: テキストモデルで画像生成用英語プロンプトを動的生成
// ============================================================

const PROMPT_SYSTEM_INSTRUCTION = `You are an expert at writing prompts for photorealistic image generation AI (like Imagen or Midjourney).
Your task: given a Japanese address and area description, write a single English image generation prompt that will produce a photorealistic lifestyle photo perfectly matching that specific location.

Rules:
- Output ONLY the image generation prompt string. No explanation, no markdown, no prefix like "Prompt:".
- The prompt must be comma-separated keywords and short phrases.
- Always capture the REAL visual character of the specific location. Do NOT produce generic Japanese suburb imagery.
- Season / Weather rules:
  - If the area is known for heavy snow (e.g., Hokkaido, Tohoku, Niigata, mountainous parts of Nagano, Yamagata, Fukushima, Akita) → MUST include: winter, heavy snow, snowy landscape, snow-covered
  - If the area is a famous ski resort (e.g., Nozawa Onsen, Hakuba, Niseko, Furano) → MUST include: ski slopes, ski resort, snowy mountains, winter resort town
  - If the area is tropical or warm (e.g., Okinawa, Kagoshima, Miyazaki) → MUST include: tropical, warm climate, blue sea
  - Otherwise → use appropriate season based on the area description
- Urban / Rural rules:
  - If the area is in Tokyo 23 wards, Osaka city center, Nagoya city center, or other major urban cores → MUST include: dense urban streetscape, high-rise buildings, busy city, urban vibes. NEVER include: field, nature, rural, empty land, countryside
  - If the area is rural, mountainous, or a small town → include appropriate rural/natural scenery
- Architecture: reflect the actual local architectural style (e.g., traditional onsen town buildings, modern city towers, wooden machiya, etc.)
- Always end with: photorealistic, high-quality photography, 16:9 landscape format, vibrant colors, happy family`;

/**
 * gemini-2.5-flash を使って、エリア固有の画像生成用英語プロンプトを動的生成する。
 * 失敗した場合は静的フォールバックプロンプトを返す。
 */
async function generateDynamicPrompt(
  prefecture: string,
  municipality: string,
  areaFeatures?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: PROMPT_SYSTEM_INSTRUCTION,
  });

  const userMessage =
    `Address: ${prefecture} ${municipality}\n` +
    (areaFeatures
      ? `Area description (Japanese):\n${areaFeatures.slice(0, 800)}`
      : "No area description available.");

  const result = await model.generateContent(userMessage);
  const text = result.response.text().trim();

  if (!text) throw new Error("Empty response from prompt generator");
  return text;
}

// ============================================================
// SVG モックフォールバック
// ============================================================

function getMockImageBase64(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#87CEEB"/>
      <stop offset="100%" style="stop-color:#FDB97D"/>
    </linearGradient>
    <linearGradient id="gr" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5DC55D"/>
      <stop offset="100%" style="stop-color:#2E7D32"/>
    </linearGradient>
  </defs>
  <rect width="800" height="300" fill="url(#sky)"/>
  <rect y="295" width="800" height="155" fill="url(#gr)"/>
  <circle cx="110" cy="85" r="48" fill="#FFD700" opacity="0.9"/>
  <rect x="240" y="175" width="320" height="165" fill="#F5F0E8" stroke="#C4A882" stroke-width="2"/>
  <polygon points="210,178 590,178 545,95 255,95" fill="#8B4513"/>
  <rect x="365" y="265" width="70" height="75" rx="4" fill="#7B5B3A"/>
  <circle cx="425" cy="305" r="5" fill="#FFD700"/>
  <rect x="270" y="205" width="80" height="65" rx="3" fill="#ADD8E6" stroke="#C4A882" stroke-width="2"/>
  <line x1="270" y1="237" x2="350" y2="237" stroke="#C4A882" stroke-width="1.5"/>
  <line x1="310" y1="205" x2="310" y2="270" stroke="#C4A882" stroke-width="1.5"/>
  <rect x="450" y="205" width="80" height="65" rx="3" fill="#ADD8E6" stroke="#C4A882" stroke-width="2"/>
  <line x1="450" y1="237" x2="530" y2="237" stroke="#C4A882" stroke-width="1.5"/>
  <line x1="490" y1="205" x2="490" y2="270" stroke="#C4A882" stroke-width="1.5"/>
  <rect x="148" y="250" width="14" height="90" fill="#8B4513"/>
  <ellipse cx="155" cy="235" rx="42" ry="38" fill="#2D7A2D"/>
  <rect x="625" y="240" width="14" height="100" fill="#8B4513"/>
  <ellipse cx="632" cy="222" rx="50" ry="46" fill="#267026"/>
  <polygon points="355,340 445,340 465,450 335,450" fill="#D2B48C"/>
  <circle cx="245" cy="332" r="9" fill="#FF69B4"/>
  <circle cx="265" cy="326" r="7" fill="#FFB6C1"/>
  <circle cx="535" cy="332" r="9" fill="#FF8C00"/>
  <circle cx="555" cy="326" r="7" fill="#FFA500"/>
  <circle cx="695" cy="305" r="16" fill="#4A3728"/>
  <rect x="686" y="321" width="18" height="38" rx="5" fill="#4A3728"/>
  <circle cx="725" cy="310" r="13" fill="#7B5B4A"/>
  <rect x="717" y="323" width="16" height="34" rx="5" fill="#7B5B4A"/>
  <circle cx="748" cy="323" r="10" fill="#5D3E31"/>
  <rect x="741" y="333" width="14" height="26" rx="5" fill="#5D3E31"/>
  <rect x="0" y="405" width="800" height="45" fill="rgba(0,0,0,0.25)"/>
  <text x="400" y="433" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#fff">AI暮らしイメージ（モックプレビュー）</text>
</svg>`;
  return Buffer.from(svg).toString("base64");
}

// ============================================================
// Stage2: 画像生成モデル
// ============================================================

/** Imagen 4 Fast (REST predict API) で画像生成 */
async function generateViaImagen4(prompt: string): Promise<GeneratedImage> {
  const response = await axios.post(
    `${IMAGEN4_ENDPOINT}?key=${config.gemini.apiKey}`,
    {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        safetyFilterLevel: "block_only_high",
        personGeneration: "allow_adult",
      },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 }
  );

  const prediction = response.data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) throw new Error("No image data in Imagen 4 response");

  return {
    imageBase64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType ?? "image/png",
    isMock: false,
  };
}

/** gemini-2.5-flash-image (generateContent + responseModalities IMAGE) で画像生成 */
async function generateViaGeminiImage(prompt: string): Promise<GeneratedImage> {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] } as Record<string, unknown>,
  });

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as unknown as Record<string, unknown>).inlineData as
      | { data: string; mimeType: string }
      | undefined;
    if (inline?.data) {
      return { imageBase64: inline.data, mimeType: inline.mimeType, isMock: false };
    }
  }
  throw new Error("No image data in Gemini response");
}

// ============================================================
// 公開API
// ============================================================

/**
 * 「その街での暮らしイメージ」画像を2段階で生成する。
 * Stage1: gemini-2.5-flash でエリア固有の英語プロンプトを動的生成
 * Stage2: Imagen 4 → gemini-2.5-flash-image → SVG モック
 */
export async function generateLifestyleImage(
  prefecture: string,
  municipality: string,
  areaFeatures?: string
): Promise<GeneratedImage> {
  if (!config.gemini.apiKey) {
    throw new Error("[ImageGen] APIキー未設定");
  }

  console.log(`[ImageGen] 生成開始: ${prefecture}${municipality}`);

  // ── Stage1: 動的プロンプト生成 ──
  let imagePrompt: string;
  try {
    imagePrompt = await generateDynamicPrompt(prefecture, municipality, areaFeatures);
    console.log(`[ImageGen] 動的プロンプト生成完了: ${imagePrompt}`);
  } catch (promptErr) {
    // プロンプト生成失敗時は簡易フォールバックプロンプトで続行
    console.warn(`[ImageGen] 動的プロンプト生成失敗、フォールバック使用: ${promptErr instanceof Error ? promptErr.message : promptErr}`);
    imagePrompt =
      `Photorealistic lifestyle photo of ${municipality}, ${prefecture}, Japan. ` +
      `Accurately reflect the local scenery, architecture, and seasonal weather. ` +
      `Happy family, 16:9, high-quality photography.`;
  }

  // ── Stage2-a: Imagen 4 ──
  try {
    const result = await generateViaImagen4(imagePrompt);
    console.log(`[ImageGen] Imagen 4 完了 (${result.mimeType})`);
    return result;
  } catch (err1) {
    console.warn(`[ImageGen] Imagen 4 失敗: ${err1 instanceof Error ? err1.message : err1}`);
  }

  // ── Stage2-b: gemini-2.5-flash-image ──
  try {
    const result = await generateViaGeminiImage(imagePrompt);
    console.log(`[ImageGen] gemini-2.5-flash-image 完了 (${result.mimeType})`);
    return result;
  } catch (err2) {
    console.warn(`[ImageGen] gemini-2.5-flash-image 失敗: ${err2 instanceof Error ? err2.message : err2}`);
  }

  // ── Fallback: 全モデル失敗 → エラーをスロー ──
  throw new Error("[ImageGen] 全モデルが画像生成に失敗しました");
}
