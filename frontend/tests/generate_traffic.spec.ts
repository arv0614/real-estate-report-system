/**
 * generate_traffic.spec.ts
 *
 * PostHogダッシュボードへのデータ蓄積用ダミートラフィック生成スクリプト。
 * 本番環境に対して複数エリアを自動検索し、シェアボタンクリック・Survey応答を模擬する。
 *
 * 実行コマンド:
 *   npx playwright test tests/generate_traffic.spec.ts --project=chromium
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// ──────────────────────────────────────────────
// 設定
// ──────────────────────────────────────────────
const BASE_URL =
  process.env.TEST_BASE_URL ||
  "https://mekiki-research.com";

/** ダミーメールアドレス（cleanup_dummy_data.ts で削除する識別子） */
const DUMMY_EMAIL = "dummy_test_playwright@example.com";

/** 検索対象エリア一覧（東京都主要区の代表座標） */
const AREAS = [
  { name: "葛飾区",   lat: 35.7445, lng: 139.8475 },
  { name: "港区",     lat: 35.6580, lng: 139.7514 },
  { name: "渋谷区",   lat: 35.6624, lng: 139.7042 },
  { name: "新宿区",   lat: 35.6938, lng: 139.7034 },
  { name: "世田谷区", lat: 35.6464, lng: 139.6533 },
  { name: "江東区",   lat: 35.6717, lng: 139.8170 },
  { name: "品川区",   lat: 35.6088, lng: 139.7302 },
  { name: "豊島区",   lat: 35.7282, lng: 139.7178 },
  { name: "文京区",   lat: 35.7080, lng: 139.7522 },
  { name: "目黒区",   lat: 35.6329, lng: 139.6985 },
] as const;

// ──────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 検索結果（シェアボタン）が表示されるまで待機。
 * タイムアウト時は null を返す（テスト失敗にしない）。
 */
async function waitForResults(page: Page, timeoutMs = 45_000): Promise<boolean> {
  try {
    await page.waitForSelector(
      'button[aria-label="URLをコピー"], button[aria-label="X (Twitter) でシェア"]',
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    console.log("  [warn] 結果未表示（タイムアウト or エラー）");
    return false;
  }
}

/**
 * URLコピーボタンをクリック（PostHog: share_button_clicked / platform=copy）。
 * フォールバックとして X (Twitter) ボタンも試みる。
 */
async function clickShareButton(page: Page): Promise<string | null> {
  // URLコピーを優先（新規ウィンドウが開かない）
  const copyBtn = page.locator('button[aria-label="URLをコピー"]');
  if (await copyBtn.isVisible().catch(() => false)) {
    await copyBtn.click();
    console.log("  → URLコピーボタンをクリック");
    return "copy";
  }

  // Xボタン（window.open が発生するが PostHog へのイベントは送信される）
  const xBtn = page.locator('button[aria-label="X (Twitter) でシェア"]');
  if (await xBtn.isVisible().catch(() => false)) {
    // 新規ウィンドウをブロックしてクリックだけ記録
    page.on("popup", (popup) => popup.close().catch(() => {}));
    await xBtn.click();
    console.log("  → X(Twitter)ボタンをクリック");
    return "x";
  }

  return null;
}

/**
 * PostHog Survey ポップアップにダミーメールを入力して送信する。
 * 複数のセレクタパターンを試行し、見つからなければスキップ。
 */
async function handleSurveyIfPresent(page: Page): Promise<boolean> {
  // PostHog が survey を表示するまで最大 5 秒待機
  const surveyContainerSelectors = [
    '[class*="PostHogSurvey"]',
    '[data-attr="survey-widget"]',
    '[class*="ph-survey"]',
    // フォールバック: テキストで特定
    'form:has(input[type="email"])',
  ];

  for (const selector of surveyContainerSelectors) {
    const el = page.locator(selector).first();
    const visible = await el.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!visible) continue;

    console.log(`  → Survey ポップアップ検出 (${selector})`);

    // メールアドレス入力フィールドを探す
    const emailInput = el
      .locator('input[type="email"], input[type="text"], input[placeholder*="メール"], input[placeholder*="mail"]')
      .first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(DUMMY_EMAIL);
      console.log(`  → ダミーメール入力: ${DUMMY_EMAIL}`);
    }

    // 送信ボタン
    const submitBtn = el
      .locator(
        'button[type="submit"], button:has-text("送信"), button:has-text("Submit"), button:has-text("確認")'
      )
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      console.log("  → Survey 送信完了");
      await page.waitForTimeout(1_500);
      return true;
    }
  }

  // ページ全体で直接探すフォールバック
  const globalForm = page.locator('input[type="email"]').last();
  if (await globalForm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await globalForm.fill(DUMMY_EMAIL);
    const submitBtns = page.locator('button[type="submit"]');
    const count = await submitBtns.count();
    if (count > 0) {
      await submitBtns.last().click();
      console.log("  → Survey 送信完了（フォールバック）");
      await page.waitForTimeout(1_500);
      return true;
    }
  }

  return false;
}

