import { describe, it, expect } from "vitest";
import { mergeDeltas } from "./conversation";
import type { Client, DnaDeltas } from "../types";

const base = {
  values: ["Existing value"],
  dislikes: [],
  affinities: [{ theme: "reputation", weight: 0.4 }],
} as Partial<Client> as Client;

const deltas: DnaDeltas = {
  values: ["Reputation = financial risk", "Existing value"], // dup ignored
  dislikes: ["Labour exploitation"],
  affinities: [
    { theme: "reputation", fromWeight: 0, toWeight: 0.9 }, // updates existing
    { theme: "environmental", fromWeight: 0, toWeight: 0.6 }, // new
  ],
};

describe("mergeDeltas", () => {
  it("adds new values/dislikes without duplicates", () => {
    const m = mergeDeltas(base, deltas);
    expect(m.values).toEqual(["Existing value", "Reputation = financial risk"]);
    expect(m.dislikes).toEqual(["Labour exploitation"]);
  });
  it("updates an existing affinity weight and appends new ones", () => {
    const m = mergeDeltas(base, deltas);
    const rep = m.affinities.find((a) => a.theme === "reputation");
    const env = m.affinities.find((a) => a.theme === "environmental");
    expect(rep?.weight).toBe(0.9);
    expect(env?.weight).toBe(0.6);
    expect(m.affinities).toHaveLength(2);
  });
  it("does not mutate the input client", () => {
    mergeDeltas(base, deltas);
    expect(base.affinities[0].weight).toBe(0.4);
    expect(base.values).toEqual(["Existing value"]);
  });
});
