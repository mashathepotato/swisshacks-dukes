import { describe, it, expect } from "vitest";
import { shouldRequestDigest, countWords, dnaContextOf } from "./digest";
import type { Client } from "../types";

describe("shouldRequestDigest", () => {
  it("fires when both word-delta and time-delta thresholds are met", () => {
    expect(shouldRequestDigest(0, 40, 0, 5000)).toBe(true);
  });
  it("suppresses when the word delta is too small", () => {
    expect(shouldRequestDigest(0, 39, 0, 10000)).toBe(false);
  });
  it("suppresses when the time delta is too small", () => {
    expect(shouldRequestDigest(0, 100, 0, 4999)).toBe(false);
  });
});

describe("countWords", () => {
  it("counts words; whitespace-only is 0", () => {
    expect(countWords("   ")).toBe(0);
    expect(countWords("one two three")).toBe(3);
  });
});

describe("dnaContextOf", () => {
  it("summarizes values, dislikes and affinities", () => {
    const client = {
      values: ["Reputation = financial risk"],
      dislikes: ["Labour exploitation"],
      affinities: [{ theme: "reputation-sensitivity", weight: 0.9 }],
    } as Partial<Client> as Client;
    const s = dnaContextOf(client);
    expect(s).toContain("Reputation = financial risk");
    expect(s).toContain("Labour exploitation");
    expect(s).toContain("reputation-sensitivity 0.90");
  });
});
