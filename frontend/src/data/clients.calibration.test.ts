import { describe, it, expect } from "vitest";
import { CLIENTS } from "./clients";
import { rankBook } from "../lib/priority";

// Guards the demo: anomaly enrichment + per-mandate weights must not let a
// synthetic twin outrank a challenge persona, nor knock Ammann off the top.
describe("priority calibration — personas stay on top", () => {
  const ranked = rankBook(CLIENTS);
  const score = new Map(ranked.map((r) => [r.client.id, r.pr.combined]));

  it("every challenge persona outranks every synthetic twin", () => {
    const personaScores = CLIENTS.filter((c) => c.isPersona).map((c) => score.get(c.id)!);
    const twinScores = CLIENTS.filter((c) => !c.isPersona).map((c) => score.get(c.id)!);
    expect(Math.min(...personaScores)).toBeGreaterThan(Math.max(...twinScores));
  });

  it("Ammann remains the top of the book", () => {
    expect(ranked[0].client.id).toBe("ammann");
  });
});
