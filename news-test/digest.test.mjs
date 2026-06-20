import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseModel, heuristicDigest, loadHistory } from "./digest.mjs";

test("chooseModel: short single-topic → small tier", () => {
  assert.equal(chooseModel("We talked briefly about his reputation.").tier, "small");
});

test("chooseModel: long transcript → large tier", () => {
  const long = Array(400).fill("word").join(" ");
  assert.equal(chooseModel(long).tier, "large");
});

test("chooseModel: many topics → large tier", () => {
  const multi = "His reputation matters. He funds reforestation and the environment. He likes dividend income.";
  assert.equal(chooseModel(multi).tier, "large");
});

test("heuristicDigest returns a valid shape", () => {
  const d = heuristicDigest("First point here. Second point follows. He cares about reputation.", "live");
  assert.equal(d.model, "heuristic");
  assert.equal(d.mode, "live");
  assert.ok(d.summary.length > 0);
  assert.ok(Array.isArray(d.bullets));
  assert.ok(d.topics.includes("reputation"));
});

test("loadHistory: persona CSV returns notes; unknown returns []", () => {
  const notes = loadHistory("ammann");
  assert.ok(notes.length >= 1, "ammann has CRM notes");
  assert.ok(notes[0].note && notes[0].date, "notes have date + note");
  assert.deepEqual(loadHistory("nobody"), []);
});
