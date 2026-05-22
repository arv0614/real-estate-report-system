#!/usr/bin/env node
/**
 * generate_daily_blog.js — Gemini API で日本語の不動産ブログ記事を1件生成し、
 * 英語(en) / 繁体字(zh-TW) / 簡体字(zh-CN) に翻訳して frontend/content/blog/ に
 * `YYYY-MM-DD-<slug>.{lang}.md` 形式で保存する (lang は 空 / en / zh-TW / zh-CN)。
 *
 * 設計メモ:
 *   メタデータ (JSON) と本文 Markdown は別々の API 呼び出しで生成する。
 *   本文を JSON 文字列に詰め込むと制御文字エスケープが破綻しがちで、
 *   実際に動かして JSON.parse 失敗を確認したため分離した。
 *
 * 必須環境変数:
 *   GEMINI_API_KEY      — Gemini API キー
 *
 * 任意環境変数:
 *   GEMINI_MODEL        — 既定: gemini-2.5-pro
 *   BLOG_DATE           — 上書き YYYY-MM-DD (既定: JST の本日)
 *   BLOG_DRY_RUN        — "1" の場合 API を呼ばず構成のみ確認
 *   BLOG_API_BASE_URL   — 実データ取得用バックエンド URL
 *                          既定: https://realestate-api-2hctlfcy6a-an.a.run.app
 *   BLOG_SITE_BASE_URL  — 末尾CTAリンクの本番トップページ URL
 *                          既定: https://mekiki-research.com
 *   GCP_PROJECT_ID / FIREBASE_PROJECT_ID — Firestore への X 投稿テンプレート
 *                          書き込みを有効化するための GCP プロジェクト ID。
 *                          未設定 / Admin SDK 初期化失敗時は Firestore 書き込みを
 *                          スキップしてブログ生成自体は成功させる。
 */

const fs = require("fs");
const path = require("path");

const BLOG_DIR = path.resolve(__dirname, "../frontend/content/blog");
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const DRY_RUN = process.env.BLOG_DRY_RUN === "1";

// 実データ取得先: 既定は Cloud Run の本番バックエンド。
// BLOG_API_BASE_URL で上書き可能（ステージング検証や mekiki-research.com 経由の API ルート増設時など）。
const API_BASE_URL = (process.env.BLOG_API_BASE_URL || "https://realestate-api-2hctlfcy6a-an.a.run.app").replace(/\/$/, "");
const SITE_BASE_URL = (process.env.BLOG_SITE_BASE_URL || "https://mekiki-research.com").replace(/\/$/, "");

// ─── 地域分散プール ──────────────────────────────────────────────────────────
// 首都圏に偏らない記事生成のため、毎回 weighted random で1地域を選びメタプロンプトに渡す。
// 首都圏は最低頻度に抑え、関西・中京・地方中核都市・注目地方エリアを意図的にローテーション。
const REGION_POOL = [
  { name: "関西エリア", examples: "大阪市梅田・なんば、京都市四条河原町・京都駅周辺、神戸市三宮・元町、奈良市、大津市、和歌山市、姫路市、堺市、東大阪市など", weight: 3 },
  { name: "中京エリア", examples: "名古屋市栄・名駅、岐阜市、四日市市、津市、豊田市、岡崎市、一宮市、刈谷市、桑名市など", weight: 2 },
  { name: "北海道・東北", examples: "札幌市大通・すすきの、仙台市青葉区、盛岡市、秋田市、山形市、福島市、青森市、函館市、八戸市、いわき市など", weight: 2 },
  { name: "中国・四国", examples: "広島市紙屋町・八丁堀、岡山市、高松市、松山市、高知市、松江市、鳥取市、徳島市、福山市、下関市など", weight: 2 },
  { name: "九州・沖縄", examples: "福岡市天神・博多、北九州市、熊本市、鹿児島市、大分市、長崎市、宮崎市、佐賀市、那覇市、久留米市など", weight: 2 },
  { name: "北陸・甲信越", examples: "新潟市、金沢市、富山市、長野市、松本市、甲府市、福井市、上越市、長岡市、諏訪市など", weight: 2 },
  { name: "注目地方エリア", examples: "ニセコ町、軽井沢町、倉敷市美観地区、別府市、北谷町、富良野市、伊豆高原、白馬村、宮古島市、屋久島町、湯布院、葉山町、熱海市など", weight: 1 },
  { name: "首都圏（最低頻度）", examples: "東京23区内の特定エリア（湾岸・城東・城北・多摩地域など）、横浜市、川崎市、千葉市、さいたま市、つくば市など。ただし渋谷・新宿・銀座など過去頻出エリアは避けること", weight: 1 },
];

