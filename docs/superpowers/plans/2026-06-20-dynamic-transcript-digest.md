# Dynamic Transcript Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live rolling digest of a recorded client conversation (Claude Haiku) plus a history-aware finalize pass on Stop that escalates to Claude Sonnet when the conversation is long/complex, with a deterministic heuristic fallback — wired into the existing ConversationCapture panel, plus two architecture diagrams.

**Architecture:** New backend `digest` module mirroring the existing engine-seam pattern, exposed at `POST /api/transcript/digest`. Live calls use Haiku (no history); the on-Stop finalize call is complexity-routed (Haiku/Sonnet) and loads the client's CRM CSV history. Frontend fires debounced live calls during recording and one final call on Stop, rendering a digest panel with a model badge. Diagrams are Graphviz `.dot` → `.png`.

**Tech Stack:** Node ESM + `node:http` + `node:test` (backend), Anthropic Messages API, React 19 + Vite + TS + `vitest` (frontend), Graphviz `dot`.

---

## File Structure

- `news-test/digest.mjs` *(create)* — digest engine seam: `chooseModel`, `loadHistory`, `heuristicDigest`, `anthropicDigest`, `digest`, `digestInfo`.
- `news-test/digest.test.mjs` *(create)* — `node:test` for `chooseModel`, `heuristicDigest`, `loadHistory`.
- `news-test/server.mjs` *(modify)* — add `POST /api/transcript/digest`.
- `frontend/src/types.ts` *(modify)* — add `DigestResult`.
- `frontend/src/lib/digest.ts` *(create)* — pure helpers: `countWords`, `shouldRequestDigest`, `dnaContextOf`.
- `frontend/src/lib/digest.test.ts` *(create)* — `vitest` for the pure helpers.
- `frontend/src/components/ConversationCapture.tsx` *(modify)* — live + final digest calls + digest panel.
- `context/agents.dot` *(modify)* + `context/agents.png` *(regenerate)* — add voice-capture + digest path.
- `context/voice-digest.dot` *(create)* + `context/voice-digest.png` *(generate)* — focused feature/model diagram.

---

### Task 1: Backend digest module

**Files:**
- Create: `news-test/digest.mjs`
- Test: `news-test/digest.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `news-test/digest.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test news-test/digest.test.mjs`
Expected: FAIL — `Cannot find module './digest.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `news-test/digest.mjs`:

