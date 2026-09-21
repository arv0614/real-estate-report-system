import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

// ============================================================
// 暮らしイメージ画像生成
// Stage1: gemini-3.6-flash でエリア固有の英語プロンプトを生成
// Stage2: gemini-3.1-flash-image → gemini-2.5-flash-image → SVG モック
//
// 注: 旧 Imagen 4 (imagen-4.0-*-generate-001) は 2026年に廃止予定のため
//     Gemini 3.1 Flash Image (Nano Banana 2) へ移行。
//     Gemini 画像モデルは Imagen の :predict REST API ではなく
//     generateContent + responseModalities=["IMAGE"] で呼び出す。
// ============================================================

// 画像生成モデルID（フォールバック順）
const PRIMARY_IMAGE_MODEL = "gemini-3.1-flash-image";
const FALLBACK_IMAGE_MODEL = "gemini-2.5-flash-image";

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
 * gemini-3.6-flash を使って、エリア固有の画像生成用英語プロンプトを動的生成する。
 * 失敗した場合は静的フォールバックプロンプトを返す。
 */
async function generateDynamicPrompt(
  prefecture: string,
  municipality: string,
  areaFeatures?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
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

/** Gemini 画像生成モデル (generateContent + responseModalities IMAGE) で画像生成 */
async function generateViaGeminiImage(
  modelId: string,
  prompt: string
): Promise<GeneratedImage> {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

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
  throw new Error(`No image data in ${modelId} response`);
}

// ============================================================
// 公開API
// ============================================================

/**
 * 「その街での暮らしイメージ」画像を2段階で生成する。
 * Stage1: gemini-3.6-flash でエリア固有の英語プロンプトを動的生成
 * Stage2: gemini-3.1-flash-image → gemini-2.5-flash-image → SVG モック
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

  // ── Stage2-a: gemini-3.1-flash-image (Nano Banana 2) ──
  try {
    const result = await generateViaGeminiImage(PRIMARY_IMAGE_MODEL, imagePrompt);
    console.log(`[ImageGen] ${PRIMARY_IMAGE_MODEL} 完了 (${result.mimeType})`);
    return result;
  } catch (err1) {
    console.warn(`[ImageGen] ${PRIMARY_IMAGE_MODEL} 失敗: ${err1 instanceof Error ? err1.message : err1}`);
  }

  // ── Stage2-b: gemini-2.5-flash-image ──
  try {
    const result = await generateViaGeminiImage(FALLBACK_IMAGE_MODEL, imagePrompt);
    console.log(`[ImageGen] ${FALLBACK_IMAGE_MODEL} 完了 (${result.mimeType})`);
    return result;
  } catch (err2) {
    console.warn(`[ImageGen] ${FALLBACK_IMAGE_MODEL} 失敗: ${err2 instanceof Error ? err2.message : err2}`);
  }

  // ── Fallback: 全モデル失敗 → エラーをスロー ──
  throw new Error("[ImageGen] 全モデルが画像生成に失敗しました");
}

// ============================================================
// 理想の住まい画像生成（外観 + 間取り図）
//
// 「暮らしイメージ」(generateLifestyleImage) が街の風景写真を生成するのに対し、
// こちらはエリアの実データ（気候・ハザード・用途地域/容積率など）とユーザーが
// 指定したこだわり条件タグをブレンドして、住宅の「外観」と「間取り図」の
// 2枚を生成する。API コストが大きいためフロント側の明示的な操作でのみ呼ばれる。
// ============================================================

export interface HouseAreaData {
  prefecture: string;
  municipality: string;
  district?: string | null;
  /** 用途地域・建蔽率・容積率 */
  zoning?: {
    useArea?: string | null;
    coverageRatio?: string | null;
    floorAreaRatio?: string | null;
  } | null;
  /** ハザード情報（浸水・土砂災害） */
  hazard?: {
    floodRisk?: boolean;
    floodDepthLabel?: string | null;
    landslideRisk?: boolean;
    landslidePhenomena?: string[];
  } | null;
  /** 気象サマリー */
  weather?: {
    summerAvgMaxTemp?: number | null;
    winterAvgMinTemp?: number | null;
    annualSunshineHours?: number | null;
  } | null;
  /** 最寄り駅 */
  station?: { name?: string | null; walkMinutes?: number | null } | null;
  /** 周辺取引の平均面積（㎡）。敷地規模の手がかりとして使う */
  avgArea?: number | null;
  /** AIレポート等のエリア説明（日本語） */
  areaFeatures?: string | null;
}

