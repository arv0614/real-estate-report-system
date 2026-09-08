import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import type { WeatherSummary } from "./openMeteo";

// ============================================================
// Gemini AIエリアレポート生成
// ============================================================

export interface AreaReportInput {
  lat: number;
  lng: number;
  prefecture: string;
  municipality: string;
  cityCode: string;
  years: number[];
  totalCount: number;
  avgTradePrice: number;
  avgUnitPrice: number | null;
  minTradePrice: number;
  maxTradePrice: number;
  hazard: {
    flood: { hasRisk: boolean; maxDepthLabel: string | null };
    landslide: { hasRisk: boolean; phenomena: string[] };
  };
  environment: {
    zoning: { useArea: string | null; coverageRatio: string | null; floorAreaRatio: string | null };
    schools: { elementary: string | null; juniorHigh: string | null };
    medical: { count: number };
    station: { name: string | null; operator: string | null; dailyPassengers: number | null };
  };
  /** Open-Meteo による気象サマリー。取得失敗時は null */
  weather?: WeatherSummary | null;
  locale?: string;
}

function buildPrompt(input: AreaReportInput): string {
  if (input.locale === "en") {
    return buildPromptEn(input);
  }
  return buildPromptJa(input);
}

function buildPromptJa(input: AreaReportInput): string {
  const {
    lat, lng, prefecture, municipality,
    years, totalCount, avgTradePrice, avgUnitPrice, minTradePrice, maxTradePrice,
    hazard, environment, weather,
  } = input;

  const yearLabel = years.length === 1
    ? `${years[0]}年`
    : `${years[0]}〜${years[years.length - 1]}年`;

  const floodLabel = hazard.flood.hasRisk
    ? `リスクあり（最大浸水深: ${hazard.flood.maxDepthLabel}）`
    : "該当なし";

  const landslideLabel = hazard.landslide.hasRisk
    ? `警戒区域内（${hazard.landslide.phenomena.join("・")}）`
    : "該当なし";

  const env = environment;
  const zoningStr = env.zoning.useArea
    ? `${env.zoning.useArea}（建ぺい率 ${env.zoning.coverageRatio ?? "不明"} / 容積率 ${env.zoning.floorAreaRatio ?? "不明"}）`
    : "不明";

  const stationStr = env.station.name
    ? `${env.station.name}駅（${env.station.operator ?? ""}${env.station.dailyPassengers ? ` / 乗降客数 ${env.station.dailyPassengers.toLocaleString()}人/日` : ""}）`
    : "不明";

  const toMan = (yen: number) => Math.round(yen / 10000).toLocaleString();

  const weatherBlock = weather
    ? `- 年間日照時間: 約${weather.annualSunshineHours.toLocaleString()}時間
- 夏期（7〜8月）平均最高気温: ${weather.summerAvgMaxTemp}℃
- 冬期（1〜2月）平均最低気温: ${weather.winterAvgMinTemp}℃`
    : "- データ取得不可（気象APIから情報を取得できませんでした）";

  return `あなたは日本の公的不動産データ(国土交通省 不動産情報ライブラリ等)に精通したデータアナリストです。提供された公的データを整理・要約し、事実に基づくエリア情報レポートを作成してください。物件の購入・売却・投資の推奨、価格の妥当性の判断、鑑定評価に類する記述は行わないでください。
各セクションは提供されたデータに基づいて客観的・具体的に記述し、数値データや出典を積極的に引用してください。

---

【エリア情報】
- 住所: ${prefecture}${municipality}（市区町村コード: ${input.cityCode}）
- 座標: 北緯${lat}度, 東経${lng}度
- 用途地域: ${zoningStr}
- 学区: 小学校=${env.schools.elementary ?? "不明"} / 中学校=${env.schools.juniorHigh ?? "不明"}
- 周辺医療機関: 約1.2km四方に ${env.medical.count}件
- 最寄り駅: ${stationStr}

【不動産取引データ（${yearLabel}・計${totalCount}件）】
- 平均取引価格: ${toMan(avgTradePrice)}万円
- 平均㎡単価: ${avgUnitPrice ? `${toMan(avgUnitPrice)}万円/㎡` : "データなし"}
- 価格レンジ: ${toMan(minTradePrice)}万円〜${toMan(maxTradePrice)}万円

【ハザード情報】
- 洪水浸水想定: ${floodLabel}
- 土砂災害警戒: ${landslideLabel}

【気象サマリー（2025年・Open-Meteo Historical Weather）】
${weatherBlock}

---

以下の${weather ? 11 : 10}項目を**必ずこの順序・見出しで**（番号もそのまま）記述してください。
各見出しは必ず \`## N. タイトル\` の形式（例: \`## 1. エリア総評\`）とし、番号を欠落させたり、本セット以外の見出しを追加しないでください。

## 1. エリア総評

このエリアの不動産市場・住環境について、取引データとエリア特性を踏まえた3〜4文のサマリーを書いてください。

## 2. 子育て・生活環境スコア

★の数（★1〜★5）で総合スコアを示し、その根拠となる具体的なポイントを3点、箇条書きで記述してください。

## 3. 歴史・地形の特徴

地名の由来、このエリアの歴史的背景（武家屋敷跡、農地、埋立地など）、地形的特徴（台地・低地・河川との関係）、および地盤や水害リスクとの関係性を記述してください。

## 4. 開発・再開発動向

近隣の大型商業施設、新線・新駅計画、行政による都市整備・区画整理などの情報を記述してください。情報が限られる場合は「詳細は各自治体の都市計画情報を参照」と補足してください。

## 5. 活用できる補助金・助成金

${prefecture}${municipality}で活用できる可能性のある住宅購入・リノベーション・子育て関連の補助金・助成金を具体的な例とともに紹介してください。国の制度（住宅ローン減税、ZEH補助金など）と自治体独自の制度の両方に言及してください。

## 6. 直近のニュース・トピックス

${prefecture}${municipality}や近隣エリアで最近話題になっているニュース、再開発の進捗、地域イベント、行政施策など、購入検討者が知っておくべき直近の動向を3〜5点、箇条書きで記述してください。

## 7. エリアの将来予想

自治体・国土交通省が公表している都市計画・交通インフラ整備計画・周辺開発動向を中心に整理してください。将来の不動産価格の上昇・下落に関する予測は行わないでください。不明な情報については「詳細は各自治体の都市計画情報を参照」と補足してください。

## 8. 人口の増減予想

国立社会保障・人口問題研究所などの公的人口統計・予測データを引用し、${prefecture}${municipality}の人口動態の傾向（増加・横ばい・減少）を事実として整理してください。将来の価格・収益性に関する評価は行わないでください。

## 9. リアルな住環境と注意点（メリット・デメリット）

**住まないとわからないような生活者目線のリアルな情報**を正直に記述してください。一般的なデータだけでなく、以下のような具体的な不便・デメリットも包み隠さず書いてください：
- 朝夕の通勤ラッシュ時の混雑・過酷さ（乗降客数データも踏まえて）
- 幹線道路・線路沿いの騒音・振動・排気ガスの実態
- 坂道・踏切・一方通行による渋滞や移動の不便さ
- 商業施設の充実度と「実は不便な点」（深夜営業・専門店の有無など）
- 臭気・工場・墓地など周辺環境の気になる要素
- 夏の暑さ・冬の寒さ・風の強さなど気候的な特性
- その他、住み始めて初めて気づく「あるある」な不満点
メリットも同様に、実際に住んでいる人が感じる「この街ならでは」の良さを具体的に書いてください。

${weather ? `## 10. エリアデータの整理（検討時の確認ポイント）

提供された気象サマリー（年間日照時間、夏期の最高気温、冬期の最低気温）を以下のとおり整理してください：
- **年間日照時間等の気象データの提示**：数値の概要と全国平均・地域比較上の位置づけを事実として示す
- **省エネ基準の一般的な参考情報**：夏冬の気温データから断熱・省エネ等級の一般的な参考情報を提示（「最適」等の評価語は使用しない）
- **公的補助制度の概要紹介**：ZEH・長期優良住宅・子育てエコホーム等の国の制度の概要（利用可否の判断は専門家・申請機関に委ねる）

## 11. エリアデータの整理（検討時の確認ポイント）` : `## 10. エリアデータの整理（検討時の確認ポイント）`}

提供された公的データをもとに、このエリアで不動産を検討する際に確認すべき事項を整理してください。以下の観点を含めること：
- **公的取引データから読み取れる価格帯の特徴**：統計値の説明に限定し、「優位」「割安」等の評価語は使用しない
- **人口動態・交通アクセス等の公的データが示す傾向**：将来の断定は避け、「〜という統計がある」「〜が確認されている」という形式で記述
- **ハザードデータで確認された事項と、行政資料・保険等の一般的な確認先の紹介**
- **購入検討時に専門家（宅地建物取引士・不動産鑑定士等）へ確認すべき事項のリスト**

---

**本レポートは公的データの集計・整理であり、購入・売却・投資の推奨や不動産鑑定評価ではありません。**

※レポートは日本語で作成し、専門用語には必要に応じて簡単な説明を加えてください。`;
}

function buildPromptEn(input: AreaReportInput): string {
  const {
    lat, lng, prefecture, municipality,
    years, totalCount, avgTradePrice, avgUnitPrice, minTradePrice, maxTradePrice,
    hazard, environment, weather,
  } = input;

  const yearLabel = years.length === 1
    ? `${years[0]}`
    : `${years[0]}–${years[years.length - 1]}`;

  const floodLabel = hazard.flood.hasRisk
    ? `Flood risk present (max inundation depth: ${hazard.flood.maxDepthLabel})`
    : "No flood risk";

  const landslideLabel = hazard.landslide.hasRisk
    ? `Within landslide warning zone (${hazard.landslide.phenomena.join(", ")})`
    : "No landslide risk";

  const env = environment;
  const zoningStr = env.zoning.useArea
    ? `${env.zoning.useArea} (coverage ratio: ${env.zoning.coverageRatio ?? "unknown"} / floor area ratio: ${env.zoning.floorAreaRatio ?? "unknown"})`
    : "Unknown";

  const stationStr = env.station.name
    ? `${env.station.name} Station (${env.station.operator ?? ""}${env.station.dailyPassengers ? `, ${env.station.dailyPassengers.toLocaleString()} daily passengers` : ""})`
    : "Unknown";

  const toM = (yen: number) => `¥${(yen / 1_000_000).toFixed(1)}M`;
  const toMSqm = (yen: number) => `¥${(yen / 1_000_000).toFixed(2)}M/㎡`;

  const weatherBlock = weather
    ? `- Annual sunshine hours: ~${weather.annualSunshineHours.toLocaleString()} h
- Summer (Jul–Aug) average daily high: ${weather.summerAvgMaxTemp}°C
- Winter (Jan–Feb) average daily low: ${weather.winterAvgMinTemp}°C`
    : "- Weather data unavailable (Open-Meteo fetch failed)";

  return `You are a data analyst specialising in Japanese public real estate data (MLIT Property Information Library, etc.). Your task is to organise and summarise the provided public data to produce a fact-based area information report. Do not make recommendations to purchase, sell, or invest in real estate; do not assess the appropriateness of prices; and do not make statements that resemble a formal appraisal.

Please write an area information report in Markdown format based on the data provided below. Write in clear, factual English appropriate for a general audience. Cite statistics and data sources actively.

---

**Area Information**
- Location: ${municipality}, ${prefecture} (City code: ${input.cityCode})
- Coordinates: ${lat}°N, ${lng}°E
- Zoning: ${zoningStr}
- School district: Elementary=${env.schools.elementary ?? "Unknown"} / Junior High=${env.schools.juniorHigh ?? "Unknown"}
- Medical facilities within ~1.2km: ${env.medical.count} facilities
- Nearest station: ${stationStr}

**Transaction Data (${yearLabel}, ${totalCount} records)**
- Average transaction price: ${toM(avgTradePrice)}
- Average unit price per ㎡: ${avgUnitPrice ? toMSqm(avgUnitPrice) : "No data"}
- Price range: ${toM(minTradePrice)} – ${toM(maxTradePrice)}

**Hazard Information**
- Flood risk: ${floodLabel}
- Landslide risk: ${landslideLabel}

**Weather Summary (2025, Open-Meteo Historical Weather)**
${weatherBlock}

---

Write the following **${weather ? 11 : 10} sections in this exact order and with these exact headings (keep the numbers as shown)**.
Every heading MUST follow the format \`## N. Title\` (e.g. \`## 1. Area Overview\`). Do not omit numbers or insert extra headings outside this set.

## 1. Area Overview

Provide a 3–4 sentence executive summary of the property market and living environment, drawing on transaction data and area characteristics.

## 2. Family & Lifestyle Score

Rate the area ★1–★5 and list 3 specific bullet points supporting the score.

## 3. History & Geography

Describe the origin of the area's name, its historical background (former samurai estates, farmland, reclaimed land, etc.), topographical features (upland/lowland, river proximity), and how these relate to soil quality and flood risk.

## 4. Development & Redevelopment Trends

Describe nearby large commercial facilities, new rail/station plans, and urban development initiatives by local government. If information is limited, note "Refer to the municipality's urban planning documents for details."

## 5. Available Subsidies & Incentives

List housing purchase, renovation, and child-rearing subsidies available in ${municipality}, ${prefecture}. Cover both national programs (mortgage tax deduction, ZEH subsidy, etc.) and local government schemes.

## 6. Recent News & Developments

List 3–5 bullet points covering recent news, redevelopment progress, community events, or government policy changes that prospective buyers should know about.

## 7. Future Outlook

Summarise publicly available urban planning information, transport infrastructure projects, and nearby development plans from government sources. Do not forecast property price movements or provide market outlook scenarios. If information is limited, note "Refer to the municipality's urban planning documents for details."

## 8. Population Forecast

Cite public demographic statistics (e.g., IPSS projections) and present the population trend for ${municipality} (growing / stable / declining) as factual public data. Do not assess the impact on asset values or make investment-related inferences.

## 9. Real Living Experience — Pros & Cons

Provide honest, resident-perspective information that you only discover by living there. Cover specific drawbacks and benefits, including:
- Morning/evening commute congestion and conditions (use passenger volume data)
- Noise, vibration, and air quality near major roads or rail lines
- Inconveniences from hills, level crossings, or one-way streets
- Retail availability gaps (late-night, specialist shops, etc.)
- Environmental concerns: odors, industrial facilities, cemeteries, etc.
- Climate: summer heat, winter cold, wind exposure
- Other "only locals know" daily frustrations and genuine highlights

${weather ? `## 10. エリアデータの整理（検討時の確認ポイント） (Area Data Summary — Key Points to Verify)

Organise and present the provided weather summary (annual sunshine hours, summer peak temperatures, winter low temperatures) as factual public data. Body in English:
- **Climate data summary**: Present the figures and their position relative to national averages as facts — do not evaluate or recommend
- **General information on energy-efficiency standards**: Reference typical insulation and energy-efficiency grades based on climate data (avoid evaluative terms such as "recommended" or "optimal")
- **Overview of public subsidy programmes**: Briefly describe national programmes (ZEH, long-term-quality housing, etc.); leave eligibility determination to specialists and relevant authorities

The heading must remain in Japanese (\`## 10. エリアデータの整理（検討時の確認ポイント）\`); the body should be in English.

## 11. エリアデータの整理（検討時の確認ポイント） (Area Data Summary — Key Points to Verify)` : `## 10. エリアデータの整理（検討時の確認ポイント） (Area Data Summary — Key Points to Verify)`}

Based on the provided public data, organise the key points to verify when considering property in this area. Include all of the following:
- **Price range characteristics from public transaction data**: Limit to statistical description; avoid evaluative language such as "advantageous," "undervalued," etc.
- **Trends indicated by demographic and transport public data**: Avoid definitive future predictions; use phrases such as "statistics indicate that…" or "data shows that…"
- **Matters confirmed by hazard data**, with references to general sources (government documents, insurance, etc.)
- **List of matters to confirm with specialists** (licensed real estate agents, certified appraisers, etc.) when considering a purchase

---

**This report is a compilation and organisation of public data. It does not constitute a recommendation to purchase, sell, or invest in real estate, nor a formal real estate appraisal.**

Write the entire report in English. Use clear, factual language appropriate for a general English-speaking audience interested in Japanese real estate.`;
}

/**
 * Gemini APIを使ってエリア分析レポートを生成する。
 * GEMINI_API_KEYが未設定の場合はモックマークダウンを返す。
 */
export async function generateAreaReport(input: AreaReportInput): Promise<string> {
  if (!config.gemini.apiKey) {
    throw new Error("[Gemini] APIキー未設定");
  }

  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: config.gemini.model });

  const prompt = buildPrompt(input);
  console.log(`[Gemini] エリアレポート生成開始: ${input.prefecture}${input.municipality}`);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log(`[Gemini] 生成完了 (${text.length}文字)`);
  return text;
}

// ============================================================
// ユーザーフィードバック → Claude Code 向け要件定義書プロンプト生成
// ============================================================

export type FeedbackType = "bug" | "feature" | "other";

const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "バグ報告",
  feature: "機能要望",
  other: "その他のフィードバック",
};

function buildFeedbackPrompt(type: FeedbackType, message: string): string {
  const typeLabel = FEEDBACK_TYPE_LABEL[type];
  return `あなたは経験豊富なプロダクトマネージャー兼テクニカルリードです。
以下はエンドユーザーから寄せられた「${typeLabel}」です。
このユーザーの声をエンジニア（Claude Code）が即座に着手できる「プロンプト指示書（要件定義書）」に整理してください。

【ユーザーの声】
${message}

【出力フォーマット（必ずこの順序・見出しで Markdown 出力すること）】

## 概要
ユーザーの要望・問題の本質を1〜2文で要約。

## 背景・課題
ユーザーが直面している具体的な状況・痛みを推察して言語化。なぜこの要望が生まれたのかを補足する。

## 想定されるユーザーストーリー
「〇〇な状況で、△△したいので、□□できるようにしたい」という形式で1〜3項目記述。

## 改修方針（Claude Code への指示）
エンジニア視点で、具体的な実装ステップを **番号付きリスト** で5〜10項目記述すること。
- フロントエンド（React / Next.js / Tailwind）・バックエンド（Hono / Firestore / GCP）・i18n の観点を含める
- 影響しそうなファイルパスや関数名が推察できる場合は明記する
- 既存実装との整合性に注意すべき点があれば指摘する

## 受け入れ条件 (Acceptance Criteria)
チェックリスト形式で、実装完了とみなすための具体的条件を3〜6項目記述。

## 補足事項
将来拡張・関連機能・テスト観点など、エンジニアが知っておくと良い情報があれば記述（なければ「特になし」）。

---
※ 推測で補完する場合は「（推測）」と明示すること。
※ ユーザーの原文の意図を歪めないこと。`;
}

/**
 * ユーザーからのフィードバック（バグ報告・機能要望）をもとに、
 * Claude Code 向けの「要件定義書プロンプト」を Gemini で生成する。
 */
export async function generateFeedbackPrompt(
  type: FeedbackType,
  message: string
): Promise<string> {
  if (!config.gemini.apiKey) {
    throw new Error("[Gemini] APIキー未設定");
  }

  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: config.gemini.model });

  const prompt = buildFeedbackPrompt(type, message);
  console.log(`[Gemini] フィードバック要件定義生成開始: type=${type}, msgLen=${message.length}`);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log(`[Gemini] フィードバック要件定義生成完了 (${text.length}文字)`);
  return text;
}

export function getMockAiReport(prefecture: string, municipality: string): string {
  return `## 1. エリア総評

${prefecture}${municipality}は、利便性と住環境のバランスが取れたエリアです。国土交通省「不動産情報ライブラリ」の直近複数年の取引データによると、継続的な取引事例が確認されています。交通アクセスの利便性と周辺生活インフラの整備状況は比較的充実しています。

## 2. 子育て・生活環境スコア

★★★★☆（4/5）

- 📚 **学区の充実**: 区立小・中学校ともに評判がよく、徒歩圏内でアクセス可能
- 🏥 **医療機関の充実**: 周辺に複数のクリニック・病院があり、急な体調不良にも対応しやすい環境
- 🚉 **交通利便性**: 最寄り駅から主要ターミナルへの乗り換えもスムーズで、共働き世帯にも適した立地

## 3. 歴史・地形の特徴

このエリアは江戸時代から市街地として発展してきた歴史ある地域で、旧地名には周辺の地形や水系を反映した漢字が多く見られます。低地に位置する地区では、河川氾濫による堆積土が地盤を形成しており、液状化リスクについては国土交通省のハザードマップまたは行政窓口でご確認ください。一方で、長年にわたる市街化の進展により、インフラ整備は十分に行き届いています。

## 4. 開発・再開発動向

近年、周辺エリアでは大規模な再開発計画が進行しており、商業施設や公共施設の整備が予定されています。詳細は各自治体の都市計画情報（都市計画マスタープランなど）をご参照ください。鉄道会社による駅前整備計画も一部で検討されており、最新情報は各自治体の都市計画担当窓口にてご確認ください。

## 5. 活用できる補助金・助成金

**国の制度**
- **住宅ローン減税（住宅借入金等特別控除）**: 最大13年間、年末ローン残高の0.7%を所得税から控除
- **ZEH（ゼロ・エネルギー・ハウス）補助金**: 省エネ住宅新築・改修に対し最大100万円補助
- **子育てエコホーム支援事業**: 子育て世帯・若者夫婦世帯向けに最大100万円の補助

**自治体独自の制度**（※最新情報は${municipality}の公式サイトでご確認ください）
- 住宅取得・リノベーション補助金
- 子育て世帯向け家賃・住宅費補助
- 三世代同居・近居支援補助金

> ⚠️ 補助金制度は年度ごとに変更される場合があります。申請前に必ず最新情報をご確認ください。

## 6. 直近のニュース・トピックス

- 🏗️ **再開発計画の進捗**: 周辺エリアで複数の大型開発が進行中。商業施設の誘致や公共空間の整備が予定されています
- 🚉 **交通インフラ整備**: 近隣駅のバリアフリー化・ホームドア設置など、利便性向上に向けた工事が順次実施中
- 🌿 **公園・緑化整備**: 区による緑道整備や公園リニューアルが計画されており、住環境の向上が期待されます
- 📋 **都市計画の見直し**: 用途地域の変更や建築規制の緩和について自治体で検討が進んでいます

## 7. エリアの将来予想

公的に確認できる都市計画として、周辺エリアでは鉄道会社による駅前整備・行政による再開発計画が進行しています。詳細は各自治体の都市計画マスタープランおよび国土交通省「都市計画決定GISデータ」をご参照ください。

不動産価格の将来的な変動に関する予測は本レポートの範囲外です。購入・売却の判断は宅地建物取引士または不動産鑑定士等の専門家にご相談ください。

【参照先】各自治体の都市計画担当窓口・国土交通省（https://www.mlit.go.jp）

## 8. 人口の増減予想

国立社会保障・人口問題研究所の「日本の地域別将来推計人口」によると、大都市圏の中心部は人口流入により比較的緩やかな減少にとどまる見込みです。${prefecture}全体では2030年頃に人口のピークを迎え、その後は緩やかな減少が続くと推計されています。

ただし、${municipality}レベルでは再開発やタワーマンション建設による人口増加が局所的に確認されているエリアもあります。高齢化の進展に伴い、バリアフリー物件・医療施設近接エリアへの居住ニーズの変化が統計上示されています。

> 📊 人口予測は社会・経済情勢により変動します。最新データは国立社会保障・人口問題研究所（https://www.ipss.go.jp）をご参照ください。

## 9. リアルな住環境と注意点（メリット・デメリット）

**デメリット（住んで初めてわかること）**
- 🚃 **通勤ラッシュの過酷さ**: 朝7〜9時台の最寄り路線は乗車率が高く、ドア付近でも身動きが取りにくい状況が続く。乗り換え駅では特にホーム混雑が激しく、1本見送ることも珍しくない
- 🔊 **幹線道路・線路沿いの騒音**: 国道・都道が近い地区では大型トラック・バスの通過音が深夜早朝まで続く。線路沿いは電車音に加え踏切の警報音が断続的に発生
- 🚗 **踏切渋滞と一方通行**: 朝夕の踏切遮断により幹線道路の迂回が発生。細い生活道路は一方通行が多く、初めての来客には案内が難しい
- 🌡️ **夏の暑さ（ヒートアイランド）**: コンクリートと密集した建物により、夜間も気温が下がりにくい。特に低層階は熱がこもりやすく、エアコン稼働率・電気代が高め

**メリット（この街ならではの良さ）**
- 🛒 **生活利便性の高さ**: 駅周辺にスーパー・ドラッグストア・コンビニが徒歩圏内に複数あり、日常の買い物に困らない
- 🏥 **医療・福祉の充実**: クリニックから総合病院まで選択肢が多く、高齢者や子育て世帯にとって安心感がある
- 🌿 **親しみやすいコミュニティ**: 下町文化が残る地域では商店街・祭りなどの地域交流が活発で、定住後の人間関係が築きやすい

## 10. エリアデータの整理（検討時の確認ポイント）

**公的取引データから読み取れる価格帯の特徴**

国土交通省の取引データによると、このエリアでは直近複数年にわたり取引事例が確認されています。平均㎡単価・価格帯の分布については、本レポートの取引価格セクションに掲載の統計値をご参照ください。価格の妥当性評価は専門家（不動産鑑定士等）にご確認ください。

**公的データが示す傾向**

人口動態については、国立社会保障・人口問題研究所の地域別将来推計データが参考になります。交通アクセスについては、最寄り駅の乗降客数データ（国土交通省統計）が公表されています。これらは統計上の傾向であり、将来を保証するものではありません。

**ハザードデータで確認された事項と確認先**

ハザードマップ（国土交通省）で確認された洪水・土砂災害リスクについては、本レポートのハザード情報セクションをご参照ください。水害補償を含む火災保険の条件・加入可否は保険会社にご確認ください。行政の排水・堤防整備状況は各自治体の都市計画担当窓口でご確認いただけます。

**購入検討時に専門家へ確認すべき事項**

- 宅地建物取引士による重要事項説明の内容確認（法定義務事項）
- 価格の妥当性判断が必要な場合は不動産鑑定士への相談
- 住宅ローンの条件・適用金利は金融機関または住宅ローンアドバイザーへ相談
- 補助金・税制優遇の最新情報は各自治体・国土交通省の公式サイトをご確認ください

---

**本レポートは公的データの集計・整理であり、購入・売却・投資の推奨や不動産鑑定評価ではありません。**`;

}

// ============================================================
// AI 顧客提案ジェネレーター（Pro プラン限定、backend/src/routes/ai-proposal.ts が使用）
// ============================================================

export interface CustomerProposalInput {
  /** 顧客のライフスタイル・要望（例: 夫婦2人, 週3リモート, 車なし） */
  targetProfile: string;
  /** 予算等の条件（例: 4000万円台, 駅徒歩10分以内） */
  budget: string;
  /** 対象の広域エリア（例: 東京23区, 東京都下, 神奈川県, 千葉県, 埼玉県, 関西エリア, その他） */
  targetArea: string;
  locale?: string;
}

export interface ProposalArea {
  areaName: string;
  reasons: string[];
  salesScript: string;
  catchcopy: string;
  /** 提案エリア（代表的な駅など）のおおよその緯度 */
  lat: number;
  /** 提案エリア（代表的な駅など）のおおよその経度 */
  lng: number;
}

export interface CustomerProposalResult {
  areas: ProposalArea[];
}

// generateCustomerProposal は Google 検索グラウンディング（tools: [{ googleSearch: {} }]）を
// 使うため、その機能を提供する現行 SDK `@google/genai`（ESM専用パッケージ）を使う。
// 本ファイルの他の関数が使う `@google/generative-ai`（旧SDK）は googleSearch ツールの型を
// 持たないため、この関数専用に動的 import する（scripts/generate_daily_blog.js と同じ手法。
// backend は tsconfig で module: commonjs だが、Node 20 は require(esm) に対応済みのため
// コンパイル後の動的 import も問題なく動作することを実機確認済み）。
type GenAiTypeEnum = typeof import("@google/genai").Type;

function buildCustomerProposalSchema(Type: GenAiTypeEnum) {
  return {
    type: Type.OBJECT,
    properties: {
      areas: {
        type: Type.ARRAY,
        minItems: 1,
        maxItems: 3,
        items: {
          type: Type.OBJECT,
          properties: {
            areaName: {
              type: Type.STRING,
              description: "推薦エリア名（都道府県+市区町村、または沿線+駅名など具体的に）",
            },
            reasons: {
              type: Type.ARRAY,
              minItems: 2,
              maxItems: 5,
              items: { type: Type.STRING },
              description:
                "データ・エリア特性に基づく具体的な推薦理由（箇条書き、顧客の条件と紐づけて記述）。Google検索で調査した最新の再開発計画・新設インフラ・商業施設・住宅補助金や子育て支援情報の具体的なファクトを含めること",
            },
            salesScript: {
              type: Type.STRING,
              description:
                "営業担当がそのまま顧客に読み上げられる提案トーク（2〜4文、丁寧語）。Google検索で調査した最新ファクトを根拠として盛り込むこと",
            },
            catchcopy: {
              type: Type.STRING,
              description: "チラシ・マイソク（物件概要書）用のキャッチコピー（1文、20〜40字程度）",
            },
            lat: {
              type: Type.NUMBER,
              description: "提案エリアの代表地点（最寄り駅など）のおおよその緯度（10進数、例: 35.6895）",
            },
            lng: {
              type: Type.NUMBER,
              description: "提案エリアの代表地点（最寄り駅など）のおおよその経度（10進数、例: 139.6917）",
            },
          },
          required: ["areaName", "reasons", "salesScript", "catchcopy", "lat", "lng"],
        },
      },
    },
    required: ["areas"],
  };
}

function buildProposalPromptJa(input: CustomerProposalInput): string {
  return `あなたは日本の不動産仲介業界で長年の実績を持つベテラン営業コンサルタントです。
不動産仲介業者（エンドユーザー）が担当する顧客に「穴場エリア」を提案する際、そのまま使える営業資料の作成を手伝ってください。

【顧客のライフスタイル・要望】
${input.targetProfile}

【予算・条件】
${input.budget}

【対象の広域エリア】
${input.targetArea}

上記の広域エリアの範囲内で、顧客の条件に適した「穴場」エリアを、根拠のある形で最大3つ提案してください。
指定された広域エリアの外は提案しないでください。知名度だけが高い人気エリアではなく、
顧客の条件（ライフスタイル・予算）に照らして合理的な「狙い目」のエリアを優先してください。

対象エリア（都道府県・自治体・駅周辺）に関する最新の再開発計画、新設インフラ・商業施設、自治体の最新の住宅補助金や
子育て支援情報をGoogle検索で調査し、その具体的なファクトを reasons および salesScript に必ず含めること。

各エリアについて、以下を作成してください。
- areaName: エリア名
- reasons: そのエリアを推薦する具体的な理由（利便性・価格帯・住環境・将来性など、顧客の条件と関連付けて記述）
- salesScript: 営業担当がそのまま顧客に話せる提案トーク
- catchcopy: チラシ・マイソクに使えるキャッチコピー
- lat / lng: 提案するエリア（代表的な駅など）のおおよその緯度・経度を必ず数値で出力すること（分からない場合も
  一般的に知られている地理情報から可能な限り正確な推定値を出力し、絶対に省略しないこと）

出力は指定のJSONスキーマに厳密に従い、日本語で記述してください。誇大広告や「確実に値上がりする」等の断定的な将来予測は避け、
根拠を示しながら訴求力のある文章にしてください。`;
}

function buildProposalPromptEn(input: CustomerProposalInput): string {
  return `You are a veteran sales consultant with deep experience in the Japanese real estate brokerage industry.
Help a real estate agent (the end user) prepare ready-to-use sales material recommending "hidden gem" areas to their client.

**Client lifestyle / requirements**
${input.targetProfile}

**Budget / conditions**
${input.budget}

**Target broad area**
${input.targetArea}

Within that broad area only, recommend up to 3 well-reasoned "hidden gem" areas — prioritise areas that are a rational
fit for the client's stated lifestyle and budget over areas that are merely famous or popular. Do not suggest areas
outside the specified broad area.

Use Google Search to research the latest redevelopment plans, newly built infrastructure/commercial facilities, and the
municipality's current housing subsidies or child-rearing support programmes for the target area (prefecture /
municipality / around the station), and be sure to include those specific, current facts in reasons and salesScript.

