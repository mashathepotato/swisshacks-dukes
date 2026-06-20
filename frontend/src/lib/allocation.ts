// Allocation breakdowns over a mandate's real holdings — groups positions by
// asset class / sub-asset class / region and compares current vs the CSV target
// per sleeve and per holding. Pure + deterministic. Mirrors subAssetWeights'
// totaling style in ./portfolio.

import type { PHolding } from "./portfolio";

export type AllocDim = "assetClass" | "subAssetClass" | "region";

export interface AllocSleeve {
  key: string;
  currentCHF: number;
  targetCHF: number;
  currentPct: number;
  targetPct: number;
  deltaPct: number;   // currentPct - targetPct
}

export interface AllocBreakdown {
  dimension: AllocDim;
  totalCurrent: number;
  totalTarget: number;
  sleeves: AllocSleeve[];   // sorted desc by currentCHF
}

export const ALLOC_DIMS: { id: AllocDim; label: string }[] = [
  { id: "assetClass", label: "Asset class" },
  { id: "subAssetClass", label: "Sub-asset class" },
  { id: "region", label: "Region" },
];

export function allocationBy(holdings: PHolding[], dim: AllocDim): AllocBreakdown {
  const totalCurrent = holdings.reduce((s, h) => s + h.currentCHF, 0);
  const totalTarget = holdings.reduce((s, h) => s + h.targetCHF, 0);
  const cur: Record<string, number> = {};
  const tgt: Record<string, number> = {};
  for (const h of holdings) {
    const key = (h[dim] || "—").trim() || "—";
    cur[key] = (cur[key] || 0) + h.currentCHF;
    tgt[key] = (tgt[key] || 0) + h.targetCHF;
  }
  const sleeves: AllocSleeve[] = Object.keys(cur).map((key) => {
    const currentCHF = cur[key];
    const targetCHF = tgt[key] || 0;
    const currentPct = totalCurrent === 0 ? 0 : (currentCHF / totalCurrent) * 100;
    const targetPct = totalTarget === 0 ? 0 : (targetCHF / totalTarget) * 100;
    return { key, currentCHF, targetCHF, currentPct, targetPct, deltaPct: currentPct - targetPct };
  });
  sleeves.sort((a, b) => b.currentCHF - a.currentCHF);
  return { dimension: dim, totalCurrent, totalTarget, sleeves };
}

export interface HoldingRow extends PHolding {
  deltaCHF: number;   // currentCHF - targetCHF
  deltaPct: number;   // delta relative to target (0 if no target)
}

/** Holdings annotated with current-vs-target deltas, sorted desc by current value. */
export function holdingsWithTarget(holdings: PHolding[]): HoldingRow[] {
  return holdings
    .map((h) => {
      const deltaCHF = h.currentCHF - h.targetCHF;
      const deltaPct = h.targetCHF === 0 ? 0 : (deltaCHF / h.targetCHF) * 100;
      return { ...h, deltaCHF, deltaPct };
    })
    .sort((a, b) => b.currentCHF - a.currentCHF);
}