function pickRegion() {
  const total = REGION_POOL.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const r of REGION_POOL) {
    n -= r.weight;
    if (n <= 0) return r;
  }
  return REGION_POOL[0];
}

if (!DRY_RUN && !process.env.GEMINI_API_KEY) {
  console.error("[ERROR] 必須環境変数 GEMINI_API_KEY が未設定です");
  process.exit(1);
}

function jstToday() {
  if (process.env.BLOG_DATE) return process.env.BLOG_DATE;
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60_000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function existingSlugs() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const slugs = new Set();
  for (const f of fs.readdirSync(BLOG_DIR)) {
    if (!f.endsWith(".md")) continue;
    const base = f.replace(/\.(en|zh-CN|zh-TW)\.md$/, "").replace(/\.md$/, "");
    slugs.add(base);
  }
  return Array.from(slugs).sort().reverse();
}

function buildFrontmatter({ title, description, publishedAt, tags, primaryLocation }) {
  const escape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const tagLine = (tags || []).map((t) => `"${escape(t)}"`).join(", ");
  return [
    "---",
    `title: "${escape(title)}"`,
    `description: "${escape(description)}"`,
    `publishedAt: "${publishedAt}"`,
    `tags: [${tagLine}]`,
    "primaryLocation:",
    `  lat: ${Number(primaryLocation.lat)}`,
    `  lng: ${Number(primaryLocation.lng)}`,
    `  name: "${escape(primaryLocation.name)}"`,
    "---",
    "",
  ].join("\n");
}

function sanitizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function parseJson(text) {
  let cleaned = String(text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return JSON.parse(cleaned);
}

function stripFences(text) {
  let cleaned = String(text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return cleaned;
}

// ─── Gemini 呼び出しラッパー ───────────────────────────────────────────────────
async function callJson(ai, prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.8,
    },
  });
  const text = response?.text;
  if (!text) throw new Error("Gemini からの応答が空でした (JSON)");
  return parseJson(text);
}

async function callText(ai, prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.85 },
  });
  const text = response?.text;
  if (!text) throw new Error("Gemini からの応答が空でした (text)");
  return stripFences(text);
}