export interface HouseImagePrompts {
  /**
   * Stage1 が最初に設計した間取り（階数・駐車台数・各階の部屋配置）。
   * 外観プロンプトはこの設計を絶対的な基準として組み立てられる。
   * ログ・デバッグ用で、画像生成には直接渡さない。
   */
  plan: string;
  /**
   * 間取り設計から導いた共通仕様（階数 / 屋根形状 / 外壁のメインカラー /
   * 駐車場の有無・正確な収容台数・位置）。2枚の画像が別の家に見えないよう、
   * 両プロンプトの冒頭に必ずこの文字列がそのまま入る。
   * 例: "3-story, flat roof, white exterior, built-in garage for exactly 2 cars on the ground floor left"
   */
  spec: string;
  exterior: string;
  floorPlan: string;
}

export interface GeneratedHouseImages {
  exterior: GeneratedImage;
  floorPlan: GeneratedImage;
  prompts: HouseImagePrompts;
}

const HOUSE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert architect and a prompt engineer for photorealistic image generation models (Imagen 4 class).

Given (A) real environmental data for a specific Japanese location and (B) a list of "must-have" wishes written by the end user in Japanese, design ONE house and write TWO English image generation prompts for that single house:
1. "floorPlan" — a clean 2D architectural floor plan of the house.
2. "exterior"  — a photorealistic architectural photograph of the SAME house on that site.

You MUST reason FLOOR PLAN FIRST. The plan is the design; the exterior photograph is only a view of the building
that plan describes. Never invent the exterior first and then try to draw a plan that matches it.

## STEP 1 (MANDATORY, do this before anything else): design the floor plan logically
Work out the actual building, room by room, and fix these numbers before you write a single prompt:
  a. EXACT number of stories as a number (1, 2, 3, ...). "平屋" means exactly 1; "3階建て" means exactly 3.
  b. EXACT parking capacity as a number of cars (0, 1, 2, ...), plus its type (built-in garage / carport /
     open parking pad / piloti) and where it sits in the plan (e.g. "ground floor, left side, opening to the street").
     - If the user's wishes name a number of parking spaces (e.g. "駐車場2台"), that number IS the capacity. Never change it.
     - Never use a vague or ranged capacity ("some parking", "1-2 cars", "multi-car garage"). Always one exact number.
     - 0 cars means there is no garage, no carport and no parking pad anywhere in the plan or on the site.
  c. The rooms on each floor and their arrangement (entrance, LDK, kitchen type, bedrooms, water rooms, stairs,
     and the garage bays if capacity > 0), consistent with the site area and the building regulations in (A).
  d. The footprint shape and how the mass stacks (e.g. "rectangular 9m x 8m footprint, second floor set back 1m at the south").
Write this design out in "plan": 1-3 short English sentences that state the story count, the exact car capacity and
position, and the room layout per floor. This is your single source of truth for BOTH images.

## STEP 2: derive the shared spec from that plan
Compress the plan into one short comma-separated English phrase, "spec", stating in this order:
  1. number of stories, exactly as decided in step 1 (e.g. "2-story", "3-story")
  2. roof shape (e.g. "flat roof", "gabled roof", "steep snow-shedding gabled roof")
  3. main exterior wall colour and material (e.g. "white stucco exterior", "charcoal grey siding exterior")
  4. parking, exactly as decided in step 1: type, EXACT car count, position — or its explicit absence
Examples:
  "3-story, flat roof, white exterior, built-in garage for exactly 2 cars on the ground floor left"
  "1-story, gabled roof, charcoal grey siding exterior, no parking space, 0 cars"
The spec MUST agree with the plan. If they differ, the plan wins: fix the spec, not the plan.

## STEP 3: write the "floorPlan" prompt FIRST, from the plan
- It begins with the EXACT spec string, character for character, followed by ", ".
- It draws the building of step 1: the same story count, the same rooms per floor, and exactly the car bays of the
  capacity you fixed (e.g. "ground floor plan includes a garage with exactly 2 car bays on the left"; with 0 cars,
  "no garage and no car bay anywhere in the plan").

