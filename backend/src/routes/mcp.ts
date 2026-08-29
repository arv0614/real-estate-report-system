import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "../config";
import {
  fetchTransactionPrices,
  fetchHazardInfo,
  getMockTransactionData,
  getMockHazardData,
  type TransactionRecord,
} from "../services/mlitApi";
import {
  authenticateMcpRequest,
  issueApiKeyForUid,
  revokeApiKeyForUid,
  verifyFirebaseUid,
  type McpUser,
} from "../services/mcpAuth";
import { checkAndIncrementMcpUsage } from "../services/mcpUsage";
import { FREE_DAILY_LIMIT } from "../constants/limits";

// @hono/node-server 経由で serve() すると c.env に生の Node
// IncomingMessage / ServerResponse が注入される。SSE はこれを直接使う。
type Bindings = HttpBindings;
const app = new Hono<{ Bindings: Bindings }>();

// ============================================================
// 法的コンプライアンス: 全ツールのレスポンス末尾に強制付与する文言
// オープンデータの単純な横流し（規約違反）を防ぐため、システム側で必ず結合する。
// ============================================================
const COMPLIANCE_FOOTER =
  "\n\n【データ出典】国土交通省 不動産情報ライブラリ\n" +
  "【免責事項】本データは参考情報です。実際の不動産取引等の際は公式情報を確認してください。";

/** ツール結果を text コンテンツ 1 件に整形し、必ず COMPLIANCE_FOOTER を付与する */
function withCompliance(payload: unknown): ToolResult {
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: `${body}${COMPLIANCE_FOOTER}` }] };
}

// ============================================================
// MCP 経由の利用回数制限（Free プランのみ）
// 制限値はハードコードせず、Web版の無料上限定数 FREE_DAILY_LIMIT を import し、
// その 10 倍を MCP の上限とする（Web が 3 回なら MCP は 30 回）。Pro は無制限。
// ============================================================
const MCP_FREE_DAILY_LIMIT = FREE_DAILY_LIMIT * 10;

/** 上限到達時に LLM へ返すテキスト（データは返さないため出典フッターは付けない） */
const MCP_RATE_LIMIT_MESSAGE =
  "【エラー】Mekiki Researchの1日のMCP呼び出し上限に達しました。無制限に利用するにはProプランへアップグレードしてください。";

/**
 * Free プランの日次上限を判定してカウントを進める。
 * 上限到達時は isError なツール結果を返す（呼び出し側はそれを return するだけ）。
 * 許可時は null を返す。
 */
async function enforceMcpQuota(user: McpUser): Promise<ToolResult | null> {
  const quota = await checkAndIncrementMcpUsage(user, MCP_FREE_DAILY_LIMIT);
  if (quota.allowed) return null;
  console.warn(
    `[MCP] daily limit reached: uid=${user.uid} plan=${user.plan} used=${quota.used}/${quota.limit}`
  );
  return { content: [{ type: "text", text: MCP_RATE_LIMIT_MESSAGE }], isError: true };
}

