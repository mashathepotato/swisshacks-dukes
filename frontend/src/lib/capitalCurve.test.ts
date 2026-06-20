import { describe, it, expect } from "vitest";
import { buildCapitalCurve } from "./capitalCurve";
import { PORTFOLIOS } from "../data/portfolio";

const valueOf = (m: "Defensive" | "Balanced" | "Growth") =>
  PORTFOLIOS[m].reduce((s, h) => s + h.currentCHF, 0);

describe("buildCapitalCurve", () => {
  it("produces date-ordered points", () => {
    const c = buildCapitalCurve("Defensive", valueOf("Defensive"));
    expect(c.points.length).toBeGreaterThan(1);
    const dates = c.points.map((p) => p.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
  });

  it("accumulates realised income monotonically (coupons add, fees are rare)", () => {
    const c = buildCapitalCurve("Defensive", valueOf("Defensive"));
    expect(c.incomeNowCHF).toBeGreaterThan(0);
    expect(c.points[c.points.length - 1].cumIncomeCHF).toBe(c.incomeNowCHF);
  });

  it("net invested capital ends positive (deposits exceed withdrawals)", () => {
    const c = buildCapitalCurve("Balanced", valueOf("Balanced"));
    expect(c.investedNowCHF).toBeGreaterThan(0);
  });

  it("reports the passed current holdings value as the endpoint", () => {
    const v = valueOf("Growth");
    const c = buildCapitalCurve("Growth", v);
    expect(c.currentValueCHF).toBe(Math.round(v));
  });

  it("is deterministic", () => {
    const v = valueOf("Defensive");
    expect(buildCapitalCurve("Defensive", v)).toEqual(buildCapitalCurve("Defensive", v));
  });
});
