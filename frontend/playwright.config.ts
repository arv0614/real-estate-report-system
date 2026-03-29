import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  workers: 3, // 並列ワーカー数
  reporter: [["list"], ["json", { outputFile: "playwright-results.json" }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    // ブラウザの新規コンテキストごとに localStorage をリセット（ゲスト制限回避）
    storageState: undefined,
    // ナビゲーション待機はネットワークがアイドル状態になるまで
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