// ============================================================
// 集計ヘルパー
// ============================================================
function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** 取引レコード配列から統計サマリーを生成する */
function summarizeTransactions(records: TransactionRecord[], radiusMeters: number) {
  const prices = records.map((r) => r.tradePrice).filter((p) => p > 0);
  const unitPrices = records
    .map((r) => r.unitPrice)
    .filter((v): v is number => v !== null && v > 0);

  const typeKeys = Array.from(new Set(records.map((r) => r.type || "不明")));
  const byType = typeKeys.map((k) => {
    const rowsOfType = records.filter((r) => (r.type || "不明") === k);
    const u = rowsOfType
      .map((r) => r.unitPrice)
      .filter((v): v is number => v !== null && v > 0);
    return {
      type: k,
      count: rowsOfType.length,
      avgUnitPriceYenPerSqm: avg(u),
    };
  });

  return {
    query: {
      radiusMeters,
      note:
        "国土交通省 不動産情報ライブラリは市区町村単位で取引事例を返します。" +
        "radius_meters は目安であり、集計対象は指定地点を含む市区町村の直近5年分の取引です。",
    },
    totalTransactions: records.length,
    tradePriceYen: {
      average: avg(prices),
      median: median(prices),
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
    unitPriceYenPerSqm: {
      average: avg(unitPrices),
      median: median(unitPrices),
    },
    byType,
    sample: records.slice(0, 5).map((r) => ({
      type: r.type,
      district: r.districtName,
      tradePriceYen: r.tradePrice,
      unitPriceYenPerSqm: r.unitPrice,
      areaSqm: r.area,
      buildingYear: r.buildingYear,
      period: r.period,
    })),
  };
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  /** ツール実行がエラー（上限超過など）で終わったことを LLM に伝える MCP 標準フラグ */
  isError?: boolean;
};

/**
 * server.tool() の型推論（MCP SDK の zod v3/v4 互換ジェネリクス）が
 * TS2589「型のインスタンス化が深すぎる」を誘発するため、入力 shape と
 * ハンドラを緩めた型でラップして登録する薄いヘルパー。実行時挙動は同一で、
 * 引数の検証は SDK 側が inputShape に基づいて行う。
 */
function registerTool(
  server: McpServer,
  name: string,
  description: string,
  inputShape: Record<string, z.ZodTypeAny>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<ToolResult>
): void {
  const toolFn = server.tool.bind(server) as (
    n: string,
    d: string,
    s: Record<string, z.ZodTypeAny>,
    h: (args: unknown) => Promise<ToolResult>
  ) => void;
  toolFn(name, description, inputShape, handler);
}

// ============================================================
// MCP サーバー（接続ごとに 1 インスタンス生成）
// user は SSE 接続時に認証済みの本人。ツール実行時の利用回数判定に使う。
// ============================================================
function buildMcpServer(user: McpUser): McpServer {
  const server = new McpServer(
    { name: "mekiki-research-mlit", version: "1.0.0" },
    {
      instructions:
        "Mekiki Research が提供する、国土交通省 不動産情報ライブラリのデータツール。" +
        "緯度経度を指定して、周辺の不動産取引事例の集計と、洪水・土砂災害のハザード情報を取得できます。" +
        "すべての結果には出典（国土交通省 不動産情報ライブラリ）と免責事項が付与されます。",
    }
  );

  // ① 取引事例・平均単価
  const transactionsInputShape = {
    latitude: z.number().gte(-90).lte(90).describe("緯度（10進度）例: 35.681236"),
    longitude: z.number().gte(-180).lte(180).describe("経度（10進度）例: 139.767125"),
    radius_meters: z
      .number()
      .positive()
      .max(50000)
      .optional()
      .describe("参考半径（メートル）。既定 3000。国交省APIは市区町村単位のため目安値。"),
  };
  registerTool(
    server,
    "get_real_estate_transactions",
    "指定した緯度経度を含む市区町村における過去の不動産取引事例（直近5年分）を取得・集計し、" +
      "平均／中央値の取引価格・㎡単価、種類別の内訳、サンプルを返します。",
    transactionsInputShape,
    async ({ latitude, longitude, radius_meters }) => {
      const blocked = await enforceMcpQuota(user);
      if (blocked) return blocked;

      const radius = radius_meters ?? 3000;
      try {
        const useLiveApi = !!config.mlit.apiKey;
        const data = useLiveApi
          ? await fetchTransactionPrices(latitude, longitude)
          : getMockTransactionData(latitude, longitude);

        return withCompliance({
          location: { latitude, longitude },
          municipalityCode: data.cityCode,
          coveredYears: data.years,
          dataSource: useLiveApi ? "mlit-reinfolib-api" : "mock (MLIT_API_KEY 未設定)",
          ...summarizeTransactions(data.data ?? [], radius),
        });
      } catch (err) {
        console.error("[MCP] get_real_estate_transactions failed:", err);
        return withCompliance({
          error: "取引データの取得に失敗しました",
          detail: err instanceof Error ? err.message : String(err),
          location: { latitude, longitude },
        });
      }
    }
  );

  // ② ハザード情報（洪水浸水想定・土砂災害警戒区域）
  const hazardInputShape = {
    latitude: z.number().gte(-90).lte(90).describe("緯度（10進度）例: 35.681236"),
    longitude: z.number().gte(-180).lte(180).describe("経度（10進度）例: 139.767125"),
  };
  registerTool(
    server,
    "get_area_hazard_info",
    "指定した緯度経度における洪水浸水想定区域および土砂災害警戒区域の該当有無・想定浸水深・現象種別を返します。",
    hazardInputShape,
    async ({ latitude, longitude }) => {
      const blocked = await enforceMcpQuota(user);
      if (blocked) return blocked;

      try {
        const useLiveApi = !!config.mlit.apiKey;
        const h = useLiveApi
          ? await fetchHazardInfo(latitude, longitude)
          : getMockHazardData();

        return withCompliance({
          location: { latitude, longitude },
          dataSource: useLiveApi ? "mlit-reinfolib-api" : "mock (MLIT_API_KEY 未設定)",
          flood: {
            hasRisk: h.flood.hasRisk,
            maxDepthRank: h.flood.maxDepthRank,
            maxDepthLabel: h.flood.maxDepthLabel,
            summary: h.flood.hasRisk
              ? `洪水浸水想定区域に該当します（想定最大浸水深: ${h.flood.maxDepthLabel ?? "不明"}）。`
              : "提供データの範囲では、この地点は洪水浸水想定区域に含まれていません。",
          },
          landslide: {
            hasRisk: h.landslide.hasRisk,
            phenomena: h.landslide.phenomena,
            summary: h.landslide.hasRisk
              ? `土砂災害警戒区域に該当します（現象: ${
                  h.landslide.phenomena.join("、") || "不明"
                }）。`
              : "提供データの範囲では、この地点は土砂災害警戒区域に含まれていません。",
          },
        });
      } catch (err) {
        console.error("[MCP] get_area_hazard_info failed:", err);
        return withCompliance({
          error: "ハザード情報の取得に失敗しました",
          detail: err instanceof Error ? err.message : String(err),
          location: { latitude, longitude },
        });
      }
    }
  );

  return server;
}

// ============================================================
// トランスポート管理
// SSE 接続（= 認証済みセッション）を sessionId で保持する。
// ============================================================
const transports = new Map<string, SSEServerTransport>();

// @hono/node-server の内部規約: レスポンスヘッダにこのキーが存在すると
// 「生 ServerResponse で送信済み」と解釈され、Hono 側は何も書き込まない。
const ALREADY_SENT = { "x-hono-already-sent": "true" } as const;

// ------------------------------------------------------------
// GET /api/mcp  — サーバー情報（認証不要・デバッグ用）
// ------------------------------------------------------------
app.get("/", (c) =>
  c.json({
    service: "Mekiki Research MCP Server",
    protocol: "mcp",
    transport: "sse",
    endpoints: {
      sse: "GET /api/mcp/sse",
      messages: "POST /api/mcp/messages?sessionId=<id>",
      issueApiKey: "POST /api/mcp/api-key  (Authorization: Bearer <Firebase ID Token>)",
    },
    auth: "Authorization: Bearer <API_KEY>  — Free / Pro プランのみ接続可",
    tools: ["get_real_estate_transactions", "get_area_hazard_info"],
    dailyToolCallLimit: {
      free: MCP_FREE_DAILY_LIMIT, // Web版無料上限（FREE_DAILY_LIMIT）の 10 倍
      pro: "unlimited",
    },
    activeSessions: transports.size,
  })
);

// ------------------------------------------------------------
// GET /api/mcp/sse  — SSE ストリーム確立
// ------------------------------------------------------------
app.get("/sse", async (c) => {
  const auth = await authenticateMcpRequest(c.req.header("authorization"));
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  const { outgoing } = c.env;
  const transport = new SSEServerTransport("/api/mcp/messages", outgoing);
  transports.set(transport.sessionId, transport);
  console.log(
    `[MCP] SSE connected: session=${transport.sessionId} uid=${auth.user.uid} plan=${auth.user.plan}`
  );

  const cleanup = () => {
    if (transports.delete(transport.sessionId)) {
      console.log(`[MCP] SSE closed: session=${transport.sessionId}`);
    }
  };
  transport.onclose = cleanup;
  outgoing.on("close", cleanup);

  const server = buildMcpServer(auth.user);
  try {
    // connect() が transport.start() を呼び、200 + text/event-stream ヘッダを書き出す
    await server.connect(transport);
  } catch (err) {
    console.error("[MCP] server.connect failed:", err);
    cleanup();
    if (!outgoing.headersSent) {
      return c.json({ error: "Failed to establish MCP session" }, 500);
    }
  }

  return new Response(null, { headers: ALREADY_SENT });
});

// ------------------------------------------------------------
// POST /api/mcp/messages?sessionId=<id>  — クライアント→サーバーのメッセージ受信
// ------------------------------------------------------------
app.post("/messages", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: "sessionId query parameter is required" }, 400);
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json(
      { error: "No active MCP session for this sessionId. (Re)connect to /api/mcp/sse first." },
      404
    );
  }

  // Authorization ヘッダがあれば再検証する。
  // 一部の MCP クライアントは POST に Authorization を付けないため、
  // その場合は SSE 接続時に認証済みの sessionId（推測不能な UUID）を信頼する。
  const authHeader = c.req.header("authorization");
  if (authHeader) {
    const auth = await authenticateMcpRequest(authHeader);
    if (!auth.ok) return c.json({ error: auth.message }, auth.status);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { incoming, outgoing } = c.env;
  await transport.handlePostMessage(incoming, outgoing, parsedBody);
  return new Response(null, { headers: ALREADY_SENT });
});

