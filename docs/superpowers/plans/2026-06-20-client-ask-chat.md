# Ask-about-client chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chat-style natural-language Q&A box to the client page so the RM can ask about a client and get grounded custom overviews.

**Architecture:** A new backend module `news-test/ask.mjs` + a `/api/ask` route, reusing the existing Anthropic seam (key from `demo/.env`) with a deterministic keyword-routing heuristic fallback. A new frontend `AskClient.tsx` assembles the client's grounding context (DNA, portfolio, behavioral trades, learning, conversation notes) and renders a per-client threaded chat at the top of the right column, POSTing to `/api/ask`.

**Tech Stack:** Node `node:http` (zero-dep), React 19 + TypeScript + Vite, `node --test`, vitest.

## Global Constraints

- The LLM seam MUST degrade to a deterministic heuristic — never hard-fail on a missing key or flaky network.
- The AI equips the RM, never advises the client directly; RM keeps final say (reflect in the system prompt + UI copy "Drafts/answers for the RM").
- No new runtime dependencies — backend stays zero-dep `node:http`; frontend uses existing libs only.
- Anthropic key read via `process.env.ANTHROPIC_API_KEY` (populated by `env.mjs`); treat keys starting with `your_` as absent.
- Model default `claude-opus-4-8`, effort default `medium`, overridable via `ASK_MODEL` / `ASK_EFFORT` (mirror `simulate.mjs`).
- Vite proxies `/api` → `http://localhost:4000`; the frontend calls relative `/api/ask`.

---

### Task 1: Backend `ask.mjs` — heuristic core + `askInfo`

**Files:**
- Create: `news-test/ask.mjs`
- Test: `news-test/ask.test.mjs`

**Interfaces:**
- Consumes: `process.env.ANTHROPIC_API_KEY`, `ASK_MODEL`, `ASK_EFFORT`.
- Produces:
  - `askInfo(): { engine: "anthropic" | "heuristic", model: string }`
  - `heuristicAnswer(context: string, question: string): string` — pure, no network.
  - `ask({ client, context, question, history }): Promise<{ answer: string, engine: string, model: string }>` (full version lands in Task 2; this task ships `askInfo` + `heuristicAnswer` + a minimal `ask` that returns the heuristic when no key).

- [ ] **Step 1: Write the failing test**

Create `news-test/ask.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test news-test/ask.test.mjs`
Expected: FAIL — `Cannot find module './ask.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `news-test/ask.mjs`:

```javascript
// LLM-backed "ask about this client" copilot for the client page. Given a
// client's grounding context (DNA, portfolio, behavioral trades, learning,
// conversation notes) and the RM's natural-language question, Claude answers
// from those facts. Degrades to a deterministic keyword router when there is no
// key, the call fails, or the output is empty — so the demo never hard-fails.
// Anthropic key read from demo/.env via env.mjs (imported by the server first).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.ASK_MODEL || "claude-opus-4-8";
const EFFORT = process.env.ASK_EFFORT || "medium"; // low | medium | high | max

export function askInfo() {
  return { engine: ANTHROPIC_READY ? "anthropic" : "heuristic", model: ANTHROPIC_READY ? MODEL : "none" };
}

// Keyword → context-section router. Returns the lines of `context` whose section
// matches the question's intent, lightly framed. Pure + deterministic.
const ROUTES = [
  { keys: ["portfolio", "holding", "position", "allocat", "risk", "mandate", "exposure"], match: /PORTFOLIO|SIGNALS|Mandate|Risk/i },
  { keys: ["value", "dna", "dislike", "care", "ethic", "belief"], match: /Values|DNA|Dislikes/i },
  { keys: ["recommend", "action", "suggest", "lead with", "pitch", "next step"], match: /RECOMMENDATIONS/i },
  { keys: ["signal", "happen", "alert", "flag"], match: /SIGNALS/i },
  { keys: ["last contact", "since", "recent", "touch", "spoke", "talked"], match: /LAST CONTACT|CONVERSATION/i },
  { keys: ["behav", "trade", "history", "pattern"], match: /BEHAVIORAL/i },
  { keys: ["learn", "feedback", "accept", "tone"], match: /LEARNING/i },
];

