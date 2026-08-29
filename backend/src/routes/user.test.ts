import { computeUsage } from "./user";
import { FREE_DAILY_LIMIT, MCP_FREE_DAILY_LIMIT } from "../constants/limits";

const TODAY = "2026-08-29";

describe("computeUsage", () => {
  it("free user with today's counts: reports used / limit / remaining / total", () => {
    const r = computeUsage(
      {
        plan: "free",
        dailySearchCount: 1,
        lastSearchDate: TODAY,
        totalSearchCount: 42,
        mcpDailyCount: 5,
        mcpLastCallDate: TODAY,
        mcpTotalCount: 118,
      },
      TODAY
    );
    expect(r.plan).toBe("free");
    expect(r.web).toEqual({
      used: 1,
      limit: FREE_DAILY_LIMIT,
      unlimited: false,
      remaining: FREE_DAILY_LIMIT - 1,
      total: 42,
    });
    expect(r.mcp).toEqual({
      used: 5,
      limit: MCP_FREE_DAILY_LIMIT,
      unlimited: false,
      remaining: MCP_FREE_DAILY_LIMIT - 5,
      total: 118,
    });
  });

  it("stale date -> today's counts reset to 0 but cumulative total stays", () => {
    const r = computeUsage(
      {
        plan: "free",
        dailySearchCount: 3,
        lastSearchDate: "2026-08-28",
        totalSearchCount: 10,
        mcpDailyCount: 30,
        mcpLastCallDate: "2026-08-28",
        mcpTotalCount: 200,
      },
      TODAY
    );
    expect(r.web.used).toBe(0);
    expect(r.mcp.used).toBe(0);
    expect(r.web.remaining).toBe(FREE_DAILY_LIMIT);
    expect(r.mcp.remaining).toBe(MCP_FREE_DAILY_LIMIT);
    expect(r.web.total).toBe(10);
    expect(r.mcp.total).toBe(200);
  });

  it("missing fields -> used 0, total 0, free limits", () => {
    const r = computeUsage({}, TODAY);
    expect(r.plan).toBe("free");
    expect(r.web).toEqual({ used: 0, limit: FREE_DAILY_LIMIT, unlimited: false, remaining: FREE_DAILY_LIMIT, total: 0 });
    expect(r.mcp).toEqual({ used: 0, limit: MCP_FREE_DAILY_LIMIT, unlimited: false, remaining: MCP_FREE_DAILY_LIMIT, total: 0 });
  });

  it("pro user -> unlimited flag, remaining null, used & total still surfaced", () => {
    const r = computeUsage(
      {
        plan: "pro",
        dailySearchCount: 12,
        lastSearchDate: TODAY,
        totalSearchCount: 999,
        mcpDailyCount: 400,
        mcpLastCallDate: TODAY,
        mcpTotalCount: 5000,
      },
      TODAY
    );
    expect(r.plan).toBe("pro");
    expect(r.web.unlimited).toBe(true);
    expect(r.mcp.unlimited).toBe(true);
    expect(r.web.remaining).toBeNull();
    expect(r.mcp.remaining).toBeNull();
    expect(r.web.used).toBe(12);
    expect(r.mcp.used).toBe(400);
    expect(r.web.total).toBe(999);
    expect(r.mcp.total).toBe(5000);
  });

  it("over-limit free user -> remaining clamped at 0 (never negative)", () => {
    const r = computeUsage(
      { plan: "free", mcpDailyCount: 55, mcpLastCallDate: TODAY },
      TODAY
    );
    expect(r.mcp.used).toBe(55);
    expect(r.mcp.remaining).toBe(0);
  });
});