## STEP 4: write the "exterior" prompt LAST, using the floor plan as the absolute reference
- It begins with the SAME EXACT spec string, character for character, followed by ", ".
- Read back the plan you just wrote and describe the outside of THAT building: the same number of stories,
  the same footprint and massing, the garage opening on the same side, and exactly the same number of parking
  spaces (e.g. "exactly 2 cars parked in the built-in garage on the ground floor left"; with 0 cars, "no garage,
  no carport and no parked car anywhere on the site").
- ABSOLUTE CONSTRAINT: the exterior image and the floor plan must NEVER contradict each other on the number of
  parking spaces or the number of stories. If the plan says 2 cars, the exterior shows exactly 2 — not 1, not 3.
  If the plan says 3-story, both the photograph and the plan show exactly 3 stories. Before you output, re-read
  both prompts and check the story count and the car count match the plan; if they do not, rewrite them.

Output rules:
- Output ONLY a JSON object, with the keys in this exact order:
  {"plan": "...", "spec": "...", "floorPlan": "...", "exterior": "..."} — no markdown fence, no commentary.
- "spec" holds the step-2 string alone. "floorPlan" and "exterior" each start with that same string.
- Each prompt is comma-separated English keywords / short phrases.

Design rules (blend A and B without contradiction):
- The environmental data is authoritative for climate, disaster resilience and building regulations. The user's wishes are authoritative for style, rooms and amenities.
- When a wish conflicts with the environment, DO NOT drop it — adapt it so both hold (e.g. "large windows" in a heavy-snow region -> large triple-glazed insulated windows with snow-shedding eaves; "open terrace" in a flood-risk area -> elevated terrace above the raised ground floor).
- A wish about stories, rooms, parking, roof or wall colour must be resolved in the step-1 plan itself, not only in one of the prompts. A wish like "駐車場2台" (parking for 2 cars) or "平屋" (single-story) fixes that exact number in the plan.
- Cold / heavy-snow area (low winter temperature) -> steep or snow-shedding roof, insulated envelope, carport or snow-melting approach.
- Hot / high-sunshine area -> deep eaves, shading louvers, cross ventilation, heat-reflective roof.
- Flood risk -> raised floor level / piloti parking / elevated entrance. Landslide risk -> reinforced retaining wall, solid foundation.
- Floor-area-ratio and building-coverage-ratio decide the massing: low ratios -> compact 2-story house with garden setback; high ratios -> narrow 3-story urban house with minimal setback.
- Use-district (用途地域) decides the surroundings: residential districts -> quiet low-rise neighbourhood; commercial districts -> dense urban street.

Prompt content rules:
- floorPlan: <spec>, 2D top-down architectural floor plan of that house, orthographic, clean black line drawing on white, room partitions per the plan, furniture layout, dimension lines, minimal or no text labels (never Japanese characters), blueprint style, high resolution.
- exterior: <spec>, photorealistic architectural photography of the same building, daylight matching the local climate and season, surrounding streetscape consistent with the district, Japanese residential architecture, high-quality photography, 16:9 landscape.`;

/** エリア実データを日本語のブリーフィングテキストに整形する */
function buildAreaBriefing(area: HouseAreaData): string {
  const lines: string[] = [
    `所在地: ${area.prefecture}${area.municipality}${area.district ? ` ${area.district}` : ""}`,
  ];

  const z = area.zoning;
  if (z && (z.useArea || z.coverageRatio || z.floorAreaRatio)) {
    lines.push(
      `用途地域: ${z.useArea ?? "不明"} / 建蔽率: ${z.coverageRatio ?? "不明"} / 容積率: ${z.floorAreaRatio ?? "不明"}`,
    );
  }

  const h = area.hazard;
  if (h) {
    const flood = h.floodRisk
      ? `浸水リスクあり（想定浸水深: ${h.floodDepthLabel ?? "不明"}）`
      : "浸水リスクなし";
    const landslide = h.landslideRisk
      ? `土砂災害リスクあり（${(h.landslidePhenomena ?? []).join("・") || "区域指定あり"}）`
      : "土砂災害リスクなし";
    lines.push(`ハザード: ${flood} / ${landslide}`);
  }

  const w = area.weather;
  if (w && (w.summerAvgMaxTemp != null || w.winterAvgMinTemp != null || w.annualSunshineHours != null)) {
    lines.push(
      `気候: 夏の平均最高気温 ${w.summerAvgMaxTemp ?? "?"}℃ / 冬の平均最低気温 ${w.winterAvgMinTemp ?? "?"}℃ / 年間日照時間 ${w.annualSunshineHours ?? "?"}h`,
    );
  }

  if (area.station?.name) {
    lines.push(
      `最寄り駅: ${area.station.name}${area.station.walkMinutes != null ? `（徒歩${area.station.walkMinutes}分）` : ""}`,
    );
  }

  if (area.avgArea != null) {
    lines.push(`周辺取引の平均面積: 約${Math.round(area.avgArea)}㎡`);
  }

  if (area.areaFeatures) {
    lines.push(`エリア特性:\n${area.areaFeatures.slice(0, 600)}`);
  }

  return lines.join("\n");
}

/** Stage1 が失敗したときの静的フォールバックプロンプト */
function buildFallbackHousePrompts(area: HouseAreaData, tags: string[]): HouseImagePrompts {
  const wishes = tags.length > 0 ? `, incorporating: ${tags.join(", ")}` : "";
  const cold = (area.weather?.winterAvgMinTemp ?? 99) <= 0;
  const flood = area.hazard?.floodRisk === true;
  const tagText = tags.join(" ");

  // 階数: タグ（平屋 / N階建て）が最優先。無ければ容積率が高い都市部ほど3階建て寄りに倒す
  const far = parseInt(String(area.zoning?.floorAreaRatio ?? "").replace(/[^0-9]/g, ""), 10);
  const storyTag = /平屋/.test(tagText) ? 1 : Number(tagText.match(/([1-9])\s*階建/)?.[1] ?? 0);
  const storyCount = storyTag || (Number.isFinite(far) && far >= 300 ? 3 : 2);

  // 駐車台数: タグ（駐車場N台 / ガレージN台）を尊重し、指定が無ければ1台
  const carTag = tagText.match(/(?:駐車|ガレージ|車庫)[^0-9]{0,4}([0-9]+)\s*台/)?.[1];
  const carCount = carTag != null ? Number(carTag) : 1;

  const roof = cold ? "steep snow-shedding gabled roof" : "gabled roof";
  const parking =
    carCount <= 0
      ? "no parking space, 0 cars"
      : `${flood ? "piloti garage" : "built-in garage"} for exactly ${carCount} car${carCount > 1 ? "s" : ""} on the ground floor left`;
  // 外観・間取り図の両方の冒頭に入れる共通の建築仕様（階数と駐車台数を両者で一致させる）
  const spec = `${storyCount}-story, ${roof}, white stucco exterior, ${parking}`;

  const resilience =
    (cold ? ", highly insulated envelope" : "") + (flood ? ", raised floor level, elevated entrance" : "");

  // 階数と駐車台数は両プロンプトで言い換えて再指定し、外観と間取り図が食い違わないようにする
  const exteriorParking =
    carCount <= 0
      ? "no garage and no parked car anywhere on the site"
      : `exactly ${carCount} car${carCount > 1 ? "s" : ""} parked in the garage on the ground floor left`;
  const planParking =
    carCount <= 0
      ? "no garage and no car bay in the plan"
      : `ground floor plan includes a garage with exactly ${carCount} car bay${carCount > 1 ? "s" : ""} on the left`;

  // Stage1 と同じ順序（間取り → 外観）で、まず間取りの設計内容を文章化しておく
  const plan =
    `${storyCount}-story detached house. ` +
    `${carCount <= 0 ? "No parking: no garage, carport or parking pad on the site." : `Parking for exactly ${carCount} car${carCount > 1 ? "s" : ""} in a ${flood ? "piloti" : "built-in"} garage on the ground floor left.`} ` +
    `Ground floor: entrance, LDK with kitchen and water rooms; upper floor${storyCount > 2 ? "s" : ""}: bedrooms.`;

  return {
    plan,
    spec,
    exterior:
      `${spec}, photorealistic architectural photograph of a modern Japanese detached house in ` +
      `${area.municipality}, ${area.prefecture}, Japan, exactly ${storyCount} stories, ${exteriorParking}` +
      `${resilience}${wishes}, surrounding local streetscape, daylight, high-quality photography, 16:9 landscape`,
    floorPlan:
      `${spec}, 2D top-down architectural floor plan of the same modern Japanese detached house, ` +
      `exactly ${storyCount} stories, ${planParking}${wishes}, orthographic projection, ` +
      `clean black line drawing on white background, room partitions, furniture layout, ` +
      `dimension lines, no text labels, blueprint style, high resolution`,
  };
}

/** 共通の建築仕様がプロンプト冒頭に無ければ強制的に前置きする */
function withSpecPrefix(spec: string, prompt: string): string {
  if (!spec) return prompt;
  return prompt.toLowerCase().startsWith(spec.toLowerCase()) ? prompt : `${spec}, ${prompt}`;
}

/**
 * JSON テキスト（```json フェンス付きも可）から共通仕様と2つのプロンプトを抽出する。
 * モデルが spec の前置きを忘れても、ここで両プロンプトの冒頭に必ず入れ直すため、
 * 外観と間取り図が別の家になることを防げる。
 */
function parseHousePrompts(text: string): HouseImagePrompts | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<HouseImagePrompts>;
    if (typeof parsed.exterior === "string" && typeof parsed.floorPlan === "string") {
      const plan = typeof parsed.plan === "string" ? parsed.plan.trim() : "";
      const spec = typeof parsed.spec === "string" ? parsed.spec.trim().replace(/[,、\s]+$/, "") : "";
      const exterior = withSpecPrefix(spec, parsed.exterior.trim());
      const floorPlan = withSpecPrefix(spec, parsed.floorPlan.trim());
      if (exterior && floorPlan) return { plan, spec, exterior, floorPlan };
    }
  } catch {
    /* JSON でなければフォールバックに委ねる */
  }
  return null;
}