// ──────────────────────────────────────────────
// テストスイート 1: 通常検索 × 全エリア
// 各テストは独立した browser context（localStorage リセット）
// ──────────────────────────────────────────────
test.describe("トラフィック生成 — 通常検索", () => {
  for (const area of AREAS) {
    test(`${area.name} を検索してシェアボタンをクリック`, async ({ page }) => {
      const url = `${BASE_URL}/?lat=${area.lat}&lng=${area.lng}`;
      console.log(`\n[${area.name}] ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded" });

      const ok = await waitForResults(page);
      if (!ok) {
        // 結果が取れなくても pageview は PostHog に記録されているのでスキップ扱い
        test.skip();
        return;
      }

      await clickShareButton(page);

      // PostHog キューがフラッシュされる時間を確保
      await page.waitForTimeout(1_500);

      console.log(`[${area.name}] 完了 ✓`);
    });
  }
});

// ──────────────────────────────────────────────
// テストスイート 2: 検索上限到達 → Survey 送信
// 同一 context で 2 回目の検索を実行し limit_reached を発火
// ──────────────────────────────────────────────
test.describe("トラフィック生成 — 上限到達 & Survey", () => {
  // 3 パターンを異なる context で試行（1 つ成功すれば十分）
  for (let attempt = 0; attempt < 3; attempt++) {
    test(`上限到達シナリオ #${attempt + 1}`, async ({ page }) => {
      // 1 回目の検索（成功）
      const area1 = AREAS[attempt % AREAS.length];
      console.log(`\n[Survey #${attempt + 1}] 1回目検索: ${area1.name}`);
      await page.goto(`${BASE_URL}/?lat=${area1.lat}&lng=${area1.lng}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForResults(page);
      await clickShareButton(page);
      await page.waitForTimeout(1_000);

      // 2 回目の検索（上限到達 → limit_reached イベント → PostHog Survey）
      const area2 = AREAS[(attempt + 3) % AREAS.length];
      console.log(`[Survey #${attempt + 1}] 2回目検索: ${area2.name}`);
      await page.goto(`${BASE_URL}/?lat=${area2.lat}&lng=${area2.lng}`, {
        waitUntil: "domcontentloaded",
      });

      // Survey ポップアップが現れるまで少し待機
      await page.waitForTimeout(3_000);

      const surveySent = await handleSurveyIfPresent(page);
      console.log(
        `[Survey #${attempt + 1}] Survey送信: ${surveySent ? "成功" : "ポップアップなし（上限未到達 or Survey表示なし）"}`
      );

      await page.waitForTimeout(1_500);
      console.log(`[Survey #${attempt + 1}] 完了 ✓`);
    });
  }
});

// ──────────────────────────────────────────────
// テストスイート 3: about ページの閲覧
// ──────────────────────────────────────────────
test("about ページを閲覧", async ({ page }) => {
  await page.goto(`${BASE_URL}/about`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  console.log("about ページ閲覧 ✓");
});
