import { test } from "node:test";
import assert from "node:assert/strict";
import { ask, askInfo, heuristicAnswer } from "./ask.mjs";

const CONTEXT = [
  "DNA — Name: Räber · Archetype: Steady steward · Mandate: Defensive · Risk: Low",
  "Values: capital preservation; Swiss anchoring. Dislikes: US tech concentration.",
  "PORTFOLIO (total CHF 1,200,000): Nestlé S.A. (Consumer Staples) CHF 101,136; Roche Holding AG (Health Care) CHF 92,014.",
  "SIGNALS: Mandate drift — US-tech weight above target.",
  "RECOMMENDATIONS: Trim Nvidia and rotate into Swiss staples.",
  "LAST CONTACT: 12 days ago.",
].join("\n");

test("askInfo reports a valid engine shape", () => {
  const info = askInfo();
  assert.ok(["anthropic", "heuristic"].includes(info.engine));
  assert.equal(typeof info.model, "string");
});

test("heuristicAnswer routes a portfolio question to the portfolio line", () => {
  const a = heuristicAnswer(CONTEXT, "summarise their portfolio risk");
  assert.match(a, /Nestlé|PORTFOLIO/);
});

test("heuristicAnswer routes a last-contact question to the contact line", () => {
  const a = heuristicAnswer(CONTEXT, "what changed since last contact?");
  assert.match(a, /12 days|LAST CONTACT/i);
});

test("heuristicAnswer with no keyword match returns a general overview", () => {
  const a = heuristicAnswer(CONTEXT, "tell me something");
  assert.ok(a.length > 0);
  assert.match(a, /Räber/);
});

test("ask falls back to heuristic when no key is configured", async () => {
  const r = await ask({ client: { name: "Räber" }, context: CONTEXT, question: "portfolio?", history: [] });
  assert.ok(["anthropic", "heuristic"].includes(r.engine));
  assert.equal(typeof r.answer, "string");
  assert.ok(r.answer.length > 0);
});