export function heuristicAnswer(context, question) {
  const ctx = String(context || "");
  const lines = ctx.split("\n").filter(Boolean);
  const q = String(question || "").toLowerCase();
  const name = (ctx.match(/Name:\s*([^·\n]+)/) || [])[1]?.trim() || "this client";

  const hit = ROUTES.find((r) => r.keys.some((k) => q.includes(k)));
  if (hit) {
    const picked = lines.filter((l) => hit.match.test(l));
    if (picked.length) return `Here's what's on file for ${name}:\n\n${picked.join("\n")}`;
  }
  // No match (or matched section empty): a short overview from the lead lines.
  const overview = lines.slice(0, 3).join("\n");
  return `Here's a quick overview of ${name}:\n\n${overview}\n\n(Ask about their portfolio, values, signals, recommendations, or last contact for a sharper answer.)`;
}

export async function ask({ client, context, question, history }) {
  const q = String(question || "").trim();
  const heuristic = { answer: heuristicAnswer(context, q), engine: "heuristic", model: "none" };
  if (!q) return { ...heuristic, answer: heuristicAnswer(context, "") };
  if (!ANTHROPIC_READY) return heuristic;
  // Anthropic path lands in Task 2.
  return heuristic;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test news-test/ask.test.mjs`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add news-test/ask.mjs news-test/ask.test.mjs
git commit -m "feat: ask.mjs heuristic core for client Q&A seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend `ask.mjs` — Anthropic path

**Files:**
- Modify: `news-test/ask.mjs` (replace the `ask` stub; add `SYSTEM`, `parseText`, `anthropicAsk`)

**Interfaces:**
- Consumes: `heuristicAnswer`, `ANTHROPIC_READY`, `MODEL`, `EFFORT` from Task 1.
- Produces: `ask(...)` now calls Anthropic when ready, falling back to `heuristicAnswer` on any failure/empty output. Same return shape `{ answer, engine, model }`.

- [ ] **Step 1: Write the failing test**

Append to `news-test/ask.test.mjs`:

```javascript
test("ask replays history as alternating turns without crashing", async () => {
  const r = await ask({
    client: { name: "Räber" },
    context: CONTEXT,
    question: "and why?",
    history: [
      { role: "rm", text: "What should I lead with?" },
      { role: "copilot", text: "Lead with capital preservation." },
    ],
  });
  assert.equal(typeof r.answer, "string");
  assert.ok(r.answer.length > 0);
  assert.ok(["anthropic", "heuristic"].includes(r.engine));
});
```

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `node --test news-test/ask.test.mjs`
Expected: PASS already (stub handles it), but the test pins the `history` contract for the real implementation. Proceed to wire the Anthropic path.

- [ ] **Step 3: Write the implementation**

In `news-test/ask.mjs`, add above `ask` and replace the `ask` function body:

```javascript
const SYSTEM =
  "You are a relationship manager's copilot inside a Swiss private bank. Answer the RM's question " +
  "about THIS client using ONLY the grounding facts provided below. Be concise and specific; prefer " +
  "the client's own values, holdings and history over generalities. You equip the RM — you never " +
  "address or advise the client directly, and the RM keeps the final say. If a fact isn't in the " +
  "grounding context, say so plainly rather than inventing it. Answer in plain prose (no JSON, no preamble).";

// rm → user, copilot → assistant. The Anthropic API requires the first message
// to be a user turn and roles to alternate; history here is always RM-first.
function historyMessages(history) {
  return (Array.isArray(history) ? history : [])
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ role: t.role === "copilot" ? "assistant" : "user", text: t.text.trim() }));
}

