import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

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
}

function buildPrompt(input: AreaReportInput): string {
  const {
    lat, lng, prefecture, municipality,
    years, totalCount, avgTradePrice, avgUnitPrice, minTradePrice, maxTradePrice,
    hazard, environment,
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

  return `あなたは日本の不動産市場に精通したプロの不動産コンサルタントです。
以下のデータを元に、住宅購入を検討する顧客向けのエリア総合分析レポートをマークダウン形式で作成してください。
各セクションは具体的・専門的に記述し、数値データを積極的に引用してください。

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

---

以下の5項目を**必ずこの順序・見出しで**記述してください。

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

---

※レポートは日本語で作成し、専門用語には必要に応じて簡単な説明を加えてください。`;
}

/**
 * Gemini APIを使ってエリア分析レポートを生成する。
 * GEMINI_API_KEYが未設定の場合はモックマークダウンを返す。
 */
export async function generateAreaReport(input: AreaReportInput): Promise<string> {
  if (!config.gemini.apiKey) {
    console.log("[Gemini] APIキー未設定 - モックレポートを返します");
    return getMockAiReport(input.prefecture, input.municipality);
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

export function getMockAiReport(prefecture: string, municipality: string): string {
  return `## 1. エリア総評

${prefecture}${municipality}は、利便性と住環境のバランスが取れたエリアです。直近5年間の取引データは安定した需要を示しており、実需・投資双方から注目されています。交通アクセスの良さと生活インフラの充実度が高評価で、今後も堅調な価格推移が見込まれます。

## 2. 子育て・生活環境スコア

★★★★☆（4/5）

- 📚 **学区の充実**: 区立小・中学校ともに評判がよく、徒歩圏内でアクセス可能
- 🏥 **医療機関の充実**: 周辺に複数のクリニック・病院があり、急な体調不良にも対応しやすい環境
- 🚉 **交通利便性**: 最寄り駅から主要ターミナルへの乗り換えもスムーズで、共働き世帯にも適した立地

## 3. 歴史・地形の特徴

このエリアは江戸時代から市街地として発展してきた歴史ある地域で、旧地名には周辺の地形や水系を反映した漢字が多く見られます。低地に位置する地区では、河川氾濫による堆積土が地盤を形成しており、液状化リスクについては事前確認が推奨されます。一方で、長年にわたる市街化の進展により、インフラ整備は十分に行き届いています。

## 4. 開発・再開発動向

近年、周辺エリアでは大規模な再開発計画が進行しており、商業施設や公共施設の整備が予定されています。詳細は各自治体の都市計画情報（都市計画マスタープランなど）をご参照ください。鉄道会社による駅前整備計画も一部で検討されており、将来的な資産価値向上の可能性があります。

## 5. 活用できる補助金・助成金

**国の制度**
- **住宅ローン減税（住宅借入金等特別控除）**: 最大13年間、年末ローン残高の0.7%を所得税から控除
- **ZEH（ゼロ・エネルギー・ハウス）補助金**: 省エネ住宅新築・改修に対し最大100万円補助
- **子育てエコホーム支援事業**: 子育て世帯・若者夫婦世帯向けに最大100万円の補助

**自治体独自の制度**（※最新情報は${municipality}の公式サイトでご確認ください）
- 住宅取得・リノベーション補助金
- 子育て世帯向け家賃・住宅費補助
- 三世代同居・近居支援補助金

> ⚠️ 補助金制度は年度ごとに変更される場合があります。申請前に必ず最新情報をご確認ください。`;
}
