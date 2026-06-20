import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, simulateInfo } from "./simulate.mjs";

const BASELINE = {
  acceptanceProbability: 0.42,
  predictedReaction: "Cautiously open, but will want reassurance.",
  objections: ["Wants to understand why now."],
  bestFraming: "Lead with the numbers.",
  nextStep: "Open with a question, not a pitch.",
  trajectory: [{ label: "Now", trust: 60, alignment: 55 }],
};
const CLIENT = {
  name: "Räber",
  mandate: "Defensive",
  riskProfile: "Low",
  affinities: [{ theme: "us-exposure", weight: 0.85, polarity: -1 }],
};

test("simulateInfo reports a valid engine shape", () => {
  const info = simulateInfo();
  assert.ok(["anthropic", "heuristic"].includes(info.engine));
  assert.equal(typeof info.model, "string");
});

test("missing proposal falls back to the baseline (no network)", async () => {
  const r = await simulate({ client: CLIENT, proposal: "", baseline: BASELINE });
  assert.equal(r.engine, "heuristic");
  assert.equal(r.acceptanceProbability, BASELINE.acceptanceProbability);
  assert.equal(r.predictedReaction, BASELINE.predictedReaction);
});

test("missing client falls back to the baseline (no network)", async () => {
  const r = await simulate({ client: null, proposal: "trim Nvidia", baseline: BASELINE });
  assert.equal(r.engine, "heuristic");
  assert.deepEqual(r.objections, BASELINE.objections);
});

test("missing baseline yields a heuristic verdict, not a crash", async () => {
  const r = await simulate({ client: CLIENT, proposal: "trim Nvidia", baseline: null });
  assert.equal(r.engine, "heuristic");
});