For each area, produce:
- areaName: the area name
- reasons: specific, evidence-based reasons to recommend it (convenience, price range, living environment, future outlook, etc.), tied to the client's stated conditions
- salesScript: a sales pitch the agent can read aloud to the client as-is
- catchcopy: a short catchphrase suitable for a flyer / property summary sheet
- lat / lng: you MUST output the approximate latitude/longitude of the recommended area (e.g. its representative
  station) as numbers. Never omit these — provide your best geographic estimate even if uncertain.

Follow the given JSON schema strictly and write in English. Avoid exaggerated claims or definitive predictions of future
price increases; keep the copy persuasive but grounded in the stated reasons.`;
}

function parseCustomerProposalResult(text: string): CustomerProposalResult {
  let parsed: CustomerProposalResult;
  try {
    parsed = JSON.parse(text) as CustomerProposalResult;
  } catch (err) {
    throw new Error(`[Gemini] JSON解析失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(parsed.areas)) {
    throw new Error("[Gemini] レスポンス形式が不正です（areas 配列がありません）");
  }
  return parsed;
}

/**
 * Gemini APIを使って「AI顧客提案」を構造化 JSON で生成する（Pro プラン限定機能）。
 * Google 検索グラウンディング（tools: [{ googleSearch: {} }]）を有効にし、対象エリアの
 * 最新の再開発計画・新設インフラ・自治体の補助金情報等を調査した上で、responseSchema で
 * JSON 出力を強制する（Markdown コードフェンス等の後処理は不要）。
 * ツール利用時にエラーが発生した場合は、検索なし（通常の推論のみ）にフォールバックして
 * 処理を継続する安全設計とする。
 */
