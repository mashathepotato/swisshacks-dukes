import { describe, it, expect } from "vitest";
import { rankBook, priorityFor, CONFLICT_WEIGHT } from "./priority";
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
