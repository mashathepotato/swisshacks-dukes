import { test } from "node:test";
import assert from "node:assert/strict";
import { distillHeuristic, parseLlmDistill } from "./distill.mjs";

const TRANSCRIPT =
  "I want to be clear: any link to labour exploitation in my portfolio is unacceptable. " +
  "My reputation is my business. I am not interested in US tech hype right now.";

test("heuristic extracts reputation theme + a dislike + receipts", () => {
  const r = distillHeuristic({
    clientId: "ammann",
    transcript: TRANSCRIPT,
    rmName: "T. Keller",
    clientContact: "Mr Ammann",
    date: "2026-06-20",
  });
  const themes = r.dnaDeltas.affinities.map((a) => a.theme);
  assert.ok(themes.includes("reputation"), "reputation affinity surfaced");
  assert.ok(r.dnaDeltas.dislikes.some((d) => /exploitation/i.test(d)));
  assert.ok(r.receipts.length >= 1, "at least one receipt");
  assert.equal(r.receipts[0].kind, "crm");
  assert.equal(r.receipts[0].sourceId, "transcript:ammann:2026-06-20");
  assert.ok(TRANSCRIPT.includes(r.receipts[0].quote), "receipt quotes the transcript verbatim");
  assert.equal(r.note.date, "2026-06-20");
  assert.ok(r.note.text.length > 0);
});

test("parseLlmDistill shapes a model JSON payload into DistillResult", () => {
  const raw = JSON.stringify({
    note_text: "Client reaffirmed reputation sensitivity.",
    values: ["Reputation = financial risk"],
    dislikes: ["Labour exploitation"],
    affinities: [{ theme: "reputation", weight: 0.9 }, { theme: "bogus", weight: 0.5 }],
    receipts: ["My reputation is my business."],
  });
  const r = parseLlmDistill(raw, {
    clientId: "ammann", rmName: "T. Keller", clientContact: "Mr Ammann", date: "2026-06-20",
    transcript: "My reputation is my business.",
  });
  assert.equal(r.dnaDeltas.affinities.length, 1, "bogus theme filtered out");
  assert.equal(r.dnaDeltas.affinities[0].theme, "reputation");
  assert.equal(r.dnaDeltas.values[0], "Reputation = financial risk");
  assert.equal(r.receipts[0].quote, "My reputation is my business.");
});