function textOf(data) {
  return (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function anthropicAsk({ context, question, history }) {
  const msgs = historyMessages(history).map((m) => ({ role: m.role, content: m.text }));
  msgs.push({ role: "user", content: `GROUNDING CONTEXT\n${context || "(none provided)"}\n\nRM QUESTION\n${question}` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      messages: msgs,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const answer = textOf(await res.json());
  if (!answer) throw new Error("empty model output");
  return { answer, engine: "anthropic", model: MODEL };
}

export async function ask({ client, context, question, history }) {
  const q = String(question || "").trim();
  const fallback = { answer: heuristicAnswer(context, q), engine: "heuristic", model: "none" };
  if (!q) return fallback;
  if (!ANTHROPIC_READY) return fallback;
  try {
    return await anthropicAsk({ context, question: q, history });
  } catch (err) {
    console.warn(`[ask] ${MODEL} failed, falling back to heuristic: ${err.message}`);
    return fallback;
  }
}
```

Remove the old stub `ask` and the `// Anthropic path lands in Task 2.` comment. Note `client` is accepted for parity with the route contract though the prompt grounds on `context`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test news-test/ask.test.mjs`
Expected: PASS — all 6 tests (no network hit without a real key).

- [ ] **Step 5: Commit**

```bash
git add news-test/ask.mjs news-test/ask.test.mjs
git commit -m "feat: wire ask.mjs Anthropic path with heuristic fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `/api/ask` route into the server

**Files:**
- Modify: `news-test/server.mjs` (import `ask`/`askInfo`; add `handleAsk`; add route; add boot log line)

**Interfaces:**
- Consumes: `ask`, `askInfo` from `news-test/ask.mjs`; existing `readJson`.
- Produces: `POST /api/ask` → `{ answer, engine, model }`; missing `question` → 400.

- [ ] **Step 1: Add the import**

In `news-test/server.mjs`, after the `import { simulate, simulateInfo } from "./simulate.mjs";` line (line 19), add:

```javascript
import { ask, askInfo } from "./ask.mjs";
```

- [ ] **Step 2: Add the handler**

After `handleSimulate` (ends ~line 240), add:

```javascript
async function handleAsk(req, res) {
  const body = await readJson(req);
  const { client, context, question, history } = body;
  if (!question || !String(question).trim()) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "question is required" }));
  }
  const result = await ask({ client: client || null, context: context || "", question, history: history || [] });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
```

- [ ] **Step 3: Register the route**

In the `createServer` handler, after the `/api/simulate` route (line ~269), add:

```javascript
    if (url.pathname === "/api/ask" && req.method === "POST")
      return await handleAsk(req, res);
```

- [ ] **Step 4: Add the boot log line**

In `server.listen`, after the `Simulate:` log line (~line 292), add:

```javascript
  console.log(`   Ask:      ${askInfo().engine} (${askInfo().model})`);
```

- [ ] **Step 5: Verify the server boots and the route answers**

Run:
```bash
ASSESSOR_ENGINE=heuristic node news-test/server.mjs &
sleep 1
curl -s -X POST http://localhost:4000/api/ask -H 'Content-Type: application/json' \
  -d '{"context":"DNA — Name: Räber\nPORTFOLIO (total CHF 1,200,000): Nestlé S.A. CHF 101,136","question":"summarise their portfolio"}'
echo
kill %1 2>/dev/null
```
Expected: a JSON object with `answer` mentioning Nestlé/PORTFOLIO, `engine` either `heuristic` or `anthropic`. Also confirm a `400` for an empty question:
```bash
node news-test/server.mjs & sleep 1
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/ask -H 'Content-Type: application/json' -d '{"question":""}'
kill %1 2>/dev/null
```
Expected: `400`.

- [ ] **Step 6: Run the full backend test suite**

Run: `node --test news-test/*.test.mjs`
Expected: PASS (existing suites + `ask.test.mjs`).

- [ ] **Step 7: Commit**

```bash
git add news-test/server.mjs
git commit -m "feat: expose /api/ask route on the news server

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend context builder `buildClientContext`

**Files:**
- Create: `frontend/src/lib/clientContext.ts`
- Test: `frontend/src/lib/clientContext.test.ts`

**Interfaces:**
- Consumes:
  - `Client` from `../types`.
  - `PORTFOLIOS` from `../data/portfolio` (`Record<Mandate, PHolding[]>`; `PHolding` has `issuer`, `isin`, `industryGroup`, `currentCHF`).
  - `behavioralForClient(clientId: string): BehavioralTrait[]` from `./behavioral` (`BehavioralTrait` has `label`, `detail`).
  - `formatMoney(n: number): string` from `./format`.
  - `PreferenceModel` from `../types` (has `acceptanceRate`, `sampleSize`, `preferredVoice`).
  - `ConversationEntry[]` (each has `.note.text`, `.note.date`) from `./conversationStore` — passed in, not imported (keeps this pure/testable).
- Produces: `buildClientContext(client: Client, opts: { model?: PreferenceModel; notes?: { text: string; date: string }[] }): string` — a plain-text grounding block.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/clientContext.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildClientContext } from "./clientContext";
import type { Client } from "../types";

const client = {
  id: "test-client",
  name: "Räber",
  archetype: "Steady steward",
  isPersona: false,
  mandate: "Defensive",
  tenureYears: 8,
  riskProfile: "Low",
  commStyle: "Concise, data-first",
  values: ["capital preservation", "Swiss anchoring"],
  dislikes: ["US tech concentration"],
  affinities: [{ theme: "us-exposure", weight: 0.8, polarity: -1 }],
  priorityScore: 72,
  topReason: "US-tech weight above target",
  signals: [{ id: "s1", headline: "Mandate drift", source: "Desk", publishedAt: "2026-06-10", summary: "US-tech above target", type: "mandate_drift", severity: 60, matchedHoldings: [] }],
  recommendations: [{ id: "r1", action: "Trim Nvidia", rationale: "Above mandate", evidence: ["drift +2pp"], confidence: 0.7 }],
  topHoldings: ["Nestlé", "Roche"],
} as Client;

describe("buildClientContext", () => {
  it("includes DNA, values, signals and recommendations", () => {
    const ctx = buildClientContext(client, {});
    expect(ctx).toMatch(/Räber/);
    expect(ctx).toMatch(/Defensive/);
    expect(ctx).toMatch(/capital preservation/);
    expect(ctx).toMatch(/SIGNALS/);
    expect(ctx).toMatch(/RECOMMENDATIONS/);
    expect(ctx).toMatch(/Trim Nvidia/);
  });

  it("includes a PORTFOLIO section for a known mandate", () => {
    const ctx = buildClientContext(client, {});
    expect(ctx).toMatch(/PORTFOLIO/);
  });

  it("includes conversation notes when provided", () => {
    const ctx = buildClientContext(client, { notes: [{ text: "Wants to cut US tech", date: "2026-06-01" }] });
    expect(ctx).toMatch(/Wants to cut US tech/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/clientContext.test.ts`
Expected: FAIL — cannot resolve `./clientContext`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/clientContext.ts`:

```typescript
import type { Client, PreferenceModel } from "../types";
import { PORTFOLIOS } from "../data/portfolio";
import { behavioralForClient } from "./behavioral";
import { formatMoney } from "./format";

interface ContextOpts {
  model?: PreferenceModel;
  notes?: { text: string; date: string }[];
}

/** Assembles a plain-text grounding block describing everything on file for a
 *  client, for the /api/ask copilot. Pure: portfolio/behavioral come from data
 *  modules; learning + notes are passed in from React stores by the caller. */
export function buildClientContext(client: Client, opts: ContextOpts): string {
  const lines: string[] = [];

  const aff = (client.affinities || [])
    .map((a) => `${a.theme}=${(a.weight * (a.polarity ?? 1)).toFixed(2)}`)
    .join(", ");
  lines.push(
    `DNA — Name: ${client.name} · Archetype: ${client.archetype} · Mandate: ${client.mandate} · Risk: ${client.riskProfile} · Tenure: ${client.tenureYears}y · Priority: ${client.priorityScore}`
  );
  if (client.commStyle) lines.push(`Comm style: ${client.commStyle}`);
  if (client.values?.length) lines.push(`Values: ${client.values.join("; ")}`);
  if (client.dislikes?.length) lines.push(`Dislikes: ${client.dislikes.join("; ")}`);
  if (aff) lines.push(`Signed value affinities (−1..+1; negative = actively avoids): ${aff}`);
  if (client.topReason) lines.push(`Current situation: ${client.topReason}`);
  if (client.lastMessageAt) lines.push(`LAST CONTACT: ${client.lastMessageAt}`);

  const holdings = PORTFOLIOS[client.mandate] || [];
  if (holdings.length) {
    const total = holdings.reduce((s, h) => s + h.currentCHF, 0);
    const top = [...holdings].sort((a, b) => b.currentCHF - a.currentCHF).slice(0, 8);
    lines.push(
      `PORTFOLIO (total ${formatMoney(total)}): ` +
        top.map((h) => `${h.issuer} (${h.industryGroup}) ${formatMoney(h.currentCHF)}`).join("; ")
    );
  }

  if (client.signals?.length) {
    lines.push("SIGNALS: " + client.signals.map((s) => `${s.headline} — ${s.summary} (sev ${s.severity})`).join(" | "));
  }
  if (client.recommendations?.length) {
    lines.push("RECOMMENDATIONS: " + client.recommendations.map((r) => `${r.action} — ${r.rationale}`).join(" | "));
  }

  const traits = behavioralForClient(client.id);
  if (traits.length) {
    lines.push("BEHAVIORAL (from real trades): " + traits.map((t) => `${t.label} — ${t.detail}`).join(" | "));
  }

  if (opts.model && opts.model.sampleSize > 0) {
    const m = opts.model;
    lines.push(
      `LEARNING: ${Math.round(m.acceptanceRate * 100)}% acceptance over ${m.sampleSize} decisions` +
        (m.preferredVoice ? ` · prefers ${m.preferredVoice} tone` : "")
    );
  }

  if (opts.notes?.length) {
    lines.push("CONVERSATION NOTES: " + opts.notes.slice(0, 5).map((n) => `(${n.date}) ${n.text}`).join(" | "));
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/clientContext.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/clientContext.ts frontend/src/lib/clientContext.test.ts
git commit -m "feat: buildClientContext grounding builder for ask copilot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Frontend `AskClient` component

**Files:**
- Create: `frontend/src/components/AskClient.tsx`

**Interfaces:**
- Consumes: `buildClientContext` (Task 4); `ChatMessage` from `../types`; `useLearning` from `../lib/learningStore` (`.modelFor(client)`); `useConversation` from `../lib/conversationStore` (`.notes` → `ConversationEntry[]`, each with `.clientId` and `.note.{text,date}`).
- Produces: `export function AskClient({ client }: { client: Client }): JSX.Element`. POSTs `{ client, context, question, history }` to `/api/ask`; renders a threaded chat.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/AskClient.tsx`:

```tsx
import { useMemo, useRef, useState } from "react";
import type { Client, ChatMessage } from "../types";
import { buildClientContext } from "../lib/clientContext";
import { useLearning } from "../lib/learningStore";
import { useConversation } from "../lib/conversationStore";

const SUGGESTIONS = [
  "What should I lead with?",
  "Summarise their portfolio risk",
  "What changed since last contact?",
];

export function AskClient({ client }: { client: Client }) {
  const { modelFor } = useLearning();
  const { notes } = useConversation();
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [aiEngine, setAiEngine] = useState<Record<number, boolean>>({});
  const seqRef = useRef(0);

  const clientNotes = useMemo(
    () => notes.filter((n) => n.clientId === client.id).map((n) => ({ text: n.note.text, date: n.note.date })),
    [notes, client.id]
  );
  const context = useMemo(
    () => buildClientContext(client, { model: modelFor(client), notes: clientNotes }),
    [client, modelFor, clientNotes]
  );

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    const history = thread.slice();
    const next: ChatMessage[] = [...thread, { role: "rm", text: q }];
    setThread(next);
    setInput("");
    setPending(true);
    const seq = ++seqRef.current;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client, context, question: q, history }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { answer: string; engine: string } | null) => {
        if (seq !== seqRef.current) return;
        const answer = d?.answer || "I couldn't reach the copilot just now — try again.";
        setThread((t) => {
          const idx = t.length;
          setAiEngine((m) => ({ ...m, [idx]: d?.engine === "anthropic" }));
          return [...t, { role: "copilot", text: answer }];
        });
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setThread((t) => [...t, { role: "copilot", text: "I couldn't reach the copilot just now — try again." }]);
      })
      .finally(() => { if (seq === seqRef.current) setPending(false); });
  }

  return (
    <div className="askclient">
      <div className="section-title">Ask about {client.name}</div>
      <div className="ask-thread">
        {thread.length === 0 && !pending && (
          <p className="ask-empty">Ask the copilot anything about {client.name} — grounded in their DNA, portfolio, signals and history.</p>
        )}
        {thread.map((m, i) => (
          <div key={i} className={"ask-bubble " + m.role}>
            {m.text}
            {m.role === "copilot" && aiEngine[i] && <span className="ask-ai" title="Answered by the LLM copilot"> ✦ AI</span>}
          </div>
        ))}
        {pending && (
          <div className="sim-thinking" role="status" aria-live="polite">
            <div className="sim-dots" aria-hidden="true"><span /><span /><span /></div>
            <p className="sim-thinking-label">Reading {client.name}'s file…</p>
          </div>
        )}
      </div>

      {thread.length === 0 && (
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ask-chip" onClick={() => send(s)} disabled={pending}>{s}</button>
          ))}
        </div>
      )}

      <div className="ask-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={`Ask about ${client.name}…`}
          disabled={pending}
        />
        <button onClick={() => send(input)} disabled={!input.trim() || pending}>Ask</button>
      </div>
      <p className="ask-note">Answers for the RM — grounded in what's on file. Review before acting.</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: no errors. (If `ChatMessage` import is reported unused anywhere else, ignore — it is used here.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AskClient.tsx