// ─── プロンプト ───────────────────────────────────────────────────────────────
function jaMetaPrompt({ today, recentSlugs, region }) {
  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストで、B2B SaaS「物件目利きリサーチ」(https://mekiki-research.com) のオウンドメディアを執筆しています。
本日 ${today} 付の不動産ブログ記事1件のメタデータを日本語で生成してください。

# テーマ要件
- 日本の不動産 (相場、再開発、ハザード、人口動態、地価、投資、住宅市場、政策動向 など)
- 地名や政策名を具体的に絞った切り口にすること
- 過去の slug と重複させない: ${recentSlugs.slice(0, 30).join(", ") || "(なし)"}

# 地域選定（最重要・絶対厳守）
- 本記事は **「${region.name}」** に必ずフォーカスすること。他地域に逸脱しない。
- 候補エリア例: ${region.examples}
- **首都圏（東京23区中心部・横浜駅周辺など）に偏ってはいけない。** 全国の多様な都市・エリアをローテーションする方針のため、上記の指定地域を厳守すること。
- 上記候補のうち、過去 slug と重複しない都市・地区を意図的に1つ選ぶこと。
- primaryLocation.lat / lng は選定した具体的な地点（駅・交差点・著名スポット等）の **正確な実在座標** を出力すること。架空の座標や近似しすぎる丸めは禁止。
- primaryLocation.name は具体的な日本語地名（例: 「博多駅」「金沢駅」「ニセコ町ヒラフ」）を出力すること。

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "slug": "lowercase-hyphenated-kebab (英数字とハイフンのみ、40字以内、地名+テーマ)",
  "title": "60〜80文字、SEOを意識し具体的な数字や年号・地名を含む",
  "description": "メタディスクリプション 140〜180文字、結論を端的に",
  "tags": ["タグ1", "タグ2", "..."],
  "primaryLocation": { "lat": 0.0, "lng": 0.0, "name": "選定した具体的地名" },
  "outline": ["## 1. ...", "## 2. ...", "...", "## 8. まとめ"]
}`;
}

function jaBodyPrompt({ today, meta, areaData }) {
  const lat = Number(meta.primaryLocation?.lat);
  const lng = Number(meta.primaryLocation?.lng);
  const locName = meta.primaryLocation?.name || "対象エリア";
  const ctaUrl = `${SITE_BASE_URL}/?lat=${lat}&lng=${lng}`;

  const evidenceBlock = areaData
    ? `
# 実取得データ（エビデンス・必ず本文中で複数箇所引用すること）
以下は、本日「物件目利きリサーチ」のトップページ ${SITE_BASE_URL}/?lat=${lat}&lng=${lng} で実際に lat=${lat}, lng=${lng} を検索した際にバックエンド (Cloud Run / MLIT 国交省 API + 国土地理院ハザード) から取得された **実データ** です。

\`\`\`json
${JSON.stringify(areaData, null, 2)}
\`\`\`

## 本文への引用ルール（厳守）
- 上記実データの数値・固有名詞を **複数セクションで具体的に引用** すること（取引件数、平均/中央値の取引価格、平均単価、対象期間、用途地域、容積率/建蔽率、最寄駅、駅乗降客数、医療機関数、学区、洪水深ランク、土砂災害現象 など）。
- 推測や一般論ではなく、**この実データを「裏付け」として明示的に引用しながら** 専門的・説得的に分析すること。
- 取引価格は \`tradePrice\`（円）から「○,○○○万円」形式に変換（四捨五入）。例: 45,320,000 → 約4,500万円。
- 単価は \`unitPrice\`（円/㎡）から「○○万円/㎡」形式に変換。例: 612,300 → 約61万円/㎡。
- ハザード情報がリスクありの場合、購入前に必ず確認すべき点として読者に注意喚起する文脈で引用すること。
- データ件数が少ない/0件の場合や、特定フィールドが null の場合は、その事実自体を率直に記述（「公開取引データが薄いエリアであり、近隣相場との比較が不可欠」等）し、決して捏造しないこと。
`
    : `
# 実取得データ
今回はバックエンドAPIからの実データ取得に失敗したため、一般公開情報・国交省統計・地価公示の傾向に基づいて執筆してください。
特定の取引価格や駅乗降客数など具体的な数値を断定的に提示することは避け、「○○程度と見られる」「公示地価は…の傾向」など、出典の確実性に応じた表現を用いること。
`;

  return `あなたは日本の不動産市場に精通したベテラン不動産アナリストです。「物件目利きリサーチ」(${SITE_BASE_URL}) のオウンドメディア向けに、本日 ${today} 付の以下の記事の本文を Markdown で執筆してください。
${evidenceBlock}
# 記事メタデータ
- タイトル: ${meta.title}
- description: ${meta.description}
- 主要地点: ${locName}（lat=${lat}, lng=${lng}）
- 想定アウトライン: ${(meta.outline || []).join(" / ")}

# 執筆指針
- 構成: Markdown 見出し \`## 1. 〜 ## 8. まとめ\` (合計8セクション程度) を使う
- 表 (\`| ~ |\`) と箇条書きを適宜活用し、上記実データの数値を表で整理する箇所を最低1つ含めること
- 本文文字数: **必ず 4,500〜6,000 文字** に収めること (これより長くしない)
- トーン: 専門的で分析的、ただし読みやすい解説調
- 記事冒頭にリード段落を 2〜3 段落入れる (h1 や frontmatter は出力しない、いきなり Markdown 本文から)

# 末尾CTA（厳守）
- 記事最終セクション（## 8. まとめ）の末尾に、以下の Markdown リンクを **改変せず** 必ず挿入すること:
  \`[${locName}周辺の不動産データを物件目利きリサーチで実際に調べる →](${ctaUrl})\`
- このリンクの URL（クエリ \`?lat=${lat}&lng=${lng}\` を含む）は省略・改変・分割しないこと。
- ベータ版（/research）など他のパスへのリンクは禁止。本番トップページ + 位置情報クエリのみを使用する。

# 出力 (厳守)
- frontmatter (\`---\` で囲まれた領域) は付けない
- コードフェンス (\`\`\`) で全体を囲まない
- いきなり本文 Markdown から始める`;
}

