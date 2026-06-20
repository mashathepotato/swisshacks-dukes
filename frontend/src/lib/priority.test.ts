import { describe, it, expect } from "vitest";
import { rankBook, priorityFor, CONFLICT_WEIGHT, PRIORITY_WEIGHTS } from "./priority";
import type { Client, NewsSignal } from "../types";

function signal(over: Partial<NewsSignal>): NewsSignal {
  return {
    id: "s",
    headline: "h",
    source: "src",
    publishedAt: "2026-06-18",
    summary: "",
    type: "opportunity",
    severity: 10,
    matchedHoldings: [],
    ...over,
  };
}

function client(id: string, signals: NewsSignal[], amountAtStake = 1_000_000): Client {
  return {
    id,
    name: id,
    archetype: "x",
    isPersona: false,
    mandate: "Growth",
    tenureYears: 3,
    riskProfile: "Moderate",
    commStyle: "—",
    values: [],
    dislikes: [],
    affinities: [],
    priorityScore: 0,
    topReason: "",
    signals,
    recommendations: [],
    topHoldings: [],
    amountAtStake,
  };
}

describe("priority — market anomaly as a weighted driver", () => {
  it("registers market_anomaly in the conflict-weight table, just below value/reputational risks", () => {
    expect(CONFLICT_WEIGHT.market_anomaly).toBe(0.85);
    expect(CONFLICT_WEIGHT.market_anomaly).toBeLessThan(CONFLICT_WEIGHT.value_conflict);
    expect(CONFLICT_WEIGHT.market_anomaly).toBeGreaterThan(CONFLICT_WEIGHT.mandate_drift);
  });

  it("selects the highest-severity signal as the active driver (not array order)", () => {
    // anomaly is listed AFTER a minor opportunity, but it must drive the score.
    const c = client("c", [
      signal({ type: "opportunity", severity: 15 }),
      signal({ type: "market_anomaly", severity: 90 }),
    ]);
    const pr = priorityFor(c, [c]);
    expect(pr.severity).toBeCloseTo(0.9, 5);
    expect(pr.conflict).toBe(0.85);
  });

  it("a fresh high-severity anomaly re-ranks a client above one with only a minor signal", () => {
    const withAnomaly = client("anom", [
      signal({ type: "opportunity", severity: 15 }),
      signal({ type: "market_anomaly", severity: 88, publishedAt: "2026-06-18" }),
    ]);
    const minor = client("minor", [signal({ type: "opportunity", severity: 20, publishedAt: "2026-06-18" })]);
    const ranked = rankBook([minor, withAnomaly]);
    expect(ranked[0].client.id).toBe("anom");
  });
});

function withMandate(c: Client, mandate: Client["mandate"]): Client {
  return { ...c, mandate };
}

describe("priority — anomaly is its own always-on term in the blend", () => {
  it("every mandate's weight vector sums to 1 and includes an anomaly term", () => {
    for (const m of ["Defensive", "Balanced", "Growth"] as const) {
      const w = PRIORITY_WEIGHTS[m];
      expect(w.anomaly).toBeGreaterThan(0);
      expect(w.severity + w.exposure + w.conflict + w.recency + w.anomaly).toBeCloseTo(1, 10);
    }
  });

  it("weights the anomaly more for Defensive than Growth (strategy-aware)", () => {
    expect(PRIORITY_WEIGHTS.Defensive.anomaly).toBeGreaterThan(PRIORITY_WEIGHTS.Balanced.anomaly);
    expect(PRIORITY_WEIGHTS.Balanced.anomaly).toBeGreaterThan(PRIORITY_WEIGHTS.Growth.anomaly);
  });

  it("the SAME secondary market move adds more score to a Defensive client than a Growth client", () => {
    // A dominant reputational event stays the active driver for both; the market
    // move is secondary, so its marginal contribution is purely the anomaly term.
    const lead = signal({ type: "reputational", severity: 95, publishedAt: "2026-06-18" });
    const move = signal({ type: "market_anomaly", severity: 70, publishedAt: "2026-06-18" });
    const marginal = (mandate: Client["mandate"]) => {
      const without = withMandate(client("a", [lead]), mandate);
      const withMove = withMandate(client("a", [lead, move]), mandate);
      const book = [without, withMove];
      return priorityFor(withMove, book).combined - priorityFor(without, book).combined;
    };
    expect(marginal("Defensive")).toBeGreaterThan(marginal("Growth"));
    expect(marginal("Defensive")).toBeCloseTo(0.24 * 0.7, 5);
    expect(marginal("Growth")).toBeCloseTo(0.1 * 0.7, 5);
  });

  it("a SECONDARY market move (not the top signal) still contributes to the score", () => {
    // The dominant event is a reputational hit; the market move is secondary.
    const base = [signal({ type: "reputational", severity: 90, publishedAt: "2026-06-18" })];
    const without = client("without", base);
    const withMove = client("withmove", [
      ...base,
      signal({ type: "market_anomaly", severity: 80, publishedAt: "2026-06-18" }),
    ]);
    const a = priorityFor(without, [without, withMove]);
    const b = priorityFor(withMove, [without, withMove]);
    // The active (severity/conflict) driver is identical; only the anomaly term differs.
    expect(a.anomaly).toBe(0);
    expect(b.anomaly).toBeCloseTo(0.8, 5);
    expect(b.combined).toBeGreaterThan(a.combined);
  });
});
