import { computeUsage } from "./user";
import { FREE_DAILY_LIMIT, MCP_FREE_DAILY_LIMIT } from "../constants/limits";

const TODAY = "2026-08-29";

describe("computeUsage", () => {
  it("free user with today's counts: reports used / limit / remaining", () => {
    const r = computeUsage(
      {
        plan: "free",
        dailySearchCount: 1,
        lastSearchDate: TODAY,
        mcpDailyCount: 5,
        mcpLastCallDate: TODAY,
      },
      TODAY
    );
    expect(r.plan).toBe("free");
    expect(r.web).toEqual({ used: 1, limit: FREE_DAILY_LIMIT, unlimited: false, remaining: FREE_DAILY_LIMIT - 1 });
    expect(r.mcp).toEqual({ used: 5, limit: MCP_FREE_DAILY_LIMIT, unlimited: false, remaining: MCP_FREE_DAILY_LIMIT - 5 });
  });

  it("stale date -> counts reset to 0", () => {
    const r = computeUsage(
      { plan: "free", dailySearchCount: 3, lastSearchDate: "2026-08-28", mcpDailyCount: 30, mcpLastCallDate: "2026-08-28" },
      TODAY
    );
    expect(r.web.used).toBe(0);
    expect(r.mcp.used).toBe(0);
    expect(r.web.remaining).toBe(FREE_DAILY_LIMIT);
    expect(r.mcp.remaining).toBe(MCP_FREE_DAILY_LIMIT);
  });

  it("missing fields -> used 0, free limits", () => {
    const r = computeUsage({}, TODAY);
    expect(r.plan).toBe("free");
    expect(r.web).toEqual({ used: 0, limit: FREE_DAILY_LIMIT, unlimited: false, remaining: FREE_DAILY_LIMIT });
    expect(r.mcp).toEqual({ used: 0, limit: MCP_FREE_DAILY_LIMIT, unlimited: false, remaining: MCP_FREE_DAILY_LIMIT });
  });

  it("pro user -> unlimited flag, remaining null, counts still surfaced", () => {
    const r = computeUsage(
      { plan: "pro", dailySearchCount: 12, lastSearchDate: TODAY, mcpDailyCount: 400, mcpLastCallDate: TODAY },
      TODAY
    );
    expect(r.plan).toBe("pro");
    expect(r.web.unlimited).toBe(true);
    expect(r.mcp.unlimited).toBe(true);
    expect(r.web.remaining).toBeNull();
    expect(r.mcp.remaining).toBeNull();
    expect(r.web.used).toBe(12);
    expect(r.mcp.used).toBe(400);
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