function transMetaPrompt({ lang, jaMeta }) {
  const langLabel = {
    en: "English (en)",
    "zh-TW": "Traditional Chinese (zh-TW, 台湾繁体)",
    "zh-CN": "Simplified Chinese (zh-CN, 中国大陆简体)",
  }[lang];
  return `あなたはプロの翻訳者です。以下の日本語不動産記事のメタデータを ${langLabel} に翻訳してください。

# 翻訳指針
- 日本の固有名詞 (地名・駅名・企業名・政策名) は対象言語の慣用表記に置き換え、必要なら ( ) 内に英字または日本語原文を併記
- ターゲット言語のネイティブが読んで自然になるようリライト

# 入力 (日本語)
${JSON.stringify(
  {
    title: jaMeta.title,
    description: jaMeta.description,
    tags: jaMeta.tags,
    primaryLocation: jaMeta.primaryLocation,
  },
  null,
  2,
)}

# 出力 (厳守: JSON のみ、コードフェンスや説明文は禁止)
{
  "title": "(翻訳後)",
  "description": "(翻訳後)",
  "tags": ["..."],
  "primaryLocation": { "lat": ${jaMeta.primaryLocation.lat}, "lng": ${jaMeta.primaryLocation.lng}, "name": "(翻訳後の地点名)" }
}`;
}

function transBodyPrompt({ lang, jaBody }) {
  const langLabel = {
    en: "English (en)",
    "zh-TW": "Traditional Chinese (zh-TW, 台湾繁体)",
    "zh-CN": "Simplified Chinese (zh-CN, 中国大陆简体)",
  }[lang];
  return `あなたはプロの翻訳者です。以下の日本語不動産記事本文 (Markdown) を ${langLabel} に翻訳してください。

# 翻訳指針
- 日本の固有名詞は対象言語の慣用表記に置き換え、初出時は ( ) 内に英字または日本語原文を併記
- Markdown 構造 (見出し、表、箇条書き、リンク) を完全に保つ
- URL (https://mekiki-research.com 等) は変更しない
- 翻訳調にせず、ターゲット言語のネイティブが読んで自然になるようリライト

# 出力 (厳守)
- frontmatter は付けない
- コードフェンス (\`\`\`) で全体を囲まない
- いきなり翻訳後の Markdown 本文から始める

# 入力 (日本語 Markdown)
${jaBody}`;
}

