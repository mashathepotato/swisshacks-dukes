import { test, expect } from "vitest";
import { summarizeClient, rankInbox } from "./inbox";
import { Trace } from "../../shared/domain";

const trace = (severity: "act" | "watch" | "info", valueAtStakeCHF?: number): Trace => ({
  id: "t", claim: "c", type: "dna-conflict", confidence: 0.9, severity, evidence: [], valueAtStakeCHF,
});

test("summarizeClient takes the first (most urgent) trace as top and scores by severity", () => {
  const row = summarizeClient("schneider", "Hubertus Schneider", "Balanced", [trace("act", 100000), trace("watch")]);
  expect(row.top!.severity).toBe("act");
  expect(row.score).toBeGreaterThan(summarizeClient("x", "X", "Defensive", [trace("watch", 999999)]).score);
});

test("no alerts => score 0 and null top", () => {
  const row = summarizeClient("y", "Y", "Growth", []);
  expect(row.top).toBeNull();
  expect(row.score).toBe(0);
});

test("within the same severity, higher value-at-stake scores higher", () => {
  const a = summarizeClient("a", "A", "Balanced", [trace("act", 200000)]);
  const b = summarizeClient("b", "B", "Balanced", [trace("act", 50000)]);
  expect(a.score).toBeGreaterThan(b.score);
});

test("a live client-signal outranks even a high-value ACT alert", () => {
  const signal: Trace = { id: "s", claim: "client msg", type: "client-signal", confidence: 1, severity: "act", evidence: [] };
  const sigRow = summarizeClient("sig", "S", "Balanced", [signal]);
  const richAct = summarizeClient("rich", "R", "Growth", [trace("act", 5_000_000)]);
  expect(sigRow.score).toBeGreaterThan(richAct.score);
});

test("a client-signal is picked as top even if not first in the list", () => {
  const signal: Trace = { id: "s", claim: "client msg", type: "client-signal", confidence: 1, severity: "act", evidence: [] };
  const row = summarizeClient("x", "X", "Balanced", [trace("act", 999999), signal]);
  expect(row.top!.type).toBe("client-signal");
});

test("rankInbox orders by score descending: act > watch > info", () => {
  const rows = [
    summarizeClient("info", "I", "Defensive", [trace("info", 80000)]),
    summarizeClient("act", "A", "Growth", [trace("act")]),
    summarizeClient("watch", "W", "Balanced", [trace("watch", 999999)]),
  ];
  const ranked = rankInbox(rows).map((r) => r.id);
  expect(ranked).toEqual(["act", "watch", "info"]);
});