```js
// Dynamic transcript digest. Live pass = Claude Haiku (no history); finalize
// pass = complexity-routed Haiku/Sonnet with the client's CRM history as
// context. Always degrades to a deterministic heuristic so the demo never
// hard-fails. Anthropic key is read from demo/.env via news-test/env.mjs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL_SMALL = process.env.DIGEST_MODEL_SMALL || "claude-haiku-4-5-20251001";
const MODEL_LARGE = process.env.DIGEST_MODEL_LARGE || "claude-sonnet-4-6";
const FINALIZE_WORDS = Number(process.env.FINALIZE_WORDS || 350);
const FINALIZE_TOPICS = Number(process.env.FINALIZE_TOPICS || 3);

// Topic detection mirrors the theme keywords used in distill.mjs.
const TOPIC_RES = [
  ["reputation", /reputation|exploitation|scandal|labour|press/i],
  ["environmental", /environment|reforest|climate|sustainab|palm.?oil|deforest/i],
  ["healthcare", /health|pharma|research|disease|illness|foundation/i],
  ["us_tech_bullish", /\bus tech\b|silicon valley|nvidia|ai stock|tech hype/i],
  ["defensive", /conservative|defensive|capital preservation|low risk|cautious/i],
  ["income", /income|dividend|yield|coupon|cash flow/i],
];

function detectTopics(transcript) {
  return TOPIC_RES.filter(([, re]) => re.test(transcript)).map(([t]) => t);
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function chooseModel(transcript) {
  const words = wordCount(transcript);
  const topics = detectTopics(transcript).length;
  const large = words >= FINALIZE_WORDS || topics >= FINALIZE_TOPICS;
  return { model: large ? MODEL_LARGE : MODEL_SMALL, tier: large ? "large" : "small" };
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function heuristicDigest(transcript, mode = "live") {
  const sents = sentences(transcript || "");
  const topics = detectTopics(transcript || "");
  const summary = sents.slice(0, 2).join(" ") || (transcript || "").slice(0, 160);
  return { model: "heuristic", mode, summary, bullets: sents.slice(0, 4), topics };
}

// Minimal quote-aware CSV parser (CRM notes contain commas).
function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function loadHistory(clientId, max = 8) {
  try {
    const file = join(__dirname, "..", "data", "crm", `crm_${clientId}.csv`);
    const rows = parseCsv(readFileSync(file, "utf8"));
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const di = header.indexOf("date");
    const ni = header.indexOf("note");
    if (ni === -1) return [];
    const notes = rows.slice(1)
      .filter((r) => r.length > ni && r[ni] && r[ni].trim())
      .map((r) => ({ date: (r[di] || "").trim(), note: (r[ni] || "").trim() }));
    return notes.slice(-max);
  } catch {
    return [];
  }
}

const SYSTEM_LIVE =
  "You summarize a live wealth-management client conversation for the relationship manager. " +
  'Respond with ONLY a minified JSON object: {"summary":"1-2 sentences","bullets":["key point"],"topics":["short topic"]}.';
const SYSTEM_FINAL =
  SYSTEM_LIVE +
  ' Additionally include "historyLinks":["how this conversation connects to a past CRM note or known client preference"], using the provided client history.';

function parseObj(content) {
  const s = content.indexOf("{"); const e = content.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no JSON object in model output");
  return JSON.parse(content.slice(s, e + 1));
}

async function anthropicDigest(transcript, model, mode, context) {
  const system = mode === "final" ? SYSTEM_FINAL : SYSTEM_LIVE;
  const parts = [`Transcript so far:\n${transcript}`];
  if (mode === "final") {
    if (context?.dnaContext) parts.push(`\nClient DNA: ${context.dnaContext}`);
    if (context?.history?.length)
      parts.push(`\nRecent CRM notes:\n${context.history.map((h) => `- ${h.date}: ${h.note}`).join("\n")}`);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: "user", content: parts.join("\n") }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const obj = parseObj(text);
  const out = {
    model, mode,
    summary: String(obj.summary || "").trim(),
    bullets: Array.isArray(obj.bullets) ? obj.bullets.map(String) : [],
    topics: Array.isArray(obj.topics) ? obj.topics.map(String) : [],
  };
  if (mode === "final" && Array.isArray(obj.historyLinks)) out.historyLinks = obj.historyLinks.map(String);
  return out;
}

export async function digest({ clientId, transcript, mode = "live", dnaContext }) {
  if (!transcript || !transcript.trim()) return heuristicDigest(transcript || "", mode);
  if (!ANTHROPIC_READY) return heuristicDigest(transcript, mode);
  const model = mode === "final" ? chooseModel(transcript).model : MODEL_SMALL;
  const context = mode === "final" ? { dnaContext, history: loadHistory(clientId) } : null;
  try {
    return await anthropicDigest(transcript, model, mode, context);
  } catch (err) {
    console.warn(`[digest] ${model} failed, falling back to heuristic: ${err.message}`);
    return heuristicDigest(transcript, mode);
  }
}

export function digestInfo() {
  return { ready: ANTHROPIC_READY, small: MODEL_SMALL, large: MODEL_LARGE };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test news-test/digest.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add news-test/digest.mjs news-test/digest.test.mjs
git commit -m "feat: backend transcript digest engine (Haiku/Sonnet + heuristic, CRM history)"
```

---

### Task 2: Wire the `/api/transcript/digest` route

**Files:**
- Modify: `news-test/server.mjs`

- [ ] **Step 1: Add the import**

After the existing `import { distill, distillInfo } from "./distill.mjs";` line in `news-test/server.mjs`, add:

```js
import { digest, digestInfo } from "./digest.mjs";
```

- [ ] **Step 2: Add the handler**

Immediately after the existing `handleDistill` function in `news-test/server.mjs`, add:

```js
async function handleDigest(req, res) {
  const body = await readJson(req);
  const { clientId, transcript, mode, dnaContext } = body;
  if (!transcript) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "transcript is required" }));
  }
  const result = await digest({
    clientId: clientId || "",
    transcript,
    mode: mode === "final" ? "final" : "live",
    dnaContext: dnaContext || "",
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
```

- [ ] **Step 3: Register the route**

