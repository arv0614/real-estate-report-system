"use server";

import * as cheerio from "cheerio";
import { detectSiteId, siteLabel } from "@/lib/parsers/supportedSites";
import type { SupportedSiteId } from "@/lib/parsers/supportedSites";

export interface ParsedPropertyData {
  address?: string;
  price?: number;   // 万円
  area?: number;    // ㎡
  builtYear?: number;
}

export type ParseUrlResult =
  | { ok: true; data: ParsedPropertyData; siteId: SupportedSiteId | null; siteLabel: string }
  | { ok: false; error: string };

const FALLBACK_ERROR =
  "サイトのセキュリティ設定や利用規約により、情報の自動取得ができませんでした。手動でご入力ください。";

function extractPrice(text: string): number | undefined {
  // Matches: 3,980万円 / 3980万円 / 3.98億円
  const oku = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*億円/);
  if (oku) return Math.round(parseFloat(oku[1].replace(/,/g, "")) * 10000);

  const man = text.match(/([0-9,]+)\s*万円/);
  if (man) return parseInt(man[1].replace(/,/g, ""), 10);

  return undefined;
}

function extractArea(text: string): number | undefined {
  const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:㎡|m²|m2|平米)/);
  if (m) return parseFloat(m[1]);
  return undefined;
}

function extractBuiltYear(text: string): number | undefined {
  // 築2018年 / 2018年築 / 平成30年 / 2018年1月
  const western = text.match(/築\s*([12][0-9]{3})年/) ?? text.match(/([12][0-9]{3})年\s*(?:築|建築|建造)/);
  if (western) return parseInt(western[1], 10);

  // Japanese era
  const reiwa = text.match(/令和\s*([0-9]+)\s*年/);
  if (reiwa) return 2018 + parseInt(reiwa[1], 10);
  const heisei = text.match(/平成\s*([0-9]+)\s*年/);
  if (heisei) return 1988 + parseInt(heisei[1], 10);
  const showa = text.match(/昭和\s*([0-9]+)\s*年/);
  if (showa) return 1925 + parseInt(showa[1], 10);

  return undefined;
}

function extractAddress(text: string): string | undefined {
  // Look for prefecture patterns
  const m = text.match(
    /([東京都|北海道|(?:大阪|京都|神奈川|埼玉|千葉|愛知|静岡|兵庫|福岡|広島|宮城|新潟|茨城|栃木|群馬|岐阜|三重|滋賀|奈良|和歌山|鳥取|島根|岡山|山口|徳島|香川|愛媛|高知|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄|青森|岩手|秋田|山形|福島|山梨|長野|富山|石川|福井)府?県?|北海道|東京都][^\s、。「」【】]{2,40})/
  );
  return m?.[1];
}

export async function parsePropertyUrl(url: string): Promise<ParseUrlResult> {
  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "URLの形式が正しくありません。" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, error: "http または https のURLを入力してください。" };
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (res.status === 403 || res.status === 401) {
      return { ok: false, error: FALLBACK_ERROR };
    }
    if (!res.ok) {
      return { ok: false, error: FALLBACK_ERROR };
    }

    html = await res.text();
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }

  try {
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() || "";

    // Collect text from meta description + OGP description
    const metaDesc = $('meta[name="description"]').attr("content") ?? "";
    const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";

    // Also grab structured data / prominent text from the page body
    const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 4000);

    const combined = [title, metaDesc, ogDesc, bodyText].join(" ");

    const data: ParsedPropertyData = {
      price: extractPrice(combined),
      area: extractArea(combined),
      builtYear: extractBuiltYear(combined),
      address: extractAddress(combined),
    };

    // Require at least one field extracted to consider it a success
    const hasData = Object.values(data).some((v) => v !== undefined);
    if (!hasData) {
      return { ok: false, error: FALLBACK_ERROR };
    }

    const id = detectSiteId(url);
    return { ok: true, data, siteId: id, siteLabel: siteLabel(id) };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