git commit -m "feat: AskClient threaded Q&A component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mount `AskClient` in the client page + styles

**Files:**
- Modify: `frontend/src/components/ClientPage.tsx` (import + render at top of right column, keyed per client)
- Modify: `frontend/src/index.css` (add `.askclient` block)

**Interfaces:**
- Consumes: `AskClient` from `./AskClient` (Task 5).
- Produces: the chat rendered above `ConversationCapture`.

- [ ] **Step 1: Add the import**

In `frontend/src/components/ClientPage.tsx`, after the `import { ConversationCapture } from "./ConversationCapture";` line (line 21), add:

```tsx
import { AskClient } from "./AskClient";
```

- [ ] **Step 2: Render it at the top of the right column**

In `ClientPage`, the right column begins (line ~142):

```tsx
          {/* Right: relationship tools first (capture), then supporting detail */}
          <div className="cp-col">
            <ConversationCapture client={mergedClient} />
```

Change to mount the chat first, keyed per client so the thread resets on switch:

```tsx
          {/* Right: ask-the-copilot first, then relationship tools and detail */}
          <div className="cp-col">
            <AskClient key={"ask-" + mergedClient.id} client={mergedClient} />

            <ConversationCapture client={mergedClient} />
```

- [ ] **Step 3: Add styles**

