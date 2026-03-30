/**
 * generate_seo_images.ts
 *
 * プログラマティックSEOページ用の「暮らしイメージ」画像を事前生成するスクリプト。
 * TOKYO_23_WARDS の各エリアに対して Imagen 4 で画像を生成し、
 * frontend/public/seo-images/lifestyles/{pref}_{citySlug}.jpg として保存する。
 *
 * 実行コマンド（backend ディレクトリから）:
 *   npx tsx scripts/generate_seo_images.ts
 *
 * オプション:
 *   AREAS_FILTER=katsushika,minato  # 指定エリアのみ再生成
 *   DELAY_MS=5000                    # リクエスト間隔（デフォルト5秒）
 */

import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

// ── areas.ts のデータをインライン定義（tsパス解決の複雑さを避けるため） ──
interface AreaDef {
  prefSlug: string;
  citySlug: string;
  prefecture: string;
  city: string;
}

const TOKYO_23_WARDS: AreaDef[] = [
  { prefSlug: "tokyo", citySlug: "chiyoda",   prefecture: "東京都", city: "千代田区" },
  { prefSlug: "tokyo", citySlug: "chuo",       prefecture: "東京都", city: "中央区" },
  { prefSlug: "tokyo", citySlug: "minato",     prefecture: "東京都", city: "港区" },
  { prefSlug: "tokyo", citySlug: "shinjuku",   prefecture: "東京都", city: "新宿区" },
  { prefSlug: "tokyo", citySlug: "bunkyo",     prefecture: "東京都", city: "文京区" },
  { prefSlug: "tokyo", citySlug: "taito",      prefecture: "東京都", city: "台東区" },
  { prefSlug: "tokyo", citySlug: "sumida",     prefecture: "東京都", city: "墨田区" },
  { prefSlug: "tokyo", citySlug: "koto",       prefecture: "東京都", city: "江東区" },
  { prefSlug: "tokyo", citySlug: "shinagawa",  prefecture: "東京都", city: "品川区" },
  { prefSlug: "tokyo", citySlug: "meguro",     prefecture: "東京都", city: "目黒区" },
  { prefSlug: "tokyo", citySlug: "ota",        prefecture: "東京都", city: "大田区" },
  { prefSlug: "tokyo", citySlug: "setagaya",   prefecture: "東京都", city: "世田谷区" },
  { prefSlug: "tokyo", citySlug: "shibuya",    prefecture: "東京都", city: "渋谷区" },
  { prefSlug: "tokyo", citySlug: "nakano",     prefecture: "東京都", city: "中野区" },
  { prefSlug: "tokyo", citySlug: "suginami",   prefecture: "東京都", city: "杉並区" },
  { prefSlug: "tokyo", citySlug: "toshima",    prefecture: "東京都", city: "豊島区" },
  { prefSlug: "tokyo", citySlug: "kita",       prefecture: "東京都", city: "北区" },
  { prefSlug: "tokyo", citySlug: "arakawa",    prefecture: "東京都", city: "荒川区" },
  { prefSlug: "tokyo", citySlug: "itabashi",   prefecture: "東京都", city: "板橋区" },
  { prefSlug: "tokyo", citySlug: "nerima",     prefecture: "東京都", city: "練馬区" },
  { prefSlug: "tokyo", citySlug: "adachi",     prefecture: "東京都", city: "足立区" },
  { prefSlug: "tokyo", citySlug: "katsushika", prefecture: "東京都", city: "葛飾区" },
  { prefSlug: "tokyo", citySlug: "edogawa",    prefecture: "東京都", city: "江戸川区" },
];

// ── 設定 ─────────────────────────────────────────────────────────────────
const OUTPUT_DIR = path.join(__dirname, "../../frontend/public/seo-images/lifestyles");
const DELAY_MS = parseInt(process.env.DELAY_MS ?? "5000", 10);
const AREAS_FILTER = process.env.AREAS_FILTER
  ? process.env.AREAS_FILTER.split(",").map((s) => s.trim())
  : null;

const SKIP_EXISTING = process.env.SKIP_EXISTING !== "false"; // デフォルトtrue: 既存ファイルをスキップ

// ── 出力ディレクトリ作成 ─────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── imagenApi を直接インポート ────────────────────────────────────────────
import { generateLifestyleImage } from "../src/services/imagenApi";

// ── ユーティリティ ────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function outputPath(area: AreaDef): string {
  return path.join(OUTPUT_DIR, `${area.prefSlug}_${area.citySlug}.jpg`);
}

// ── メイン ────────────────────────────────────────────────────────────────
async function main() {
  const areas = AREAS_FILTER
    ? TOKYO_23_WARDS.filter((a) => AREAS_FILTER.includes(a.citySlug))
    : TOKYO_23_WARDS;

  console.log("==============================================");
  console.log("🖼️  SEO用暮らしイメージ生成スクリプト");
  console.log("==============================================");
  console.log(`対象エリア数  : ${areas.length}`);
  console.log(`出力先        : ${OUTPUT_DIR}`);
  console.log(`リクエスト間隔: ${DELAY_MS}ms`);
  console.log(`既存スキップ  : ${SKIP_EXISTING}`);
  console.log();

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const outFile = outputPath(area);
    const label = `[${i + 1}/${areas.length}] ${area.prefecture}${area.city}`;

    // 既存ファイルスキップ
    if (SKIP_EXISTING && fs.existsSync(outFile)) {
      console.log(`${label} → スキップ（既存）`);
      skipCount++;
      continue;
    }

    console.log(`${label} → 生成開始...`);

    try {
      const result = await generateLifestyleImage(area.prefecture, area.city);

      if (result.isMock) {
        console.warn(`  ⚠️ モック画像（APIエラー）- スキップして次のエリアへ`);
        failCount++;
      } else {
        // Base64 → Buffer → JPEG として保存
        const buffer = Buffer.from(result.imageBase64, "base64");
        fs.writeFileSync(outFile, buffer);
        const sizeKb = Math.round(buffer.length / 1024);
        console.log(`  ✅ 保存完了: ${path.basename(outFile)} (${sizeKb} KB, ${result.mimeType})`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ 生成失敗: ${err instanceof Error ? err.message : err}`);
      failCount++;
    }

    // 最後のエリア以外はディレイ
    if (i < areas.length - 1) {
      console.log(`  ${DELAY_MS / 1000}秒待機中...`);
      await sleep(DELAY_MS);
    }
  }

  console.log();
  console.log("==============================================");
  console.log(`✅ 完了: 成功 ${successCount} / スキップ ${skipCount} / 失敗 ${failCount}`);
  console.log("==============================================");

  if (failCount > 0) {
    console.log("\n💡 失敗したエリアを再試行するには:");
    console.log("   SKIP_EXISTING=true npx tsx scripts/generate_seo_images.ts");
  }
}

main().catch((err) => {
  console.error("❌ スクリプト失敗:", err);
  process.exit(1);
});
