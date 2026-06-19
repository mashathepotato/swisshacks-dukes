import { Holding } from "../../shared/domain";

export function subAssetWeights(holdings: Holding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + h.currentCHF, 0);
  const byClass: Record<string, number> = {};
  for (const h of holdings) {
    byClass[h.subAssetClass] = (byClass[h.subAssetClass] || 0) + h.currentCHF;
  }
  const weights: Record<string, number> = {};
  for (const k of Object.keys(byClass)) {
    weights[k] = total === 0 ? 0 : (byClass[k] / total) * 100;
  }
  return weights;
}
