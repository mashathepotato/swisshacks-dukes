import { describe, it, expect } from "vitest";
import { attachAnomalies } from "./attachAnomalies";
import type { InstrumentSeries } from "./anomaly";
import type { Client, Mandate, NewsSignal } from "../types";

// A series with a clear −15% shock on the last bar so the detector fires.
function shockSeries(isin: string, issuer: string): InstrumentSeries {
  const bars = [];
  for (let i = 0; i < 34; i++) bars.push({ date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`, close: 100, volume: 1000, hvol30: 20 });
  bars.push({ date: "2026-06-18", close: 85, volume: 1500, hvol30: 20 });
  return { isin, issuer, listingId: `1_XTST`, source: "six", asOf: "2026-06-18", bars };
}

function client(id: string, mandate: Mandate, signals: NewsSignal[] = []): Client {
  return {
    id, name: id, archetype: "x", isPersona: false, mandate, tenureYears: 3,
    riskProfile: "Moderate", commStyle: "—", values: [], dislikes: [], affinities: [],
    priorityScore: 0, topReason: "", signals, recommendations: [], topHoldings: [],
  };
}

const holdingsFor = (m: Mandate) =>
  m === "Growth" ? [{ isin: "MOVED00001", issuer: "Moved Co.", currentCHF: 120_000 }] : [];

describe("attachAnomalies", () => {
  const series = [shockSeries("MOVED00001", "Moved Co.")];

  it("attaches a market_anomaly signal to clients holding the moved instrument", () => {
    const [g] = attachAnomalies([client("g", "Growth")], series, holdingsFor);
    const anom = g.signals.find((s) => s.type === "market_anomaly");
    expect(anom).toBeTruthy();
    expect(anom!.matchedHoldings).toContain("Moved Co.");
  });

  it("does NOT attach to clients whose mandate doesn't hold it", () => {
    const [d] = attachAnomalies([client("d", "Defensive")], series, holdingsFor);
    expect(d.signals.some((s) => s.type === "market_anomaly")).toBe(false);
  });

  it("orders signals so the most severe drives the queue (signals[0])", () => {
    const minor: NewsSignal = {
      id: "m", headline: "minor", source: "x", publishedAt: "2026-06-01",
      summary: "", type: "opportunity", severity: 10, matchedHoldings: [],
    };
    const [g] = attachAnomalies([client("g", "Growth", [minor])], series, holdingsFor);
    expect(g.signals[0].type).toBe("market_anomaly");
    expect(g.signals[0].severity).toBeGreaterThan(10);
  });

  it("leaves the input clients untouched (pure)", () => {
    const input = client("g", "Growth");
    attachAnomalies([input], series, holdingsFor);
    expect(input.signals.length).toBe(0);
  });
});
