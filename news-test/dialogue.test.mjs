import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicDialogue, toLabeledTranscript } from "./dialogue.mjs";

test("heuristicDialogue returns a single Conversation turn", () => {
  const r = heuristicDialogue("Hello there. How are you?");
  assert.equal(r.model, "heuristic");
  assert.equal(r.turns.length, 1);
  assert.equal(r.turns[0].speaker, "Conversation");
  assert.equal(r.turns[0].text, "Hello there. How are you?");
});

test("toLabeledTranscript formats RM/Client lines", () => {
  const s = toLabeledTranscript([
    { speaker: "RM", text: "How have you been?" },
    { speaker: "Client", text: "Worried about my reputation." },
  ]);
  assert.equal(s, "RM: How have you been?\nClient: Worried about my reputation.");
});

test("toLabeledTranscript falls back to raw text for a single Conversation turn", () => {
  const s = toLabeledTranscript([{ speaker: "Conversation", text: "Just one block." }]);
  assert.equal(s, "Just one block.");
});
