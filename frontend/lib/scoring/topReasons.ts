import type { SeismicData } from "@/lib/research/seismicApi";
import type { PopulationData } from "@/lib/research/populationApi";

// ── Thresholds ────────────────────────────────────────────────────────────────

export const TOP_REASONS_THRESHOLDS = {
  market: { good: 0.03, bad: 0.10 },
  seismic: { good: 0.15, bad: 0.30 },  // prob30
  population: { good: 0.01, bad: -0.03 }, // annual trend
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopReason {
  sentiment: "good" | "bad";
  category: "market" | "disaster" | "future";
  textJa: string;
  textEn: string;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Core logic ────────────────────────────────────────────────────────────────

export function calcTopReasons(
  inputPrice: number,
  similarPrices: number[],
  seismic: SeismicData | null,
  population: PopulationData | null
): TopReason[] {
  const candidates: TopReason[] = [];
  const T = TOP_REASONS_THRESHOLDS;

  // Market
  if (similarPrices.length >= 5 && inputPrice > 0) {
    const med = median(similarPrices);
    if (med > 0) {
      const diff = (inputPrice - med) / med;
      const pct = Math.round(Math.abs(diff) * 100);
      if (diff <= -T.market.good) {
        candidates.push({
          sentiment: "good",
          category: "market",
          textJa: `相場より ${pct}% 安い`,
          textEn: `${pct}% below market median`,
        });
      } else if (diff >= T.market.bad) {
        candidates.push({
          sentiment: "bad",
          category: "market",
          textJa: `相場より ${pct}% 高い`,
          textEn: `${pct}% above market median`,
        });
      }
    }
  }

  // Disaster (seismic prob30)
  if (seismic !== null) {
    const p = seismic.prob30;
    const pct = seismic.probPct;
    if (p < T.seismic.good) {
      candidates.push({
        sentiment: "good",
        category: "disaster",
        textJa: `地震リスク低い（30年確率 ${pct}%）`,
        textEn: `Low earthquake risk (30-yr probability ${pct}%)`,
      });
    } else if (p >= T.seismic.bad) {
      candidates.push({
        sentiment: "bad",
        category: "disaster",
        textJa: `地震リスク高い（30年確率 ${pct}%）`,
        textEn: `High earthquake risk (30-yr probability ${pct}%)`,
      });
    }
  }

  // Future (population trend)
  if (population !== null) {
    const t = population.trend;
    const pct = (Math.abs(t) * 100).toFixed(1);
    const sign = t >= 0 ? "+" : "−";
    if (t >= T.population.good) {
      candidates.push({
        sentiment: "good",
        category: "future",
        textJa: `人口増加傾向（年 ${sign}${pct}%）`,
        textEn: `Growing population (${sign}${pct}%/yr)`,
      });
    } else if (t <= T.population.bad) {
      candidates.push({
        sentiment: "bad",
        category: "future",
        textJa: `人口減少傾向（年 −${pct}%）`,
        textEn: `Declining population (−${pct}%/yr)`,
      });
    }
  }

  if (candidates.length === 0) return [];

  const goods = candidates.filter((c) => c.sentiment === "good");
  const bads  = candidates.filter((c) => c.sentiment === "bad");

  // Always include at least 1 bad if any exist; fill rest with goods; max 3 total
  const selected: TopReason[] = [];
  if (bads.length > 0) {
    selected.push(...bads.slice(0, Math.min(bads.length, 2)));
    const remaining = 3 - selected.length;
    selected.unshift(...goods.slice(0, remaining)); // goods first
  } else {
    selected.push(...goods.slice(0, 3));
  }

  return selected;
}
