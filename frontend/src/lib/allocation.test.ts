import { describe, it, expect } from "vitest";
import { allocationBy, holdingsWithTarget } from "./allocation";
import { PORTFOLIOS } from "../data/portfolio";

const defensive = PORTFOLIOS.Defensive;

describe("allocationBy", () => {
  it("current percentages sum to ~100 across sleeves", () => {
    const a = allocationBy(defensive, "assetClass");
    const sum = a.sleeves.reduce((s, x) => s + x.currentPct, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("sorts sleeves descending by current value", () => {
    const a = allocationBy(defensive, "subAssetClass");
    const vals = a.sleeves.map((s) => s.currentCHF);
    expect(vals).toEqual([...vals].sort((x, y) => y - x));
  });

  it("groups by region with deltaPct = currentPct - targetPct", () => {
    const a = allocationBy(defensive, "region");
    expect(a.sleeves.length).toBeGreaterThan(0);
    for (const s of a.sleeves) {
      expect(s.deltaPct).toBeCloseTo(s.currentPct - s.targetPct, 6);
    }
  });
});

describe("holdingsWithTarget", () => {
  it("annotates each holding with deltaCHF = current - target", () => {
    const rows = holdingsWithTarget(defensive);
    expect(rows.length).toBe(defensive.length);
    for (const r of rows) {
      expect(r.deltaCHF).toBeCloseTo(r.currentCHF - r.targetCHF, 2);
    }
  });

  it("is sorted descending by current value", () => {
    const rows = holdingsWithTarget(defensive);
    const vals = rows.map((r) => r.currentCHF);
    expect(vals).toEqual([...vals].sort((x, y) => y - x));
  });
});