/**
 * Stage1: エリア実データ + ユーザーのこだわりタグから、gemini-3.6-flash に
 * 「①間取り設計 → ②共通仕様(spec) → ③間取り図プロンプト → ④外観プロンプト」の
 * 順で推論させ、外観・間取り図それぞれの英語プロンプトを生成する。
 * 外観は間取り設計を絶対基準に組み立てさせるため、階数と駐車台数が食い違いにくい。
 */
async function generateHousePrompts(
  area: HouseAreaData,
  tags: string[],
): Promise<HouseImagePrompts> {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    systemInstruction: HOUSE_PROMPT_SYSTEM_INSTRUCTION,
  });

  const userMessage =
    `## A. Environmental data (Japanese, authoritative)\n${buildAreaBriefing(area)}\n\n` +
    `## B. User wishes (Japanese, authoritative for style/rooms)\n` +
    (tags.length > 0 ? tags.map((t) => `- ${t}`).join("\n") : "- (no specific wishes)");

  const result = await model.generateContent(userMessage);
  const parsed = parseHousePrompts(result.response.text());
  if (!parsed) throw new Error("Prompt generator returned unparsable output");
  return parsed;
}

/** 画像1枚を primary → fallback モデルの順で生成する */
async function generateImageWithFallback(prompt: string, label: string): Promise<GeneratedImage> {
  for (const modelId of [PRIMARY_IMAGE_MODEL, FALLBACK_IMAGE_MODEL]) {
    try {
      const result = await generateViaGeminiImage(modelId, prompt);
      console.log(`[HouseGen] ${label}: ${modelId} 完了 (${result.mimeType})`);
      return result;
    } catch (err) {
      console.warn(
        `[HouseGen] ${label}: ${modelId} 失敗: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  throw new Error(`[HouseGen] ${label} の画像生成に全モデルが失敗しました`);
}

/**
 * エリアの実データとユーザーのこだわりタグから「外観」「間取り図」の2枚を生成する。
 * Stage1: gemini-3.6-flash が間取りを先に設計してから2種類の英語プロンプトを生成
 *         （失敗時は静的フォールバック）
 * Stage2: gemini-3.1-flash-image → gemini-2.5-flash-image で各画像を生成
 */
export async function generateHouseImages(
  area: HouseAreaData,
  tags: string[],
): Promise<GeneratedHouseImages> {
  if (!config.gemini.apiKey) {
    throw new Error("[HouseGen] APIキー未設定");
  }

  console.log(
    `[HouseGen] 生成開始: ${area.prefecture}${area.municipality} / tags=[${tags.join(", ")}]`,
  );

  let prompts: HouseImagePrompts;
  try {
    prompts = await generateHousePrompts(area, tags);
    console.log(
      `[HouseGen] プロンプト生成完了\n  plan: ${prompts.plan}\n  spec: ${prompts.spec}\n  floorPlan: ${prompts.floorPlan}\n  exterior: ${prompts.exterior}`,
    );
  } catch (promptErr) {
    console.warn(
      `[HouseGen] プロンプト生成失敗、フォールバック使用: ${promptErr instanceof Error ? promptErr.message : promptErr}`,
    );
    prompts = buildFallbackHousePrompts(area, tags);
  }

  const [exterior, floorPlan] = await Promise.all([
    generateImageWithFallback(prompts.exterior, "exterior"),
    generateImageWithFallback(prompts.floorPlan, "floorPlan"),
  ]);

  return { exterior, floorPlan, prompts };
}