// ─── 実データ取得（トップページが叩くのと同じバックエンドAPI） ─────────────
async function fetchAreaData({ lat, lng }) {
  const url = `${API_BASE_URL}/api/property/transactions?lat=${Number(lat)}&lng=${Number(lng)}&zoom=15&locale=ja`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    console.log(`[INFO] 実データ取得中: ${url}`);
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function summarizeAreaData(raw) {
  if (!raw || typeof raw !== "object") return null;
  const records = Array.isArray(raw.data?.data) ? raw.data.data : [];
  const prices = records.map((r) => r.tradePrice).filter((p) => typeof p === "number" && p > 0);
  const unitPrices = records
    .map((r) => r.unitPrice)
    .filter((v) => typeof v === "number" && v > 0);

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : null;

  const samples = records.slice(0, 6).map((r) => ({
    type: r.type,
    use: r.use,
    districtName: r.districtName,
    tradePrice: r.tradePrice,
    unitPrice: r.unitPrice,
    pricePerUnit: r.pricePerUnit,
    floorPlan: r.floorPlan,
    area: r.area,
    buildingYear: r.buildingYear,
    period: r.period,
    structure: r.structure,
    cityPlanning: r.cityPlanning,
    coverageRatio: r.coverageRatio,
    floorAreaRatio: r.floorAreaRatio,
  }));

  const env = raw.environment || null;
  const compactEnv = env
    ? {
        zoning: env.zoning,
        schools: env.schools,
        station: env.station,
        medicalCount: env.medical?.count ?? 0,
        medicalSample: (env.medical?.facilities || []).slice(0, 3),
      }
    : null;

  return {
    location: {
      prefecture: records[0]?.prefecture ?? null,
      municipality: records[0]?.municipality ?? raw.data?.geocodedDistrict ?? null,
      cityCode: raw.data?.cityCode ?? null,
    },
    transactionStats: {
      sampleCount: records.length,
      yearRange:
        Array.isArray(raw.data?.years) && raw.data.years.length
          ? `${raw.data.years[0]}〜${raw.data.years[raw.data.years.length - 1]}`
          : null,
      avgTradePrice: avg(prices),
      medianTradePrice: median,
      minTradePrice: prices.length ? Math.min(...prices) : null,
      maxTradePrice: prices.length ? Math.max(...prices) : null,
      avgUnitPrice: avg(unitPrices),
    },
    samples,
    hazard: raw.hazard ?? null,
    environment: compactEnv,
    source: raw.source ?? null,
  };
}

// AI が意図せず混入させる強調記号 (** / __) を除去する。
// 画像 ![alt](url) やリンク [text](url) は * / _ を構造に使わないので副作用なし。
function stripBoldMarkdown(text) {
  return String(text || "").replace(/\*\*/g, "").replace(/__/g, "");
}

// ─── Firestore への X 投稿テンプレート書き込み ──────────────────────────────
// admin ダッシュボード（/admin → X投稿管理タブ）が `social_templates` を参照する。
// ブログ記事が増えるたびに「記事紹介ツイート」テンプレートを自動で蓄積する。
//
// 初期化に失敗した場合（GCP 認証情報なし等）は警告ログのみ吐いて Skip する。
// ブログ生成は他経路のためのアーティファクトなので、Firestore 書き込みで失敗
// させたくない。
async function tryWriteSocialTemplate({ jaMeta, baseName }) {
  // Firestore は通常 Firebase プロジェクト ID で動いている（GCP プロジェクト ID と
  // 別物の場合あり）。FIREBASE_PROJECT_ID を優先して参照する。
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.warn("[WARN] GCP_PROJECT_ID 未設定のため social_templates への書き込みをスキップします。");
    return;
  }

  let adminMod;
  try {
    adminMod = require("firebase-admin");
  } catch (err) {
    console.warn(`[WARN] firebase-admin ロード失敗のため social_templates への書き込みをスキップ: ${err.message}`);
    return;
  }

  try {
    if (!adminMod.apps.length) {
      adminMod.initializeApp({ projectId });
    }
    const db = adminMod.firestore();

    const url = `${SITE_BASE_URL}/blog/${baseName}`;
    const description = String(jaMeta.description || jaMeta.title || "").trim();
    // 280 字以内に収める: 説明 + 改行 + URL + 改行 + ハッシュタグ
    const hashtags = (Array.isArray(jaMeta.tags) ? jaMeta.tags : [])
      .slice(0, 3)
      .map((tag) => "#" + String(tag).replace(/[\s#]/g, ""))
      .join(" ");
    const tail = `👇\n${url}${hashtags ? "\n" + hashtags : ""}`;
    const tailLen = Array.from(tail).length;
    const MAX = 280;
    const allowedDesc = Math.max(0, MAX - tailLen);
    const descChars = Array.from(description);
    const trimmedDesc =
      descChars.length <= allowedDesc
        ? description
        : descChars.slice(0, Math.max(0, allowedDesc - 1)).join("") + "…";
    const text = trimmedDesc + tail;

    await db.collection("social_templates").add({
      text,
      type: `ブログ記事紹介 — ${jaMeta.title || baseName}`,
      target: "不動産ブログ読者",
      lang: "ja",
      slug: baseName,
      url,
      createdAt: adminMod.firestore.FieldValue.serverTimestamp(),
      source: "generate_daily_blog",
    });
    console.log(`[INFO] social_templates に X 投稿テンプレートを追加しました (slug=${baseName}, ${Array.from(text).length} chars)`);
  } catch (err) {
    console.warn(`[WARN] social_templates 書き込み失敗 (継続): ${err.message}`);
  }
}

// ─── ファイル書き出し ─────────────────────────────────────────────────────────
function writeArticle(filename, meta, body, publishedAt) {
  const fm = buildFrontmatter({
    title: meta.title,
    description: meta.description,
    publishedAt,
    tags: meta.tags,
    primaryLocation: meta.primaryLocation,
  });
  const trimmedBody = stripBoldMarkdown(body).trim();
  const content = `${fm}\n${trimmedBody}\n`;
  const target = path.join(BLOG_DIR, filename);
  fs.writeFileSync(target, content, "utf8");
  console.log(`[INFO] 書き込み完了: ${filename} (${content.length} chars)`);
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    throw new Error(`ブログディレクトリが存在しません: ${BLOG_DIR}`);
  }

  const today = jstToday();
  const recentSlugs = existingSlugs();
  const region = pickRegion();
  console.log(`[INFO] 対象日 (JST): ${today}`);
  console.log(`[INFO] 既存記事 base 数: ${recentSlugs.length}`);
  console.log(`[INFO] 選定地域: ${region.name} (weight=${region.weight})`);
  console.log(`[INFO] モデル: ${MODEL}${DRY_RUN ? " (DRY RUN)" : ""}`);

  if (DRY_RUN) {
    console.log("[DRY] meta prompt の長さ:", jaMetaPrompt({ today, recentSlugs, region }).length);
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log("[INFO] [JA] メタデータ生成中...");
  const jaMeta = await callJson(ai, jaMetaPrompt({ today, recentSlugs, region }));
  for (const k of ["slug", "title", "description", "tags", "primaryLocation"]) {
    if (!jaMeta[k]) throw new Error(`日本語メタの必須フィールド '${k}' が欠けています`);
  }
  if (
    typeof jaMeta.primaryLocation.lat !== "number" ||
    typeof jaMeta.primaryLocation.lng !== "number" ||
    !isFinite(jaMeta.primaryLocation.lat) ||
    !isFinite(jaMeta.primaryLocation.lng)
  ) {
    throw new Error(
      `primaryLocation の lat/lng が不正です: ${JSON.stringify(jaMeta.primaryLocation)}`,
    );
  }
  jaMeta.slug = sanitizeSlug(jaMeta.slug);
  if (!jaMeta.slug) throw new Error("生成された slug が無効です");

  const baseName = `${today}-${jaMeta.slug}`;
  console.log(`[INFO] base name: ${baseName}`);
  if (fs.existsSync(path.join(BLOG_DIR, `${baseName}.md`))) {
    throw new Error(`${baseName}.md は既に存在します。生成を中止します。`);
  }

  // 実データ取得（トップページが叩くのと同じ Cloud Run バックエンドAPI）
  // 失敗しても記事生成自体は止めない（一般情報ベースのフォールバック執筆を促す）
  let areaData = null;
  try {
    const raw = await fetchAreaData(jaMeta.primaryLocation);
    areaData = summarizeAreaData(raw);
    console.log(
      `[INFO] 実データ取得 OK: source=${areaData?.source} count=${areaData?.transactionStats?.sampleCount} years=${areaData?.transactionStats?.yearRange}`,
    );
  } catch (apiErr) {
    console.warn(`[WARN] 実データ取得に失敗: ${apiErr.message}. 一般情報ベースで本文を生成します。`);
  }

  console.log("[INFO] [JA] 本文 Markdown 生成中...");
  const jaBody = await callText(ai, jaBodyPrompt({ today, meta: jaMeta, areaData }));
  if (jaBody.length < 1500) {
    throw new Error(`日本語本文が短すぎます: ${jaBody.length} chars`);
  }
  writeArticle(`${baseName}.md`, jaMeta, jaBody, today);

  for (const lang of ["en", "zh-TW", "zh-CN"]) {
    console.log(`[INFO] [${lang}] メタデータ翻訳中...`);
    const tMeta = await callJson(ai, transMetaPrompt({ lang, jaMeta }));
    if (!tMeta.title || !tMeta.description) {
      throw new Error(`${lang} メタ翻訳が不完全です`);
    }
    tMeta.tags = tMeta.tags && tMeta.tags.length ? tMeta.tags : jaMeta.tags;
    tMeta.primaryLocation = tMeta.primaryLocation || jaMeta.primaryLocation;

    console.log(`[INFO] [${lang}] 本文翻訳中...`);
    const tBody = await callText(ai, transBodyPrompt({ lang, jaBody }));
    if (tBody.length < 800) {
      throw new Error(`${lang} 翻訳本文が短すぎます: ${tBody.length} chars`);
    }
    writeArticle(`${baseName}.${lang}.md`, tMeta, tBody, today);
  }

  console.log(`\n[SUCCESS] 4 言語のブログ記事を生成しました: ${baseName}`);

  // Firestore (social_templates) への X 投稿テンプレート保存。
  // 失敗してもブログ生成自体は成功扱いのため await のみ（throw しない）。
  await tryWriteSocialTemplate({ jaMeta, baseName });
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
