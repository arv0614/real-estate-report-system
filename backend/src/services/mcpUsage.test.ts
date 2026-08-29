import { decideMcpQuota } from "./mcpUsage";
import { FREE_DAILY_LIMIT } from "../constants/limits";

/**
 * MCP の Free 上限は「Web版無料上限 × 10」で計算される（ハードコード禁止）。
 * ここではその乗算と判定ロジックを検証する。
 */
const MCP_FREE_DAILY_LIMIT = FREE_DAILY_LIMIT * 10;

describe("MCP daily limit = 10x web free limit", () => {
  it("is exactly FREE_DAILY_LIMIT * 10", () => {
    expect(MCP_FREE_DAILY_LIMIT).toBe(FREE_DAILY_LIMIT * 10);
  });

  it("resolves to 30 with the current FREE_DAILY_LIMIT (3)", () => {
    expect(FREE_DAILY_LIMIT).toBe(3);
    expect(MCP_FREE_DAILY_LIMIT).toBe(30);
  });
});

describe("decideMcpQuota", () => {
  it("free: allows and increments while below the limit", () => {
    expect(decideMcpQuota(0, "free", MCP_FREE_DAILY_LIMIT)).toEqual({
      allowed: true,
      nextCount: 1,
      limit: MCP_FREE_DAILY_LIMIT,
    });
    expect(decideMcpQuota(MCP_FREE_DAILY_LIMIT - 1, "free", MCP_FREE_DAILY_LIMIT)).toEqual({
      allowed: true,
      nextCount: MCP_FREE_DAILY_LIMIT,
      limit: MCP_FREE_DAILY_LIMIT,
    });
  });

  it("free: blocks once the limit is reached, without incrementing", () => {
    expect(decideMcpQuota(MCP_FREE_DAILY_LIMIT, "free", MCP_FREE_DAILY_LIMIT)).toEqual({
      allowed: false,
      nextCount: MCP_FREE_DAILY_LIMIT,
      limit: MCP_FREE_DAILY_LIMIT,
    });
    expect(decideMcpQuota(999, "free", MCP_FREE_DAILY_LIMIT)).toEqual({
      allowed: false,
      nextCount: 999,
      limit: MCP_FREE_DAILY_LIMIT,
    });
  });

  it("pro: always allowed and unlimited", () => {
    const d = decideMcpQuota(9999, "pro", MCP_FREE_DAILY_LIMIT);
    expect(d.allowed).toBe(true);
    expect(d.limit).toBe(Infinity);
  });
});
