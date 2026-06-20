import { describe, it, expect } from "vitest";
import { behavioralForClient, deriveBehavioralDNA, tradesForIsin, tradeReceipts } from "./behavioral";

describe("behavioralForClient", () => {
  it("returns [] for a synthetic twin (no PERSONA_PLAY entry)", () => {
    expect(behavioralForClient("nguyen")).toEqual([]);
    expect(behavioralForClient("does-not-exist")).toEqual([]);
  });

  it("derives traits for a persona, each with a verbatim receipt", () => {
    const traits = behavioralForClient("ammann"); // Growth
    expect(traits.length).toBeGreaterThan(0);
    expect(traits.length).toBeLessThanOrEqual(4);
    for (const t of traits) {
      expect(t.receipt.quote.length).toBeGreaterThan(0);
      expect(t.receipt.kind).toBe("market");
    }
  });

  it("is deterministic — same input, same output", () => {
    expect(behavioralForClient("schneider")).toEqual(behavioralForClient("schneider"));
  });
});

describe("deriveBehavioralDNA", () => {
  it("surfaces the income trait for the coupon-heavy Defensive book", () => {
    const traits = deriveBehavioralDNA("Defensive");
    const income = traits.find((t) => t.id === "income_harvester");
    expect(income).toBeTruthy();
    expect(income!.detail).toMatch(/coupons/i);
  });

  it("ties the rebalance trait to the scenario ISIN when one is supplied", () => {
    // Adidas (Growth) has a 'Trim on rally' SELL — prefer that row.
    const traits = deriveBehavioralDNA("Growth", "DE000A1EWWW0");
    const rebal = traits.find((t) => t.id === "disciplined_rebalancer");
    if (rebal) expect(rebal.receipt.ref).toBe("DE000A1EWWW0");
  });
});

describe("tradeReceipts", () => {
  it("returns real SELL/BUY receipts for a held persona ISIN, newest first", () => {
    const recs = tradeReceipts("Growth", "DE000A1EWWW0");
    expect(recs.length).toBeGreaterThan(0);
    // sorted descending by date
    const dates = recs.map((r) => r.date!);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    expect(recs[0].ref).toBe("DE000A1EWWW0");
  });

  it("returns [] for an ISIN with no trades in that mandate", () => {
    expect(tradeReceipts("Growth", "NO-SUCH-ISIN")).toEqual([]);
  });

  it("respects the limit", () => {
    const all = tradesForIsin("Defensive", "CH0038863350");
    expect(all.length).toBeGreaterThan(0);
    expect(tradeReceipts("Defensive", "CH0038863350", 2).length).toBeLessThanOrEqual(2);
  });
});