Inside the `createServer` callback `try` block, just after the existing `/api/transcript/distill` route line, add:

```js
    if (url.pathname === "/api/transcript/digest" && req.method === "POST")
      return await handleDigest(req, res);
```

- [ ] **Step 4: Add a startup log line (optional consistency)**

In the `server.listen` callback, after the `Assessor:` log line, add:

```js
  console.log(`   Digest:   ${digestInfo().ready ? `anthropic (${digestInfo().small} / ${digestInfo().large})` : "heuristic (no ANTHROPIC_API_KEY)"}`);
```

- [ ] **Step 5: Manual verify**

```bash
node news-test/server.mjs & sleep 1
curl -s -X POST http://localhost:4000/api/transcript/digest -H 'Content-Type: application/json' -d '{"clientId":"ammann","transcript":"He is worried about a labour scandal touching his reputation.","mode":"live"}'
curl -s -X POST http://localhost:4000/api/transcript/digest -H 'Content-Type: application/json' -d '{}'
kill %1 2>/dev/null; pkill -f news-test/server.mjs 2>/dev/null
```
Expected: first → JSON `{model:"heuristic",mode:"live",summary,bullets,topics}` (heuristic since no key); second → 400 `{"error":"transcript is required"}`.

- [ ] **Step 6: Commit**

```bash
git add news-test/server.mjs
git commit -m "feat: add POST /api/transcript/digest route"
```

---

### Task 3: Frontend pure helpers + type

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/digest.ts`
- Test: `frontend/src/lib/digest.test.ts`

- [ ] **Step 1: Add the type**

Append to `frontend/src/types.ts`:

```ts
export interface DigestResult {
  model: string;            // "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "heuristic"
  mode: "live" | "final";
  summary: string;
  bullets: string[];
  topics: string[];
  historyLinks?: string[];  // final pass only
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/digest.test.ts`:

```ts
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
      affinities: [{ theme: "reputation", weight: 0.9 }],
    } as Partial<Client> as Client;
    const s = dnaContextOf(client);
    expect(s).toContain("Reputation = financial risk");
    expect(s).toContain("Labour exploitation");
    expect(s).toContain("reputation 0.90");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/digest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `frontend/src/lib/digest.ts`:

```ts
import type { Client } from "../types";

export const DIGEST_MIN_WORDS = 40;
export const DIGEST_MIN_INTERVAL_MS = 5000;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Fire a live digest only when enough new words AND enough time have accrued. */
export function shouldRequestDigest(
  prevWords: number,
  curWords: number,
  lastAtMs: number,
  nowMs: number,
): boolean {
  return curWords - prevWords >= DIGEST_MIN_WORDS && nowMs - lastAtMs >= DIGEST_MIN_INTERVAL_MS;
}

/** Compact current-DNA summary sent as context for the finalize pass. */
export function dnaContextOf(client: Client): string {
  const aff = client.affinities.map((a) => `${a.theme} ${a.weight.toFixed(2)}`).join(", ");
  return [
    client.values.length ? `values: ${client.values.join("; ")}` : "",
    client.dislikes.length ? `dislikes: ${client.dislikes.join("; ")}` : "",
    aff ? `affinities: ${aff}` : "",
  ].filter(Boolean).join(" | ");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/digest.test.ts`
Expected: PASS (5 tests). Also run `npx tsc -b` → clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/lib/digest.ts frontend/src/lib/digest.test.ts
git commit -m "feat: digest type + pure helpers (debounce decision, dna context)"
```

---

### Task 4: Digest in ConversationCapture (live + finalize + panel)

**Files:**
- Modify: `frontend/src/components/ConversationCapture.tsx`

- [ ] **Step 1: Update imports**

At the top of `frontend/src/components/ConversationCapture.tsx`, change the React import and add the digest imports. Replace:

```tsx
import { useState } from "react";
import type { Client, ConsentRecord, DistillResult, AffinityDelta } from "../types";
```
with:
```tsx
import { useEffect, useRef, useState } from "react";
import type { Client, ConsentRecord, DistillResult, AffinityDelta, DigestResult } from "../types";
import { countWords, shouldRequestDigest, dnaContextOf } from "../lib/digest";
```

- [ ] **Step 2: Add digest state + refs**

Immediately after the existing `const [err, setErr] = useState<string | null>(null);` line in the `ConversationCapture` component, add:

```tsx
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const lastWordsRef = useRef(0);
  const lastAtRef = useRef(0);
  const seqRef = useRef(0);
