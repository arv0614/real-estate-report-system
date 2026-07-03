#!/usr/bin/env node
/**
 * prepare-hoanrin.mjs
 *
 * 国土数値情報「保安林」(NL03) GeoJSON を都道府県別に分割して GCS にアップロードする。
 *
 * 使い方:
 *   1. 国土数値情報ダウンロードサービス https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-NL03.html
 *      から最新年度の全国データ（GeoJSON 形式 or GML を gdal/ogr2ogr で変換）を用意する。
 *      ※ GML の場合: ogr2ogr -f GeoJSON NL03-national.geojson NL03-2024_GML/NL03-2024.gml
 *
 *   2. .env を読み込んだ状態でスクリプトを実行する:
 *      source .env && node scripts/prepare-hoanrin.mjs --input=path/to/NL03-national.geojson
 *
 *      または都道府県別に分割済みの場合:
 *      source .env && node scripts/prepare-hoanrin.mjs --input-dir=path/to/NL03-by-pref/
 *
 * 環境変数:
 *   GCS_CACHE_BUCKET  - アップロード先 GCS バケット (必須)
 *   GCP_PROJECT_ID    - GCP プロジェクト ID (必須)
 *   HOANRIN_REF_YEAR  - データ年度 (省略時: 2024)
 *
 * GCS 出力パス:
 *   hoanrin/pref{2-digit-code}.geojson  (例: hoanrin/pref13.geojson)
 *
 * NL03 プロパティ:
 *   A44_001: 都道府県コード (2桁 or 3桁文字列)
 *   A44_002: 保安林種別コード
 *   A44_003: 指定年度 等
 */

import { createReadStream, readdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import { Storage } from "@google-cloud/storage";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: {
    input:     { type: "string" },   // 全国単一ファイル
    "input-dir": { type: "string" }, // 都道府県別ディレクトリ
    "dry-run": { type: "boolean", default: false },
  },
  strict: false,
});

const BUCKET_NAME = process.env.GCS_CACHE_BUCKET;
const PROJECT_ID  = process.env.GCP_PROJECT_ID;
const REF_YEAR    = process.env.HOANRIN_REF_YEAR ?? "2024";
const DRY_RUN     = args["dry-run"] ?? false;

if (!BUCKET_NAME || !PROJECT_ID) {
  console.error("Error: GCS_CACHE_BUCKET と GCP_PROJECT_ID を環境変数で指定してください");
  process.exit(1);
}

const storage = new Storage({ projectId: PROJECT_ID });
const bucket  = storage.bucket(BUCKET_NAME);

// ── ユーティリティ ────────────────────────────────────────────────────────────

function prefCodeFromFeature(props) {
  // NL03 は A44_001 に都道府県コードが入る (文字列 "01"〜"47" or 数値)
  const raw = props?.A44_001 ?? props?.pref ?? "";
  const num = parseInt(String(raw), 10);
  if (isNaN(num) || num < 1 || num > 47) return null;
  return String(num).padStart(2, "0");
}

function gcsPath(prefCode) {
  return `hoanrin/pref${prefCode}.geojson`;
}

async function uploadToGCS(prefCode, featureCollection) {
  const path = gcsPath(prefCode);
  const payload = JSON.stringify({ ...featureCollection, refYear: REF_YEAR }, null, 0);

  if (DRY_RUN) {
    console.log(`[dry-run] would upload ${path} (${featureCollection.features.length} features, ${payload.length} bytes)`);
    return;
  }

  const file = bucket.file(path);
  await file.save(payload, {
    contentType: "application/json",
    metadata: { cacheControl: "public, max-age=86400" },
  });
  console.log(`✅ Uploaded ${path} (${featureCollection.features.length} features)`);
}

// ── 全国単一ファイルを都道府県別に分割 ───────────────────────────────────────

async function processNationalFile(filePath) {
  console.log(`Reading: ${filePath}`);
  const raw = await readFile(filePath, "utf-8");
  const fc = JSON.parse(raw);

  if (fc.type !== "FeatureCollection") {
    throw new Error("GeoJSON must be a FeatureCollection");
  }

  /** @type {Map<string, any[]>} */
  const byPref = new Map();

  for (const feature of fc.features) {
    const code = prefCodeFromFeature(feature.properties);
    if (!code) {
      console.warn("[warn] Could not determine prefCode for feature, skipping");
      continue;
    }
    if (!byPref.has(code)) byPref.set(code, []);
    byPref.get(code).push(feature);
  }

  console.log(`Found ${byPref.size} prefectures, ${fc.features.length} total features`);

  for (const [code, features] of byPref) {
    await uploadToGCS(code, { type: "FeatureCollection", features });
  }
}

// ── 都道府県別ディレクトリを処理 ─────────────────────────────────────────────
// ファイル名から都道府県コードを抽出: NL03-2024_01_GML.geojson → "01"

async function processDirectory(dirPath) {
  const files = readdirSync(dirPath).filter((f) => f.endsWith(".geojson"));
  console.log(`Found ${files.length} files in ${dirPath}`);

  for (const file of files) {
    // Extract pref code from typical NL03 filename patterns:
    // NL03-2024_01_GML.geojson, pref01.geojson, 01.geojson, etc.
    const match = file.match(/(?:_|pref|^)(\d{2})(?:_|\.|$)/i);
    if (!match) {
      console.warn(`[warn] Cannot determine pref code from filename: ${file}`);
      continue;
    }
    const prefCode = match[1].padStart(2, "0");
    const raw = await readFile(join(dirPath, file), "utf-8");
    const fc = JSON.parse(raw);
    await uploadToGCS(prefCode, fc);
  }
}

// ── エントリーポイント ────────────────────────────────────────────────────────

async function main() {
  if (args["input-dir"]) {
    if (!existsSync(args["input-dir"])) {
      console.error(`Directory not found: ${args["input-dir"]}`);
      process.exit(1);
    }
    await processDirectory(args["input-dir"]);
  } else if (args["input"]) {
    if (!existsSync(args["input"])) {
      console.error(`File not found: ${args["input"]}`);
      process.exit(1);
    }
    await processNationalFile(args["input"]);
  } else {
    console.error("Usage: node prepare-hoanrin.mjs --input=NL03-national.geojson");
    console.error("       node prepare-hoanrin.mjs --input-dir=./nl03-by-pref/");
    process.exit(1);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