export async function generateCustomerProposal(
  input: CustomerProposalInput
): Promise<CustomerProposalResult> {
  if (!config.gemini.apiKey) {
    throw new Error("[Gemini] APIキー未設定");
  }

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const schema = buildCustomerProposalSchema(Type);
  const prompt = input.locale === "en" ? buildProposalPromptEn(input) : buildProposalPromptJa(input);

  console.log(
    `[Gemini] 顧客提案生成開始（Google検索グラウンディング有効）: profileLen=${input.targetProfile.length}, budgetLen=${input.budget.length}, targetArea=${input.targetArea}`
  );

  try {
    const result = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.8,
      },
    });
    const text = result.text;
    if (!text) {
      throw new Error("[Gemini] 応答が空です");
    }
    const parsed = parseCustomerProposalResult(text);
    console.log(`[Gemini] 顧客提案生成完了（Google検索グラウンディング） (${parsed.areas.length}件)`);
    return parsed;
  } catch (err) {
    console.warn(
      `[WARN] Google検索グラウンディング付き生成に失敗したため、検索なしの通常推論にフォールバックします: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const fallback = await ai.models.generateContent({
    model: config.gemini.model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.8,
    },
  });
  const fallbackText = fallback.text;
  if (!fallbackText) {
    throw new Error("[Gemini] フォールバック応答も空です");
  }
  const parsed = parseCustomerProposalResult(fallbackText);
  console.log(`[Gemini] 顧客提案生成完了（フォールバック・検索なし） (${parsed.areas.length}件)`);
  return parsed;
}