```

- [ ] **Step 3: Add the live-digest effect**

After the refs from Step 2 (still inside the component, before `giveConsent`), add:

```tsx
  // Live rolling digest while recording: debounced by words + time, stale-guarded.
  useEffect(() => {
    if (phase !== "record" || !rec.recording) return;
    const words = countWords(rec.transcript);
    if (!shouldRequestDigest(lastWordsRef.current, words, lastAtRef.current, Date.now())) return;
    lastWordsRef.current = words;
    lastAtRef.current = Date.now();
    const seq = ++seqRef.current;
    fetch("/api/transcript/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, transcript: rec.transcript, mode: "live" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DigestResult | null) => { if (d && seq === seqRef.current) setDigest(d); })
      .catch(() => {});
  }, [rec.transcript, rec.recording, phase, client.id]);
```

- [ ] **Step 4: Add a finalize-on-stop handler**

After the live-digest effect, add:

```tsx
  async function handleStop() {
    rec.stop();
    const transcript = rec.transcript.trim();
    if (!transcript) return;
    const seq = ++seqRef.current;
    try {
      const res = await fetch("/api/transcript/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript, mode: "final", dnaContext: dnaContextOf(client) }),
      });
      if (res.ok) {
        const d: DigestResult = await res.json();
        if (seq === seqRef.current) setDigest(d);
      }
    } catch { /* keep the last live digest */ }
  }
```

- [ ] **Step 5: Reset the digest on approve**

In the existing `approve()` function, on the line that resets state (`setPhase("consent"); setConsent(null); setResult(null); rec.stop(); rec.reset();`), add `setDigest(null); lastWordsRef.current = 0; lastAtRef.current = 0;` to that same line so it becomes:

```tsx
    setPhase("consent"); setConsent(null); setResult(null); rec.stop(); rec.reset(); setDigest(null); lastWordsRef.current = 0; lastAtRef.current = 0;
```

- [ ] **Step 6: Wire the Stop button to `handleStop`**

In the record-phase JSX, change the Stop button from:

```tsx
              : <button onClick={rec.stop}>■ Stop</button>}
```
to:
```tsx
              : <button onClick={handleStop}>■ Stop</button>}