Append to `frontend/src/index.css`:

```css
/* ── Ask-about-client chat ─────────────────────────────────────────── */
.askclient { margin-bottom: 18px; }
.ask-thread { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.ask-empty { font-size: 12.5px; color: var(--text-faint); line-height: 1.5; margin: 0; }
.ask-bubble {
  max-width: 88%; padding: 8px 11px; border-radius: 12px; font-size: 13px;
  line-height: 1.5; white-space: pre-wrap; word-break: break-word;
}
.ask-bubble.rm { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
.ask-bubble.copilot { align-self: flex-start; background: var(--surface-2, #f4f5f7); color: var(--text); border-bottom-left-radius: 4px; }
.ask-ai { font-size: 10px; opacity: 0.65; margin-left: 6px; }
.ask-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.ask-chip {
  font-size: 12px; padding: 5px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--border, #d8dbe0); background: transparent; color: var(--text-dim);
}
.ask-chip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.ask-chip:disabled { opacity: 0.5; cursor: default; }
.ask-composer { display: flex; gap: 6px; }
.ask-composer input {
  flex: 1; padding: 8px 11px; border-radius: 8px; border: 1px solid var(--border, #d8dbe0);
  background: var(--surface, #fff); color: var(--text); font-size: 13px;
}
.ask-composer button {
  padding: 8px 14px; border-radius: 8px; border: none; background: var(--accent);
  color: #fff; font-weight: 600; font-size: 13px; cursor: pointer;
}
.ask-composer button:disabled { opacity: 0.5; cursor: default; }
.ask-note { font-size: 11px; color: var(--text-faint); margin: 6px 0 0; }
```

