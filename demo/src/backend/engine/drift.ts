import { DriftBreach, Holding, Mandate, StrategyTarget } from "../../shared/domain";
import { subAssetWeights } from "./weights";

const targetFor = (t: StrategyTarget, mandate: Mandate): number =>
  mandate === "Defensive" ? t.defPct : mandate === "Growth" ? t.growthPct : t.balancedPct;

export { subAssetWeights };

export function computeDrift(
  holdings: Holding[],
  targets: StrategyTarget[],
  mandate: Mandate
): DriftBreach[] {
  const weights = subAssetWeights(holdings);
  return targets
    .filter((t) => weights[t.subAssetClass] !== undefined || targetFor(t, mandate) > 0)
    .map((t) => {
      const currentPct = weights[t.subAssetClass] || 0;
      const targetPct = targetFor(t, mandate);
      const deltaPct = currentPct - targetPct;
      return {
        subAssetClass: t.subAssetClass,
        targetPct,
        currentPct,
        deltaPct,
        breached: Math.abs(deltaPct) > 2.0,
      };
    });
}
