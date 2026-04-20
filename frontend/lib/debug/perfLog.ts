export function perfLog(label: string, ms: number, extra?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[perf] ${label}: ${Math.round(ms)}ms`, extra ?? "");
}
