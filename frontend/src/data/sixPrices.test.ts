import { describe, it, expect } from "vitest";
import { SIX_SERIES } from "./sixPrices";
import { detectAnomalies } from "../lib/anomaly";

describe("sixPrices fixture — what the detector actually finds", () => {
  const byIsin = new Map(detectAnomalies(SIX_SERIES).map((e) => [e.isin, e]));

  it("flags Broadcom's real −12.6% shock (return-driven, from real SIX data)", () => {
    const bc = byIsin.get("US11135F1012");
    expect(bc).toBeTruthy();
    expect(bc!.source).toBe("six");
    expect(bc!.direction).toBe(-1);
    expect(bc!.asOf).toBe("2026-06-04");
    expect(Math.abs(bc!.z)).toBeGreaterThan(4);
  });

  it("flags Abbott's real ~7× volume spike on the latest bar", () => {
    const ab = byIsin.get("US0028241000");
    expect(ab).toBeTruthy();
    expect(ab!.source).toBe("six");
    expect(ab!.kind).toBe("volume_spike");
    expect(ab!.asOf).toBe("2026-06-18");
  });

  it("does NOT raise a false positive on calm Apple", () => {
    expect(byIsin.has("US0378331005")).toBe(false);
  });

  it("flags the synthetic Adidas + Roche persona shocks, labelled synthetic", () => {
    const ad = byIsin.get("DE000A1EWWW0");
    const ro = byIsin.get("CH0012032048");
    expect(ad?.source).toBe("synthetic");
    expect(ro?.source).toBe("synthetic");
    expect(ad!.direction).toBe(-1);
    expect(ro!.direction).toBe(-1);
  });
});