```

- [ ] **Step 7: Add a DigestView sub-component**

At the end of `frontend/src/components/ConversationCapture.tsx` (after the `ConversationCapture` function), add:

```tsx
function modelBadge(model: string): string {
  if (model === "heuristic") return "heuristic";
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

function DigestView({ d }: { d: DigestResult }) {
  return (
    <div style={{ marginTop: 8, padding: 10, background: "var(--panel, #141824)", borderRadius: 6 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        🧠 Digest · {d.mode === "final" ? "final" : "live"} ·{" "}
        <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--accent, #2e1630)", color: "#d9b6df" }}>
          {modelBadge(d.model)}
        </span>
      </div>
      {d.summary && <p style={{ margin: "6px 0" }}>{d.summary}</p>}
      {d.bullets.length > 0 && (
        <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
          {d.bullets.map((b, i) => <li key={i} style={{ fontSize: 13 }}>{b}</li>)}
        </ul>
      )}
      {d.topics.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>Topics: {d.topics.join(", ")}</div>
      )}
      {d.historyLinks && d.historyLinks.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 4 }}>
          ↩ Connects to history:
          <ul style={{ margin: "2px 0", paddingLeft: 18 }}>
            {d.historyLinks.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Render the digest in the record and review phases**

In the record-phase JSX, immediately after the line `{err && <p style={{ color: "var(--red, #e53e3e)" }}>{err}</p>}`, add:

```tsx
          {digest && <DigestView d={digest} />}
```

In the review-phase JSX, immediately after the line `<p style={{ fontSize: 12, opacity: 0.7 }}>✓ Consent ({consent?.method}) · {consent?.timestamp}</p>`, add:

```tsx
          {digest && <DigestView d={digest} />}
```

- [ ] **Step 9: Verify**

Run: `cd frontend && npx tsc -b && npm run lint && npm run build && npm run test`
Expected: tsc clean, lint clean, build succeeds, vitest passes (all tests, including digest + conversation).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/ConversationCapture.tsx
git commit -m "feat: live + finalize digest panel in ConversationCapture"
```

---

### Task 5: Amend the agent-architecture diagram

**Files:**
- Modify: `context/agents.dot`
- Regenerate: `context/agents.png`

- [ ] **Step 1: Add the Anthropic provider node**

In `context/agents.dot`, inside `subgraph cluster_sources { ... }`, after the existing `llm [...]` line, add:

```
    anthropic [label="Anthropic\nHaiku · Sonnet\n(digest models)", fillcolor="#241b2e", color="#7d5aa0"];
```

- [ ] **Step 2: Add the voice-capture + digest nodes**

In `context/agents.dot`, immediately after the humans block (the two lines defining `rm [...]` and `client [...]`), add:

```
  // ── Voice conversation capture + digest ──
  consent [label="🔒  Consent gate\n(client consents to record)", fillcolor="#2a2416", color="#c79a3a"];
  stt     [label="🎙️  Live STT\n(Web Speech API)", fillcolor="#16302a", color="#3aa17e"];
  digestN [label="🧠  Transcript Digest\nlive: Haiku · finalize: Sonnet\ncomplexity-routed · heuristic fallback", fillcolor="#2e1630", color="#b257b8", penwidth=2.0];
  distillN[label="🧬  Distill\n→ CRM note + DNA deltas\n(quote receipts)", fillcolor="#16302a", color="#3aa17e"];
```

- [ ] **Step 3: Add the wiring**

In `context/agents.dot`, just before the final closing `}` of the digraph, add:

```
  // ── Voice capture + digest wiring ──
  rm      -> consent [label="record (consented)", color="#d08a2f", fontcolor="#e0a85f"];
  consent -> stt;
  stt     -> digestN  [label="transcript stream"];
  stt     -> distillN [label="on review"];
  anthropic -> digestN [style=dashed, color="#6b4f8a", arrowhead=none];
  crmlog  -> digestN  [label="history (finalize)", style=dashed, color="#6b4f8a"];
  distillN -> crmA    [label="DNA deltas"];
  digestN -> cd       [label="live understanding"];
```

- [ ] **Step 4: Regenerate the PNG**

Run: `cd /Users/masha/Documents/swisshacks-dukes && dot -Tpng context/agents.dot -o context/agents.png`
Expected: no errors; `context/agents.png` updated.
Verify: `file context/agents.png` reports a non-trivial PNG (width/height > 0, size larger than a few KB).

- [ ] **Step 5: Commit**

```bash
git add context/agents.dot context/agents.png
git commit -m "docs: add voice capture + digest path to the agent architecture diagram"
```

---

### Task 6: New focused voice + digest diagram

**Files:**
- Create: `context/voice-digest.dot`
- Generate: `context/voice-digest.png`

- [ ] **Step 1: Create the .dot file**

Create `context/voice-digest.dot`:

```
digraph VoiceDigest {
  rankdir=LR;
  bgcolor="#0f1117";
  fontname="Helvetica";
  fontcolor="#e6e9ef";
  labelloc="t";
  fontsize=20;
  label=<<b>Voice Conversation Capture + Dynamic Digest</b><br/><font point-size="11" color="#8b93a7">consented live transcription · model escalates with conversation complexity · always-on heuristic fallback</font>>;
  nodesep=0.4; ranksep=0.9; splines=spline;
  node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=12, color="#2a2f3d", fontcolor="#e6e9ef", penwidth=1.5, margin="0.18,0.12"];
  edge [color="#5b6478", fontname="Helvetica", fontsize=9, fontcolor="#9aa3b8", penwidth=1.3, arrowsize=0.8];

  rm      [label="👤  RM", shape=oval, fillcolor="#3a2415", color="#d08a2f", penwidth=2.0];
  consent [label="🔒  Consent gate\nrecord only on consent", fillcolor="#2a2416", color="#c79a3a"];
  stt     [label="🎙️  Live STT\nWeb Speech API (browser)", fillcolor="#16302a", color="#3aa17e"];

  subgraph cluster_digest {
    label=<<b>Dynamic digest</b>>; labelloc="t"; fontsize=12; fontcolor="#8b93a7";
    style="rounded"; color="#3a4154"; bgcolor="#141824";
    live  [label="Live rolling digest\n(every ~40 words)", fillcolor="#1a2030", color="#4a5878"];
    final [label="Finalize on Stop\n+ CRM history", fillcolor="#1a2030", color="#4a5878"];
    route [label="⚖️  complexity router\nwords ≥ 350  or  topics ≥ 3", shape=diamond, fillcolor="#3a2f16", color="#c79a3a"];
  }

  haiku  [label="Claude Haiku\n(small · fast)", fillcolor="#241b2e", color="#7d5aa0"];
  sonnet [label="Claude Sonnet\n(large · history-aware)", fillcolor="#2e1630", color="#b257b8", penwidth=2.0];
  heur   [label="Heuristic digest\n(no key / API error)", fillcolor="#1b2436", color="#3d5a99"];
  crmlog [label="CRM notes\ncrm_<client>.csv", fillcolor="#1b2436", color="#3d5a99"];

  distill [label="🧬  Distill → CRM note + DNA deltas", fillcolor="#16302a", color="#3aa17e"];
  review  [label="🧑‍💼  RM review → approve", fillcolor="#1a2030", color="#4a5878"];
  dna     [label="Client DNA updated", fillcolor="#15324a", color="#2f8fd0", penwidth=2.0];

  rm      -> consent [label="consent", color="#d08a2f", fontcolor="#e0a85f"];
  consent -> stt;
  stt     -> live  [label="transcript stream"];
  stt     -> final [label="on Stop"];
  live    -> haiku [label="always", style=dashed, color="#7d5aa0", arrowhead=none];
  final   -> route;
  route   -> haiku  [label="short / simple"];
  route   -> sonnet [label="long / complex"];
  crmlog  -> final  [label="history", style=dashed, color="#6b4f8a"];
  haiku   -> heur   [label="fallback", style=dashed, color="#5b6478"];
  sonnet  -> heur   [label="fallback", style=dashed, color="#5b6478"];

  stt     -> distill [label="review"];
  distill -> review;
  review  -> dna [label="approve", color="#6fa84a", fontcolor="#9ccb78", penwidth=2.0];
}
```

- [ ] **Step 2: Generate the PNG**

Run: `cd /Users/masha/Documents/swisshacks-dukes && dot -Tpng context/voice-digest.dot -o context/voice-digest.png`
Expected: no errors; `context/voice-digest.png` created.
Verify: `file context/voice-digest.png` reports a PNG with non-zero dimensions.

- [ ] **Step 3: Commit**

```bash
git add context/voice-digest.dot context/voice-digest.png
git commit -m "docs: add focused voice + digest architecture diagram"
```

---

## Self-Review Notes

- **Spec coverage:** models + env config + routing (Task 1 `chooseModel`/`digest`), Anthropic key via demo/.env (Task 1 reads `process.env.ANTHROPIC_API_KEY`; server loads it via `env.mjs`), heuristic fallback + model badge (Tasks 1 & 4), CRM history for finalize (Task 1 `loadHistory`), `POST /api/transcript/digest` (Task 2), `DigestResult` type (Task 3), debounce/stale-guard pure helper (Task 3 `shouldRequestDigest`), live + finalize calls + panel (Task 4), amended agents diagram (Task 5), new focused diagram with model tiers + fallback (Task 6). All spec sections map to a task.
- **Type consistency:** `DigestResult { model, mode, summary, bullets, topics, historyLinks? }` is identical in the backend output (Task 1), the TS type (Task 3), and the component consumer (Task 4). `chooseModel` returns `{model, tier}` used only in Tasks 1–2. `digest({clientId, transcript, mode, dnaContext})` arg shape matches the route body (Task 2) and the frontend fetch bodies (Task 4).
- **Routing scope:** live pass always Haiku; only the finalize pass calls `chooseModel` — consistent across Tasks 1, 4, and the spec.
- **Fallback:** every Anthropic call path is wrapped so a missing key or API error degrades to `heuristicDigest`; the frontend additionally swallows fetch errors and keeps the last digest.
- **Known tradeoff:** the live-digest effect uses `Date.now()` and real `fetch`; it is verified via the Task 4 build + the human browser smoke test, while the debounce decision is unit-tested as the pure `shouldRequestDigest`. Diagrams are verified by successful `dot` render (non-empty PNG), not pixel inspection.
