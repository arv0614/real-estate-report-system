// 五十音順で固定。特定サービスを先頭に置かない
export const SUPPORTED_SITES = [
  { id: "athome",   label: "アットホーム",  hostnames: ["athome.co.jp"] },
  { id: "kenbiya",  label: "健美家",         hostnames: ["kenbiya.com"] },
  { id: "homes",    label: "LIFULL HOME'S", hostnames: ["homes.co.jp"] },
  { id: "rakumachi",label: "楽待",           hostnames: ["rakumachi.jp"] },
  { id: "suumo",    label: "SUUMO",          hostnames: ["suumo.jp"] },
] as const;

export type SupportedSiteId = (typeof SUPPORTED_SITES)[number]["id"];

export function detectSiteId(url: string): SupportedSiteId | null {
  try {
    const { hostname } = new URL(url);
    const site = SUPPORTED_SITES.find((s) =>
      s.hostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`))
    );
    return site?.id ?? null;
  } catch {
    return null;
  }
}

export function siteLabel(id: SupportedSiteId | null): string {
  if (!id) return "";
  return SUPPORTED_SITES.find((s) => s.id === id)?.label ?? "";
}

/** カンマ区切りのサービス一覧文字列（説明文用） */
export const SUPPORTED_SITE_NAMES = SUPPORTED_SITES.map((s) => s.label).join(" / ");
