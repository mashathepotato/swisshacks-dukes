import { test, expect } from "vitest";
import { buildMessagePrompt, draftMessage } from "./messageAgent";
import { DnaProfile, SwapResult, Trace, Voice } from "../../shared/domain";

const dna: DnaProfile = {
  clientId: "schneider", name: "Hubertus Schneider", mandate: "Balanced", style: "values-led", traits: [],
};
const alert: Trace = {
  id: "dna-conflict:CH0012032048", claim: "Roche conflicts with neuroscience mission",
  type: "dna-conflict", confidence: 0.9, severity: "act", evidence: [],
};
const swap: SwapResult = { sell: { isin: "CH0012032048", issuer: "Roche Holding AG" }, chosen: { isin: "US00287Y1091", issuer: "AbbVie Inc.", cioView: "neuro pipeline" }, rejected: [] };

test("buildMessagePrompt includes client name, claim, and voice instruction", () => {
  const p = buildMessagePrompt({ dna, alert, swap, voice: "values-led" });
  expect(p.user).toContain("Hubertus Schneider");
  expect(p.user).toContain("Roche");
  expect(p.user.toLowerCase()).toContain("values");
});

test("draftMessage returns live text when chat succeeds", async () => {
  const res = await draftMessage(
    { dna, alert, swap, voice: "data-driven", cacheKey: "schneider:evt:data-driven" },
    { chat: async () => "LIVE DRAFT", cache: {}, live: true }
  );
  expect(res).toEqual({ text: "LIVE DRAFT", source: "live" });
});

test("draftMessage falls back to cache when chat throws", async () => {
  const res = await draftMessage(
    { dna, alert, swap, voice: "data-driven", cacheKey: "schneider:evt:data-driven" },
    { chat: async () => { throw new Error("boom"); }, cache: { "schneider:evt:data-driven": "CACHED" }, live: true }
  );
  expect(res).toEqual({ text: "CACHED", source: "cache" });
});

test("draftMessage uses cache directly when live=false", async () => {
  let called = false;
  const res = await draftMessage(
    { dna, alert, swap, voice: "values-led", cacheKey: "schneider:evt:values-led" },
    { chat: async () => { called = true; return "X"; }, cache: { "schneider:evt:values-led": "CACHED" }, live: false }
  );
  expect(called).toBe(false);
  expect(res.source).toBe("cache");
});