If any CSS var above (`--surface-2`, `--border`, `--surface`) is not defined in this file, the fallback in each declaration applies — no action needed.

- [ ] **Step 4: Typecheck + lint + build**

Run:
```bash
cd frontend && npx tsc -b && npm run lint && npm run build
```
Expected: all clean (no TS errors, no lint errors, build succeeds).

- [ ] **Step 5: Manual smoke test**

Run the backend + frontend and verify the chat answers on a client page:
```bash
# terminal 1
node news-test/server.mjs
# terminal 2
cd frontend && npm run dev
```
Open `http://localhost:5173`, navigate to a client page. Confirm: the "Ask about {name}" panel shows at the top of the right column; clicking a suggestion chip shows the RM bubble + thinking dots + a copilot answer; typing a follow-up keeps the thread; switching clients resets the thread.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ClientPage.tsx frontend/src/index.css
git commit -m "feat: mount AskClient chat on the client page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Docs touch-up

**Files:**
- Modify: `news-test/README.md` (document `/api/ask` + `ASK_MODEL`/`ASK_EFFORT`)

**Interfaces:** none.

- [ ] **Step 1: Document the endpoint**

In `news-test/README.md`, find the section listing the seams/endpoints (near the `simulate` / `/api/simulate` mention) and add an entry:

