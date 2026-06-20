import { describe, it, expect } from "vitest";
import { buildClientContext } from "./clientContext";
import type { Client } from "../types";

const client = {
  id: "test-client",
  name: "Räber",
  archetype: "Steady steward",
  isPersona: false,
  mandate: "Defensive",
  tenureYears: 8,
  riskProfile: "Low",
  commStyle: "Concise, data-first",
  values: ["capital preservation", "Swiss anchoring"],
  dislikes: ["US tech concentration"],
  affinities: [{ theme: "us-exposure", weight: 0.8, polarity: -1 }],
  priorityScore: 72,
  topReason: "US-tech weight above target",
  signals: [{ id: "s1", headline: "Mandate drift", source: "Desk", publishedAt: "2026-06-10", summary: "US-tech above target", type: "mandate_drift", severity: 60, matchedHoldings: [] }],
  recommendations: [{ id: "r1", action: "Trim Nvidia", rationale: "Above mandate", evidence: ["drift +2pp"], confidence: 0.7 }],
  topHoldings: ["Nestlé", "Roche"],
} as Client;

describe("buildClientContext", () => {
  it("includes DNA, values, signals and recommendations", () => {
    const ctx = buildClientContext(client, {});
    expect(ctx).toMatch(/Räber/);
    expect(ctx).toMatch(/Defensive/);
    expect(ctx).toMatch(/capital preservation/);
    expect(ctx).toMatch(/SIGNALS/);
    expect(ctx).toMatch(/RECOMMENDATIONS/);
    expect(ctx).toMatch(/Trim Nvidia/);
  });

  it("includes a PORTFOLIO section for a known mandate", () => {
    const ctx = buildClientContext(client, {});
    expect(ctx).toMatch(/PORTFOLIO/);
  });

  it("includes conversation notes when provided", () => {
    const ctx = buildClientContext(client, { notes: [{ text: "Wants to cut US tech", date: "2026-06-01" }] });
    expect(ctx).toMatch(/Wants to cut US tech/);
  });
});
