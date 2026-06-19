import { test, expect } from "vitest";
import { subAssetWeights, computeDrift } from "./drift";
import { Holding, StrategyTarget } from "../../shared/domain";
import { loadPortfolio, loadStrategies } from "../data/loaders";

const h = (subAssetClass: string, currentCHF: number): Holding => ({
  isin: "X" + currentCHF, issuer: "x", assetClass: "Equities", subAssetClass,
  region: "", industryGroup: "", targetCHF: currentCHF, currentCHF,
  valor: "", mic: "", yahoo: "",
});

test("subAssetWeights sums to 100 and splits by class", () => {
  const w = subAssetWeights([h("A", 30), h("A", 30), h("B", 40)]);
  expect(w["A"]).toBeCloseTo(60, 5);
  expect(w["B"]).toBeCloseTo(40, 5);
});

test("computeDrift flags a >2.0pp deviation and not a <2.0pp one", () => {
  const holdings = [h("A", 130), h("B", 70)]; // A=65%, B=35%
  const targets: StrategyTarget[] = [
    { subAssetClass: "A", defPct: 0, balancedPct: 60, growthPct: 0 }, // delta +5 -> breach
    { subAssetClass: "B", defPct: 0, balancedPct: 36, growthPct: 0 }, // delta -1 -> ok
  ];
  const drift = computeDrift(holdings, targets, "Balanced");
  const a = drift.find((d) => d.subAssetClass === "A")!;
  const b = drift.find((d) => d.subAssetClass === "B")!;
  expect(a.breached).toBe(true);
  expect(a.deltaPct).toBeCloseTo(5, 5);
  expect(b.breached).toBe(false);
});

test("real Balanced portfolio has at least one drift breach", () => {
  const drift = computeDrift(loadPortfolio("Balanced"), loadStrategies(), "Balanced");
  expect(drift.some((d) => d.breached)).toBe(true);
});