```markdown
- **`POST /api/ask`** — ask-about-client copilot. Body `{ client, context, question, history }`
  → `{ answer, engine, model }`. Backed by `ask.mjs` (Anthropic, key from `demo/.env`);
  degrades to a deterministic keyword router. Overrides: `ASK_MODEL` (default
  `claude-opus-4-8`), `ASK_EFFORT` (default `medium`).
```

(If no such list exists, add a short "Ask seam" subsection mirroring the Simulate one.)

- [ ] **Step 2: Verify the full suites once more**

Run:
```bash
node --test news-test/*.test.mjs
cd frontend && npx vitest run && npx tsc -b
```
Expected: all PASS / clean.

- [ ] **Step 3: Commit**

```bash
git add news-test/README.md
git commit -m "docs: document the /api/ask seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `ask.mjs` + `/api/ask` contract → Tasks 1–3. ✔
- System prompt (equips RM, grounds on context, admits gaps) → Task 2. ✔
- History replay for multi-turn → Task 2 (`historyMessages`), Task 5 (sends `history`). ✔
- Heuristic keyword router fallback → Task 1. ✔
- `askInfo()` + boot log → Tasks 1, 3. ✔
- Frontend context assembly (DNA, portfolio, behavioral, learning, notes) → Task 4. ✔
- `AskClient` threaded chat, suggestions, thinking animation, seq guard, AI marker, error bubble → Task 5. ✔
- Top of right column, keyed per client → Task 6. ✔
- `.askclient` styles → Task 6. ✔
- `ask.test.mjs` + tsc/lint → Tasks 1–2, 6. ✔
- Out-of-scope items (persistence, streaming, book-wide, sending) → not implemented. ✔

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output.

**Type consistency:** `ask({ client, context, question, history })` and return `{ answer, engine, model }` consistent across Tasks 1–3, 5. `buildClientContext(client, { model?, notes? })` consistent Tasks 4–5. `ChatMessage` (`role: "rm" | "copilot"`) reused from `types.ts` in Task 5. `behavioralForClient`, `formatMoney`, `PORTFOLIOS`, `modelFor`, `useConversation().notes` match verified signatures.
