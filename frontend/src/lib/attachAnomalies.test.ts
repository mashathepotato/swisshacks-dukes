import { describe, it, expect } from "vitest";
import { attachAnomalies } from "./attachAnomalies";
import type { AnomalyEvent, InstrumentSeries } from "./anomaly";
import type { Client, NewsSignal } from "../types";

// A series with a clear −15% shock on the last bar so the detector fires.
function shockSeries(isin: string, issuer: string): InstrumentSeries {
  const bars = [];
  for (let i = 0; i < 34; i++) bars.push({ date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`, close: 100, volume: 1000, hvol30: 20 });
  bars.push({ date: "2026-06-18", close: 85, volume: 1500, hvol30: 20 });
  return { isin, issuer, listingId: `1_XTST`, source: "six", asOf: "2026-06-18", bars };
}

function client(id: string, signals: NewsSignal[] = []): Client {
  return {
    id, name: id, archetype: "x", isPersona: false, mandate: "Growth", tenureYears: 3,
    riskProfile: "Moderate", commStyle: "—", values: [], dislikes: [], affinities: [],
    priorityScore: 0, topReason: "", signals, recommendations: [], topHoldings: [],
  };
}

// Only client "holder" is exposed to the moved instrument.
const exposureOf = (c: Client, ev: AnomalyEvent) =>
  c.id === "holder" && ev.isin === "MOVED00001" ? 120_000 : null;

describe("attachAnomalies", () => {
  const series = [shockSeries("MOVED00001", "Moved Co.")];

  it("attaches a market_anomaly signal only to clients exposed to the moved instrument", () => {
    const [holder] = attachAnomalies([client("holder")], series, exposureOf);
    const anom = holder.signals.find((s) => s.type === "market_anomaly");
    expect(anom).toBeTruthy();
    expect(anom!.matchedHoldings).toContain("Moved Co.");
  });

  it("does NOT attach to clients who don't hold it", () => {
    const [other] = attachAnomalies([client("other")], series, exposureOf);
    expect(other.signals.some((s) => s.type === "market_anomaly")).toBe(false);
  });

  it("orders signals so the most severe drives the queue (signals[0])", () => {
    const minor: NewsSignal = {
      id: "m", headline: "minor", source: "x", publishedAt: "2026-06-01",
      summary: "", type: "opportunity", severity: 10, matchedHoldings: [],
    };
    const [holder] = attachAnomalies([client("holder", [minor])], series, exposureOf);
    expect(holder.signals[0].type).toBe("market_anomaly");
    expect(holder.signals[0].severity).toBeGreaterThan(10);
  });

  it("leaves the input clients untouched (pure)", () => {
    const input = client("holder");
    attachAnomalies([input], series, exposureOf);
    expect(input.signals.length).toBe(0);
  });
});