// ------------------------------------------------------------
// POST /api/mcp/api-key  — ログイン済みユーザーが自分の MCP APIキーを発行/ローテーション
// DELETE /api/mcp/api-key — 失効
// 認証: Authorization: Bearer <Firebase ID Token>
// ------------------------------------------------------------
app.post("/api-key", async (c) => {
  const v = await verifyFirebaseUid(c.req.header("authorization"));
  if (!v.ok) return c.json({ error: v.message }, v.status);

  const result = await issueApiKeyForUid(v.uid).catch((err) => {
    console.error("[MCP] issueApiKey failed:", err);
    return null;
  });
  if (!result) return c.json({ error: "Failed to issue API key" }, 500);
  if (!result.ok) return c.json({ error: result.message }, result.status);

  return c.json({
    apiKey: result.apiKey,
    prefix: result.prefix,
    warning: "このキーは再表示できません。安全な場所に保管してください。",
    usage: {
      sseEndpoint: "/api/mcp/sse",
      header: `Authorization: Bearer ${result.apiKey}`,
    },
  });
});

app.delete("/api-key", async (c) => {
  const v = await verifyFirebaseUid(c.req.header("authorization"));
  if (!v.ok) return c.json({ error: v.message }, v.status);
  await revokeApiKeyForUid(v.uid).catch((err) => {
    console.warn("[MCP] revokeApiKey (noop if unset):", err instanceof Error ? err.message : err);
  });
  return c.json({ ok: true });
});

export default app;
