import { describe, it, expect } from "vitest";
import { CLIENTS, DEMO_STAGE } from "./clients";
import { priorityFor } from "../lib/priority";

// Guards the demo: anomaly enrichment + per-mandate weights must not let a
// synthetic twin outrank a challenge persona, nor knock Ammann off the top.
// LeCun is intentionally staged DOWN in the "before" beat of the demo, so he is
// excluded from the persona-floor check while staged (see DEMO_STAGE).
const STAGED_DOWN = DEMO_STAGE === "before" ? new Set(["lecun"]) : new Set<string>();

describe("priority calibration — personas stay on top", () => {
  const score = new Map(CLIENTS.map((c) => [c.id, priorityFor(c, CLIENTS).combined]));

  it("every challenge persona outranks every synthetic twin", () => {
    const personaScores = CLIENTS.filter((c) => c.isPersona && !STAGED_DOWN.has(c.id)).map((c) => score.get(c.id)!);
    const twinScores = CLIENTS.filter((c) => !c.isPersona).map((c) => score.get(c.id)!);
    expect(Math.min(...personaScores)).toBeGreaterThan(Math.max(...twinScores));
  });

  it("the demo's intended client tops the book by the organic metric", () => {
    // "before": Ammann leads; "after": the recorded call vaults LeCun to #1.
    const top = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(top).toBe(DEMO_STAGE === "after" ? "lecun" : "ammann");
  });
});
