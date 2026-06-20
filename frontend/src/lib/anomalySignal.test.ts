import { describe, it, expect } from "vitest";
import { anomalySignal } from "./anomalySignal";
import type { AnomalyEvent } from "./anomaly";

const base: AnomalyEvent = {
  isin: "US30303M1027",
  issuer: "Meta Platforms Inc.",
  listingId: "14917609_XNAS",
  source: "six",
  asOf: "2026-03-26",
  latestReturn: -0.0796,
  z: -4.71,
  volRatio: 2.31,
  direction: -1,
  severity: 82,
  kind: "both",
};

describe("anomalySignal", () => {
  it("builds a market_anomaly signal tied to the holding and dated to the bar", () => {
    const sig = anomalySignal(base, 185_000);
    expect(sig.type).toBe("market_anomaly");
    expect(sig.matchedHoldings).toEqual(["Meta Platforms Inc."]);
    expect(sig.publishedAt).toBe("2026-03-26");
    expect(sig.headline).toContain("Meta Platforms Inc.");
    expect(sig.headline).toContain("8.0%"); // |−7.96%| rounded
    expect(sig.headline).toContain("4.7"); // the sigma
    expect(sig.headline).toContain("▼"); // downward direction
  });

  it("cites SIX for real data and labels synthetic honestly", () => {
    expect(anomalySignal(base, 100_000).source).toContain("SIX");
    expect(anomalySignal({ ...base, source: "synthetic" }, 100_000).source.toLowerCase()).toContain("synthetic");
  });

  it("scales severity up with CHF exposure (monotonic), clamped to 100", () => {
    const small = anomalySignal(base, 5_000).severity;
    const large = anomalySignal(base, 1_000_000).severity;
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThanOrEqual(100);
    expect(small).toBeGreaterThan(0);
  });

  it("frames an upward spike with ▲ and no negative sign", () => {
    const up = anomalySignal({ ...base, direction: 1, latestReturn: 0.061, z: 3.2 }, 100_000);
    expect(up.headline).toContain("▲");
    expect(up.headline).toContain("6.1%");
  });
});
