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
  /**
   * 「なぜこの間取り・外観になったのか」を、エリアの環境データとユーザーのタグを
   * 結びつけて説明する日本語テキスト（200〜300文字程度）。UI にそのまま表示する。
   */
  conceptExplanation: string;
}

export interface GeneratedHouseImages {
  exterior: GeneratedImage;
  floorPlan: GeneratedImage;
  prompts: HouseImagePrompts;
  /** 設計コンセプト（日本語）。prompts.conceptExplanation と同じ内容を UI 用に平置きする */
  conceptExplanation: string;
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
     WATER ROOMS — a real Japanese house of about 60-80 m2 total floor area: there is EXACTLY ONE main bathroom
     (浴室 / bathing unit) in the WHOLE house, normally grouped with the washroom on 1F or on 2F, never one per
     floor. A second WC (toilet only, no bathtub) on another floor is allowed and is the only permitted extra.
     Never draw a bathtub on more than one floor; duplicated bathrooms are a design error.
  d. THE PER-FLOOR FOOTPRINT, floor by floor, in metres, including how it SHRINKS as it goes up.
     - Start from a Japanese urban house aspect ratio: frontage (street side) roughly 6 m and depth roughly 10 m
       (anything from a square up to about 1:1.8 frontage-to-depth is fine). NEVER design an extreme, unnaturally
       long and narrow "eel bed" box (e.g. 3 m x 15 m); that is a failure.
     - Give each floor its own width x depth, e.g. "1F 6m x 10m, 2F 6m x 10m, 3F 6m x 7m set back 3m on the
       street side with a balcony on the setback roof".
     - Decide the setbacks from the rules in (A) (the diagonal-line / 斜線制限 and setback habits of the district,
       the floor-area-ratio and building-coverage-ratio). An upper floor that is smaller than the one below MUST
       say by how much and on which side; a floor that is identical to the one below must say so explicitly.
  f. THE STAIRCASE POSITION, named with the same viewer-facing vocabulary as step 1e
     (e.g. "straight-run staircase at Center-Left, against the party wall, same position on every floor").
     - The house has ONE vertical circulation core. Its footprint sits at the SAME position, at the same
       left/right and front/back place in the plan, on EVERY floor from 1F to the top floor.
     - Every floor above 1F is reached by that staircase; the plan must show it arriving on each upper floor.
  e. THE FACADE LAYOUT, left to right AS SEEN BY A VIEWER STANDING IN THE STREET FACING THE FRONT OF THE HOUSE.
     Assign every street-facing element to exactly one of three slots — LEFT, CENTER, RIGHT — and never leave one vague:
       - the garage / carport / parking pad opening (omit only when capacity is 0)
       - the front entrance door
       - the main large window(s) of the living space
     Example: "facade left to right: garage opening on the LEFT, entrance door in the CENTER, large living room
     window on the RIGHT". Use this viewer-facing convention for both images so they cannot come out mirrored.
Write this design out in "plan": 3-6 short English sentences that state the story count, the exact car capacity
and position, the per-floor footprint in metres with its setbacks (step 1d), the single bathroom's floor (step 1c),
the staircase position repeated on every floor (step 1f), the room layout per floor, AND the facade left/right
layout of step 1e. This is your single source of truth for BOTH images.

### ABSOLUTE CONSTRAINT — vertical circulation
The staircase is at ONE position and that position is IDENTICAL on every floor, 1F to the top floor. A floor drawn
without the staircase arriving on it, a staircase that moves to another part of the plan between floors, or any
floor that cannot be reached on foot, is a SEVERE ERROR and the design must be redone before you write the prompts.
Both the floor plan prompt and the exterior prompt must be written from that single stair core.

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
  capacity you fixed (e.g. "1F plan includes a garage with exactly 2 car bays on the left"; with 0 cars,
  "no garage and no car bay anywhere in the plan").
- It restates the step-1e facade layout with the SAME left/right sides, as seen from the street, so the plan is
  drawn with the street-facing facade at the bottom of the sheet and is not mirrored
  (e.g. "street-facing facade at the bottom of the drawing, garage on the left, entrance in the center,
  living room window on the right, as seen from the street").
- STAIRS: it names the staircase and its step-1f position, and says it is repeated identically on every floor
  (e.g. "straight-run staircase drawn at Center-Left in exactly the same position on 1F, 2F and 3F, every upper
  floor reached by that staircase").
- BATHROOM: it states the single bathroom and the floor it is on, and forbids the others
  (e.g. "exactly one bathroom with a bathtub, on 2F only, no bathtub on any other floor; separate WC on 1F").
- PER-FLOOR SIZE: it gives each floor's width x depth from step 1d and says the upper floors are DRAWN SMALLER
  where they are set back (e.g. "1F and 2F drawn 6m x 10m, 3F drawn smaller at 6m x 7m, set back 3m on the street
  side with a balcony over the setback").
- PROPORTIONS: it states the Japanese urban house proportions from step 1d (e.g. "about 6m frontage by 10m depth,
  natural Japanese urban house proportions, not an extremely long narrow plan").
- FLOOR LABELS — MANDATORY: the plan is labelled with the Japanese standard notation ONLY: "1F", "2F", "3F".
  NEVER use "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "G/F", "1st floor", "LEVEL 1" or any other wording
  for the floors. Write the constraint into the prompt itself, e.g.
  "floor labels written strictly as 1F and 2F only, never GROUND FLOOR or FIRST FLOOR, no other text labels".

## STEP 4: write the "exterior" prompt LAST, using the floor plan as the absolute reference
- It begins with the SAME EXACT spec string, character for character, followed by ", ".
- Read back the plan you just wrote and describe the outside of THAT building: the same number of stories,
  the same footprint and massing, the garage opening on the same side, and exactly the same number of parking
  spaces (e.g. "exactly 2 cars parked in the built-in garage on the ground floor left"; with 0 cars, "no garage,
  no carport and no parked car anywhere on the site").
- It repeats the step-1e facade layout verbatim in the same left/right terms, explicitly as seen by a viewer
  facing the house from the street (e.g. "front elevation seen from the street, garage opening on the LEFT,
  entrance door in the CENTER, large living room window on the RIGHT, not mirrored").
- MASSING: it describes the SAME per-floor footprints and setbacks as step 1d, so the photograph shows the upper
  floor visibly smaller where the plan draws it smaller (e.g. "third floor set back 3m from the street facade
  with a roof balcony over the second floor, first and second floors flush at the same width").
  A facade shown as one flush box while the plan sets an upper floor back is a contradiction.
- PROPORTIONS: it states the same Japanese urban house proportions (about 6m frontage, 10m depth), so the volume
  does not come out as an unnaturally long, narrow bar.
- ABSOLUTE CONSTRAINT: the exterior image and the floor plan must NEVER contradict each other on the number of
  parking spaces, the number of stories, the LEFT/RIGHT position of the garage, the entrance and the main
  windows, the per-floor footprint and its setbacks, or the staircase position.
  If the plan says 2 cars, the exterior shows exactly 2 — not 1, not 3. If the plan says 3-story, both
  the photograph and the plan show exactly 3 stories. If the plan puts the garage on the LEFT, it is on the left
  in BOTH images — a mirrored facade is a failure. If the plan sets the top floor back, the photograph shows that
  step in the massing. Before you output, run this checklist against the plan and rewrite the prompts if any line
  fails:
    1. story count identical in plan, floorPlan prompt and exterior prompt;
    2. car count identical in all three;
    3. every LEFT / CENTER / RIGHT assignment identical in all three;
    4. each floor's width x depth and every setback identical in all three;
    5. the staircase named at one and the same position on every floor;
    6. exactly one bathtub in the whole house.

## STEP 5: write "conceptExplanation" — the design rationale, IN JAPANESE
- 200-300 Japanese characters, plain polite Japanese (です・ます調), no markdown, no bullet points, no English headings.
- Explain WHY this plan and this exterior were chosen, by tying the environmental data in (A) — flood or landslide
  risk, winter/summer temperature, sunshine hours, floor-area-ratio and building-coverage-ratio, use-district,
  the nearest station, the typical lot size — to the user's wishes in (B) (e.g. "駐車場2台", "平屋").
- Name the concrete decisions you made and the reason for each: the story count, where the living space sits,
  the parking capacity and position, the facade layout, the roof and the openings.
  e.g. 「このエリアは浸水リスクがあるため、主要な居住空間を2階に配置し、1階は駐車スペースとして…」
- Only use facts present in (A) and (B). Never invent numbers that were not given.

Output rules:
- Output ONLY a JSON object, with the keys in this exact order:
  {"plan": "...", "spec": "...", "floorPlan": "...", "exterior": "...", "conceptExplanation": "..."}
  — no markdown fence, no commentary.
- "spec" holds the step-2 string alone. "floorPlan" and "exterior" each start with that same string.
- Each prompt is comma-separated English keywords / short phrases. "conceptExplanation" is Japanese prose.

Design rules (blend A and B without contradiction):
- The environmental data is authoritative for climate, disaster resilience and building regulations. The user's wishes are authoritative for style, rooms and amenities.
- When a wish conflicts with the environment, DO NOT drop it — adapt it so both hold (e.g. "large windows" in a heavy-snow region -> large triple-glazed insulated windows with snow-shedding eaves; "open terrace" in a flood-risk area -> elevated terrace above the raised ground floor).
- A wish about stories, rooms, parking, roof or wall colour must be resolved in the step-1 plan itself, not only in one of the prompts. A wish like "駐車場2台" (parking for 2 cars) or "平屋" (single-story) fixes that exact number in the plan.
- Cold / heavy-snow area (low winter temperature) -> steep or snow-shedding roof, insulated envelope, carport or snow-melting approach.
- Hot / high-sunshine area -> deep eaves, shading louvers, cross ventilation, heat-reflective roof.
- Flood risk -> raised floor level / piloti parking / elevated entrance. Landslide risk -> reinforced retaining wall, solid foundation.
- Floor-area-ratio and building-coverage-ratio decide the massing: low ratios -> compact 2-story house with garden setback; high ratios -> narrow 3-story urban house with minimal setback.
- Use-district (用途地域) decides the surroundings: residential districts -> quiet low-rise neighbourhood; commercial districts -> dense urban street.

Architectural sanity rules (a plan that breaks one of these is not buildable — redo it):
- One staircase core, in the same place on every floor; no floor without stair access.
- Exactly one bathroom with a bathtub in the whole house (about 60-80 m2 total floor area); extra toilets are fine, extra bathrooms are not.
- Stack the floors honestly: an upper floor is the same size as the one below or smaller, never larger, and every size change is a setback you can point to in both images.
- Keep Japanese urban house proportions (about 6m frontage x 10m depth, up to roughly 1:1.8); never an extreme narrow bar.
- Water rooms and the kitchen share plumbing walls; do not scatter them to opposite corners on different floors.

Prompt content rules:
- floorPlan: <spec>, 2D top-down architectural floor plan of that house, orthographic, clean black line drawing on white, room partitions per the plan, one staircase in the same position on every floor, exactly one bathroom in the whole house, each floor at its own width x depth with the setbacks drawn, furniture layout, dimension lines, floor labels strictly as 1F / 2F / 3F (never GROUND FLOOR, never FIRST FLOOR), no other text labels and never Japanese characters, street-facing facade at the bottom of the sheet, blueprint style, high resolution.
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
      : `exactly ${carCount} car${carCount > 1 ? "s" : ""} parked in the garage on the left of the facade`;
  const planParking =
    carCount <= 0
      ? "no garage and no car bay in the plan"
      : `1F plan includes a garage with exactly ${carCount} car bay${carCount > 1 ? "s" : ""} on the left`;

  // 正面から見た左右配置。左右が反転しないよう、両プロンプトで同じ言い回しを使う
  const facade =
    carCount <= 0
      ? "front elevation seen from the street, entrance door on the LEFT, large living room window on the RIGHT, not mirrored"
      : "front elevation seen from the street, garage opening on the LEFT, entrance door in the CENTER, large living room window on the RIGHT, not mirrored";
  // 間取り図で使わせない階数表記（日本式の 1F/2F/3F に統一する）
  const floorNames = Array.from({ length: storyCount }, (_, i) => `${i + 1}F`);
  const floorLabels = `floor labels written strictly as ${floorNames.join(" and ")} only, never GROUND FLOOR or FIRST FLOOR`;

  // 日本の都市型住宅のアスペクト比（間口6m × 奥行き10m）を基準にし、
  // 3階建て以上は最上階を道路側にセットバックさせる（斜線制限を想定）
  const FRONTAGE_M = 6;
  const DEPTH_M = 10;
  const SETBACK_M = 3;
  const hasSetback = storyCount >= 3;
  const topFloor = `${storyCount}F`;
  const footprints = hasSetback
    ? `${floorNames.slice(0, -1).join(" and ")} at ${FRONTAGE_M}m x ${DEPTH_M}m, ${topFloor} drawn smaller at ` +
      `${FRONTAGE_M}m x ${DEPTH_M - SETBACK_M}m, set back ${SETBACK_M}m on the street side with a balcony over the setback`
    : `every floor at ${FRONTAGE_M}m x ${DEPTH_M}m, no setback between floors`;
  const proportions = `about ${FRONTAGE_M}m frontage by ${DEPTH_M}m depth, natural Japanese urban house proportions, not an extremely long narrow plan`;

  // 垂直動線は1系統のみ。全階で同じ位置に置き、上階へ必ず到達できるようにする
  const stairs =
    storyCount > 1
      ? `single straight-run staircase at Center-Left in exactly the same position on ${floorNames.join(", ")}, every upper floor reached by that staircase`
      : "single-story house, no staircase";
  // 浴室は家全体で1つだけ（60〜80㎡の標準的な日本の住宅を想定）
  const bathFloor = storyCount > 1 ? "2F" : "1F";
  const bathroom =
    `exactly one bathroom with a bathtub in the whole house, on ${bathFloor} only, no bathtub on any other floor` +
    (storyCount > 1 ? ", separate WC on 1F" : "");

  // Stage1 と同じ順序（間取り → 外観）で、まず間取りの設計内容を文章化しておく
  const plan =
    `${storyCount}-story detached house, ${proportions}. ` +
    `Per-floor footprint: ${footprints}. ` +
    `${carCount <= 0 ? "No parking: no garage, carport or parking pad on the site." : `Parking for exactly ${carCount} car${carCount > 1 ? "s" : ""} in a ${flood ? "piloti" : "built-in"} garage on the left of the facade.`} ` +
    `${storyCount === 1 ? "1F: entrance, LDK with kitchen, water rooms and bedrooms" : `1F: entrance, LDK with kitchen and water rooms; upper floor${storyCount > 2 ? "s" : ""}: bedrooms`}. ` +
    `${stairs}. ${bathroom}. ` +
    `Facade left to right as seen from the street: ${carCount <= 0 ? "entrance on the left, living room window on the right" : "garage on the left, entrance in the center, living room window on the right"}.`;

  return {
    plan,
    spec,
    exterior:
      `${spec}, photorealistic architectural photograph of a modern Japanese detached house in ` +
      `${area.municipality}, ${area.prefecture}, Japan, exactly ${storyCount} ${storyCount === 1 ? "story" : "stories"}, ${exteriorParking}, ${facade}, ` +
      `${hasSetback ? `${topFloor} set back ${SETBACK_M}m from the street facade with a roof balcony over the floor below, lower floors flush at the same width` : "all floors flush at the same width, no setback"}, ` +
      `${proportions}${resilience}${wishes}, surrounding local streetscape, daylight, high-quality photography, 16:9 landscape`,
    floorPlan:
      `${spec}, 2D top-down architectural floor plan of the same modern Japanese detached house, ` +
      `exactly ${storyCount} ${storyCount === 1 ? "story" : "stories"}, ${planParking}${wishes}, street-facing facade at the bottom of the sheet ` +
      `with the garage on the left as seen from the street, ${footprints}, ${proportions}, ${stairs}, ${bathroom}, ` +
      `orthographic projection, clean black line drawing on white background, room partitions, furniture layout, ` +
      `dimension lines, ${floorLabels}, no other text labels, blueprint style, high resolution`,
    conceptExplanation: buildFallbackConcept(area, tags, { storyCount, carCount, cold, flood }),
  };
}

/**
 * Stage1 が落ちたときの設計コンセプト文（日本語）。
 * エリアの実データとタグから、階数・駐車・耐候の判断理由を組み立てる。
 */
function buildFallbackConcept(
  area: HouseAreaData,
  tags: string[],
  d: { storyCount: number; carCount: number; cold: boolean; flood: boolean },
): string {
  const place = `${area.prefecture}${area.municipality}${area.district ? area.district : ""}`;
  const parts: string[] = [
    `${place}の環境データをもとに、${d.storyCount === 1 ? "平屋" : `${d.storyCount}階建て`}の住まいとして設計しました。`,
  ];

  if (d.flood) {
    parts.push(
      "このエリアは浸水リスクが確認されているため、床レベルを上げて玄関を高い位置に設け、主要な居住空間を上階に配置しています。",
    );
  } else if (area.zoning?.floorAreaRatio) {
    parts.push(
      `容積率${area.zoning.floorAreaRatio}・用途地域「${area.zoning.useArea ?? "不明"}」の条件に合わせ、敷地を無理なく使える規模にまとめています。`,
    );
  }

  if (d.cold) {
    parts.push("冬の冷え込みが厳しい気候に備え、雪が落ちやすい屋根形状と高断熱の外皮を前提にしました。");
  } else if (area.weather?.annualSunshineHours != null) {
    parts.push(
      `年間日照時間が${Math.round(area.weather.annualSunshineHours)}時間の地域特性を活かし、主要な窓を正面右側にまとめて採光を確保しています。`,
    );
  }

  parts.push(
    d.carCount > 0
      ? `ご指定の条件をふまえ、駐車${d.carCount}台分を正面左側に確保し、玄関との動線を短くしました。`
      : "駐車スペースは設けず、その分を庭と居住空間に充てています。",
  );

  if (tags.length > 0) {
    parts.push(`ご希望の「${tags.slice(0, 3).join("・")}」も間取りに反映しています。`);
  }

  return parts.join("");
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
      const conceptExplanation =
        typeof parsed.conceptExplanation === "string" ? parsed.conceptExplanation.trim() : "";
      const exterior = withSpecPrefix(spec, parsed.exterior.trim());
      const floorPlan = withSpecPrefix(spec, parsed.floorPlan.trim());
      if (exterior && floorPlan) return { plan, spec, exterior, floorPlan, conceptExplanation };
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
      `[HouseGen] プロンプト生成完了\n  plan: ${prompts.plan}\n  spec: ${prompts.spec}\n  floorPlan: ${prompts.floorPlan}\n  exterior: ${prompts.exterior}\n  concept: ${prompts.conceptExplanation}`,
    );
  } catch (promptErr) {
    console.warn(
      `[HouseGen] プロンプト生成失敗、フォールバック使用: ${promptErr instanceof Error ? promptErr.message : promptErr}`,
    );
    prompts = buildFallbackHousePrompts(area, tags);
  }

  // Stage1 がコンセプト文を返さなかった場合も UI が空にならないよう静的文面で補う
  if (!prompts.conceptExplanation) {
    prompts = {
      ...prompts,
      conceptExplanation: buildFallbackHousePrompts(area, tags).conceptExplanation,
    };
  }

  const [exterior, floorPlan] = await Promise.all([
    generateImageWithFallback(prompts.exterior, "exterior"),
    generateImageWithFallback(prompts.floorPlan, "floorPlan"),
  ]);

  return { exterior, floorPlan, prompts, conceptExplanation: prompts.conceptExplanation };
}
