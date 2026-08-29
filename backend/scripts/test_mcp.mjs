// ============================================================
// MCP サーバーのローカル検証スクリプト
//   1. dist/index.js をモック APIキー付きで起動
//   2. MCP SDK の SSE クライアントで接続
//   3. 認証（不正キー→拒否 / 正キー→許可）を確認
//   4. tools/list と各 tools/call を実行し、出典テキストの強制付与を検証
//
// 使い方: node scripts/test_mcp.mjs   （事前に npm run build 済みであること）
// ============================================================
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const PORT = 8787;
const BASE = `http://localhost:${PORT}`;
const TEST_KEY = "mkr_live_" + "a".repeat(48);
const FOOTER_SOURCE = "【データ出典】国土交通省 不動産情報ライブラリ";
const FOOTER_DISCLAIMER = "【免責事項】本データは参考情報です。";

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "✅ PASS" : "❌ FAIL"}  ${label}`);
  if (!cond) failures++;
}

function makeTransport(key) {
  const headers = key ? { Authorization: `Bearer ${key}` } : {};
  return new SSEClientTransport(new URL(`${BASE}/api/mcp/sse`), {
    requestInit: { headers },
    eventSourceInit: {
      fetch: (url, init) =>
        fetch(url, { ...init, headers: { ...(init?.headers || {}), ...headers } }),
    },
  });
}

async function main() {
  console.log("▶ starting backend (dist/index.js) ...");
  const server = spawn("node", ["dist/index.js"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development",
      MCP_TEST_API_KEY: TEST_KEY,
      MLIT_API_KEY: "", // 空 → ツールはモックデータで応答
      ALLOWED_ORIGINS: "http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`  [srv] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`  [srv] ${d}`));

  try {
    // ヘルスチェック待ち
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) break;
      } catch {}
      await sleep(250);
    }

    // ── Test 0: サーバー情報に「Web上限の10倍」の日次上限が出ている ──
    {
      const r = await fetch(`${BASE}/api/mcp`);
      const info = await r.json().catch(() => ({}));
      // FREE_DAILY_LIMIT(3) * 10 = 30 が動的に計算されていること
      check(
        `info: free daily tool-call limit is 30 (= web limit x10), got ${info?.dailyToolCallLimit?.free}`,
        info?.dailyToolCallLimit?.free === 30
      );
      check("info: pro limit is unlimited", info?.dailyToolCallLimit?.pro === "unlimited");
    }

    // ── Test 1: 認証なし → 401 ────────────────────────────────
    {
      const r = await fetch(`${BASE}/api/mcp/sse`);
      check("no API key → 401", r.status === 401);
    }

    // ── Test 2: 不正キー → 401、クライアント connect は失敗 ────
    {
      const client = new Client({ name: "test-bad", version: "1.0.0" });
      let rejected = false;
      try {
        await client.connect(makeTransport("mkr_live_" + "b".repeat(48)));
      } catch {
        rejected = true;
      }
      check("invalid API key → connect rejected", rejected);
      await client.close().catch(() => {});
    }

    // ── Test 3: 正キー → 接続成功 & tools/list ────────────────
    const client = new Client({ name: "test-ok", version: "1.0.0" });
    await client.connect(makeTransport(TEST_KEY));
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    check(
      `tools/list returns both tools (${names.join(", ")})`,
      names.length === 2 &&
        names.includes("get_real_estate_transactions") &&
        names.includes("get_area_hazard_info")
    );

    // ── Test 4: get_real_estate_transactions ─────────────────
    {
      const res = await client.callTool({
        name: "get_real_estate_transactions",
        arguments: { latitude: 35.681236, longitude: 139.767125, radius_meters: 2000 },
      });
      const text = res.content.map((c) => c.text).join("\n");
      check("transactions: response has text content", !!text);
      check("transactions: 出典テキストが付与されている", text.includes(FOOTER_SOURCE));
      check("transactions: 免責事項が付与されている", text.includes(FOOTER_DISCLAIMER));
      check("transactions: footer is at the very end", text.trimEnd().endsWith("公式情報を確認してください。"));
      console.log("   ─ sample output tail ─\n" + text.slice(-260).split("\n").map((l) => "     " + l).join("\n"));
    }

    // ── Test 5: get_area_hazard_info ────────────────────────
    {
      const res = await client.callTool({
        name: "get_area_hazard_info",
        arguments: { latitude: 34.693738, longitude: 135.502165 },
      });
      const text = res.content.map((c) => c.text).join("\n");
      check("hazard: 出典テキストが付与されている", text.includes(FOOTER_SOURCE));
      check("hazard: 免責事項が付与されている", text.includes(FOOTER_DISCLAIMER));
      check("hazard: JSON body contains flood/landslide keys", text.includes('"flood"') && text.includes('"landslide"'));
    }

    // ── Test 6: 存在しない sessionId への POST → 404 ─────────
    {
      const r = await fetch(`${BASE}/api/mcp/messages?sessionId=does-not-exist`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${TEST_KEY}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      });
      check("POST /messages with unknown sessionId → 404", r.status === 404);
    }

    await client.close().catch(() => {});
  } finally {
    server.kill("SIGKILL");
  }

  console.log(`\n${failures === 0 ? "🎉 ALL PASS" : `💥 ${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
