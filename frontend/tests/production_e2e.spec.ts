/**
 * 本番環境 E2E テスト — mekiki-research.com
 *
 * シナリオA: トップページ初期レンダリング
 * シナリオB: 静的ページ遷移（/about, /terms, /privacy, /licenses）
 * シナリオC: ゲスト検索 → 結果表示 → 上限到達 → WaitlistModal 表示
 */

import { test, expect, Page } from "@playwright/test";

const BASE = "https://mekiki-research.com";

// ゲストの localStorage キー（userPlan.ts の GUEST_SEARCH_KEY と一致させる）
const GUEST_STORAGE_KEY = "guest_last_search_date";

/**
 * ゲスト検索制限をリセット（新規コンテキストでは自動リセット）
 */
async function clearGuestLimit(page: Page) {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, GUEST_STORAGE_KEY);
}

// ────────────────────────────────────────────
// シナリオA: トップページ初期レンダリング
// ────────────────────────────────────────────
test.describe("シナリオA: トップページ", () => {
  test("HTTP 200 で応答し、主要UI要素が存在すること", async ({ page }) => {
    const response = await page.goto(BASE, { waitUntil: "domcontentloaded" });

    // HTTP ステータス
    expect(response?.status()).toBe(200);

    // ロゴ画像
    await expect(page.locator('img[src="/logo_mekiki_research.png"]').first()).toBeVisible();

    // タイトルテキスト
    await expect(page.getByText("物件目利きリサーチ").first()).toBeVisible();

    // 検索フォームの存在（住所入力 or 緯度経度入力）
    await expect(page.getByPlaceholder(/住所・地名で検索/)).toBeVisible();
    await expect(page.locator("#lat")).toBeVisible();
    await expect(page.locator("#lng")).toBeVisible();

    // 「調査開始」ボタン
    await expect(page.getByRole("button", { name: /調査開始/ })).toBeVisible();

    // Guestバッジ（未ログイン）
    await expect(page.getByText("Guest")).toBeVisible();

    // フッター: 国交省クレジット
    await expect(page.getByText(/国土交通省「不動産情報ライブラリ」/)).toBeVisible();
  });

  test("<title> に 物件目利きリサーチ が含まれること", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/物件目利きリサーチ/);
  });
});

// ────────────────────────────────────────────
// シナリオB: 静的ページ遷移
// ────────────────────────────────────────────
test.describe("シナリオB: 静的ページ遷移", () => {
  const PAGES = [
    { path: "/about",    heading: /精密調査/ },
    { path: "/terms",    heading: /利用規約/ },
    { path: "/privacy",  heading: /プライバシーポリシー/ },
    { path: "/licenses", heading: /オープンソースライセンス/ },
  ];

  for (const { path, heading } of PAGES) {
    test(`${path} が 200 で表示されること`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });
  }

  test("フッターの利用規約リンクが /terms に遷移すること", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    // フッターの利用規約リンクをクリック
    await page.locator("footer").getByRole("link", { name: "利用規約" }).click();
    await page.waitForURL(`${BASE}/terms`, { timeout: 10_000 });
    expect(page.url()).toContain("/terms");
  });

  test("フッターのプライバシーポリシーリンクが /privacy に遷移すること", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator("footer").getByRole("link", { name: "プライバシーポリシー" }).click();
    await page.waitForURL(`${BASE}/privacy`, { timeout: 10_000 });
    expect(page.url()).toContain("/privacy");
  });
});

// ────────────────────────────────────────────
// シナリオC: ゲスト検索 → 結果 → WaitlistModal
// ────────────────────────────────────────────
test.describe("シナリオC: ゲスト検索フロー", () => {
  /**
   * 座標を設定して「診断開始」を押すヘルパー
   * 葛飾区（lat: 35.74, lng: 139.84）を使用
   */
  async function runSearch(page: Page) {
    await page.locator("#lat").fill("35.74");
    await page.locator("#lng").fill("139.84");
    await page.getByRole("button", { name: /調査開始/ }).click();
  }

  test("1回目の検索: 結果が表示されること", { timeout: 120_000 }, async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await clearGuestLimit(page);

    await runSearch(page);

    // ローディングスピナーが現れてから消えるのを待つ
    // 「データを取得中」or 結果 or エラーの何かが表示されるまで待機
    // 第2引数は pageFunction に渡す arg (不要なので undefined)、第3引数が options
    await page.waitForFunction(() => {
      const body = document.body.innerText;
      return (
        body.includes("対象エリア") ||
        body.includes("エラー") ||
        body.includes("取引価格") ||
        body.includes("サマリー")
      );
    }, undefined, { timeout: 90_000 });

    // 何らかのデータが返ってきていること（エリア情報 or サマリー）
    const hasResult =
      (await page.getByText(/対象エリア/).count()) > 0 ||
      (await page.getByText(/取引価格/).count()) > 0;
    expect(hasResult).toBe(true);
  });

  test("2回目の検索（上限超過）: WaitlistModal が表示されること", async ({ page }) => {
    // ゲスト制限を「本日すでに1回使用済み」に設定してからページを開く
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate((key) => {
      localStorage.setItem(key, new Date().toISOString().slice(0, 10));
    }, GUEST_STORAGE_KEY);
    // React が確実にハイドレート完了するよう Googleログインボタンが表示されるまで待つ
    await expect(page.getByRole("button", { name: /Googleでログイン/ })).toBeVisible({ timeout: 10_000 });

    await runSearch(page);

    // WaitlistModal が表示されること（最大5秒待機）
    await expect(
      page.getByText(/本日のゲスト無料調査枠/)
    ).toBeVisible({ timeout: 5_000 });

    // モーダルの入力フィールド
    await expect(page.getByPlaceholder("your@email.com")).toBeVisible();

    // 「今は登録しない」ボタンでモーダルが閉じること
    await page.getByRole("button", { name: /今は登録しない/ }).click();
    await expect(
      page.getByText(/本日のゲスト無料調査枠/)
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test("WaitlistModal の構造確認: 必要なUI要素が揃っていること", async ({ page }) => {
    // type="email" input はブラウザネイティブバリデーションが働くため、
    // React の setError テストはブラウザ環境では不可。代わりにUI構造を確認する。
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate((key) => {
      localStorage.setItem(key, new Date().toISOString().slice(0, 10));
    }, GUEST_STORAGE_KEY);
    await expect(page.getByRole("button", { name: /Googleでログイン/ })).toBeVisible({ timeout: 10_000 });

    await runSearch(page);

    // モーダルが開くこと
    const modal = page.getByText(/本日のゲスト無料調査枠/);
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // メール入力欄・送信ボタン・キャンセルボタンの3要素が揃っていること
    await expect(page.getByPlaceholder("your@email.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /先行案内に登録する/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /今は登録しない/ })).toBeVisible();

    // /about#pricing リンクが存在すること
    await expect(page.getByRole("link", { name: /料金プランを見る/ })).toBeVisible();
  });
});

// ────────────────────────────────────────────
// その他: OGP / メタデータ確認
// ────────────────────────────────────────────
test.describe("メタデータ・OGP", () => {
  test("トップページの og:title が設定されていること", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toBeTruthy();
    expect(ogTitle).toContain("物件目利きリサーチ");
  });

  test("/terms の <title> が正しいこと", async ({ page }) => {
    await page.goto(`${BASE}/terms`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/利用規約.*物件目利きリサーチ/);
  });

  test("/privacy の <title> が正しいこと", async ({ page }) => {
    await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/プライバシーポリシー.*物件目利きリサーチ/);
  });
});
