# Voice Conversation Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a consented client call/lunch, transcribe it live in-browser, and distill it into a reviewed CRM note + Client-DNA deltas that merge into the dashboard.

**Architecture:** In-browser Web Speech API for live STT → POST final transcript to a new `node:http` route (`/api/transcript/distill`) that reuses the existing pluggable engine seam (phoeniqs/claude/heuristic) → RM reviews/edits/approves in a panel on the client page → accepted deltas merge into a client-side conversation store.

**Tech Stack:** React 19 + Vite + TypeScript (frontend), zero-dep `node:http` server (`news-test/`), `node:test` (backend tests), `vitest` (frontend pure-logic tests).

---

## File Structure

- `news-test/distill.mjs` *(create)* — DNA-extraction engine seam + heuristic fallback. Exports `distill({clientId, transcript, rmName, clientContact, date})`.
- `news-test/distill.test.mjs` *(create)* — `node:test` for the heuristic + LLM-response parsing.
- `news-test/server.mjs` *(modify)* — add `POST /api/transcript/distill` route + JSON body reader.
- `frontend/vite.config.ts` *(modify)* — proxy `/api` → `http://localhost:4000`.
- `frontend/src/types.ts` *(modify)* — add `ConsentRecord`, `AffinityDelta`, `DnaDeltas`, `DistillNote`, `DistillResult`.
- `frontend/src/lib/conversation.ts` *(create)* — pure `mergeDeltas(client, deltas)` + `applyConversation`.
- `frontend/src/lib/conversation.test.ts` *(create)* — `vitest` for `mergeDeltas`.
- `frontend/src/lib/conversationStore.tsx` *(create)* — context provider mirroring `learningStore.tsx`.
- `frontend/src/lib/useRecorder.ts` *(create)* — Web Speech API hook.
- `frontend/src/components/ConversationCapture.tsx` *(create)* — ConsentGate + Recorder + DistillReview, the client-page panel.
- `frontend/src/components/ClientPage.tsx` *(modify)* — mount `<ConversationCapture client={client} />`.
- `frontend/src/main.tsx` *(modify)* — wrap app in `ConversationProvider`.
- `frontend/package.json` *(modify)* — add `vitest` devDep + `test` script.

---

### Task 1: Backend distill module (heuristic + parsing)

**Files:**
- Create: `news-test/distill.mjs`
- Test: `news-test/distill.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `news-test/distill.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test news-test/distill.test.mjs`
Expected: FAIL — `Cannot find module './distill.mjs'` / export not defined.

- [ ] **Step 3: Write minimal implementation**

Create `news-test/distill.mjs`:

```js
// DNA-extraction seam for conversation transcripts. Mirrors assessor.mjs:
//   phoeniqs (OpenAI-compatible LLM) | heuristic (deterministic fallback).
// Always degrades to the heuristic so the demo never hard-fails.

const PHOENIQS_KEY = process.env.PHOENIQS_API_KEY || "";
const PHOENIQS_URL = process.env.PHOENIQS_API_URL || "https://maas.phoeniqs.com/v1";
const PHOENIQS_MODEL = process.env.PHOENIQS_MODEL || "inference-gpt-oss-120b";
const PHOENIQS_READY = Boolean(PHOENIQS_KEY) && !PHOENIQS_KEY.startsWith("your_");
const ENGINE = process.env.DISTILL_ENGINE || (PHOENIQS_READY ? "phoeniqs" : "heuristic");

// The fixed frontend ThemeId universe (must match frontend/src/types.ts ThemeId).
export const THEME_IDS = [
  "environmental", "us_tech_bullish", "defensive", "income", "reputation", "healthcare",
];

// Deterministic keyword → DNA mapping.
const KEYWORDS = [
  { theme: "reputation",     re: /reputation|exploitation|scandal|labour|press/i,
    value: "Reputation = financial risk", dislike: "Labour exploitation" },
  { theme: "environmental",  re: /environment|reforest|climate|sustainab|palm.?oil|deforest/i,
    value: "Environmental impact", dislike: null },
  { theme: "healthcare",     re: /health|pharma|research|disease|illness|foundation/i,
    value: "Funds medical research", dislike: null },
  { theme: "us_tech_bullish",re: /\bus tech\b|silicon valley|nvidia|ai stock|tech hype/i,
    value: "Open to US tech", dislike: "US tech hype" },
  { theme: "defensive",      re: /conservative|defensive|capital preservation|low risk|cautious/i,
    value: "Capital preservation", dislike: null },
  { theme: "income",         re: /income|dividend|yield|coupon|cash flow/i,
    value: "Income focus", dislike: null },
];

export function distillInfo() {
  return { engine: ENGINE, model: ENGINE === "phoeniqs" ? PHOENIQS_MODEL : "keyword", llmReady: ENGINE !== "heuristic" };
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function distillHeuristic({ clientId, transcript, rmName, clientContact, date }) {
  const sents = sentences(transcript);
  const affinities = [];
  const values = new Set();
  const dislikes = new Set();
  const receipts = [];
  for (const k of KEYWORDS) {
    const hit = sents.find((s) => k.re.test(s));
    if (!hit) continue;
    affinities.push({ theme: k.theme, fromWeight: 0, toWeight: 0.7 });
    if (k.value) values.add(k.value);
    if (k.dislike && k.dislike.split(" ").some((w) => new RegExp(w, "i").test(hit))) dislikes.add(k.dislike);
    receipts.push({
      kind: "crm",
      sourceId: `transcript:${clientId}:${date}`,
      quote: hit,
      date,
    });
  }
  const text =
    `Conversation with ${clientContact} on ${date}. ` +
    (sents.slice(0, 2).join(" ") || transcript.slice(0, 200));
  return {
    note: { date, medium: "In-person (conversation)", rmName, clientContact, text },
    dnaDeltas: { values: [...values], dislikes: [...dislikes], affinities },
    receipts,
  };
}

export function parseLlmDistill(content, { clientId, transcript, rmName, clientContact, date }) {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in LLM output");
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  const affinities = (Array.isArray(obj.affinities) ? obj.affinities : [])
    .filter((a) => THEME_IDS.includes(a?.theme))
    .map((a) => ({ theme: a.theme, fromWeight: 0, toWeight: clamp01(a.weight) }));
  const receipts = (Array.isArray(obj.receipts) ? obj.receipts : [])
    .filter((q) => typeof q === "string" && transcript.includes(q))
    .map((q) => ({ kind: "crm", sourceId: `transcript:${clientId}:${date}`, quote: q, date }));
  return {
    note: {
      date, medium: "In-person (conversation)", rmName, clientContact,
      text: String(obj.note_text || "").trim() || `Conversation with ${clientContact} on ${date}.`,
    },
    dnaDeltas: {
      values: (Array.isArray(obj.values) ? obj.values : []).map(String),
      dislikes: (Array.isArray(obj.dislikes) ? obj.dislikes : []).map(String),
      affinities,
    },
    receipts,
  };
}

function clamp01(n) {
  const v = typeof n === "number" ? n : 0.5;
  return Math.max(0, Math.min(1, v));
}

const SYSTEM =
  "You distill a wealth-management client conversation into structured Client DNA. " +
  `Pick affinity themes ONLY from this fixed list: ${THEME_IDS.join(", ")}. ` +
  "Respond with ONLY a minified JSON object: " +
  `{"note_text":"<=60 word CRM note","values":[...],"dislikes":[...],` +
  `"affinities":[{"theme":<one of the list>,"weight":0..1}],` +
  `"receipts":["<verbatim sentence copied EXACTLY from the transcript>"]}.`;

async function distillWithLlm(args) {
  const res = await fetch(`${PHOENIQS_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PHOENIQS_KEY}` },
    body: JSON.stringify({
      model: PHOENIQS_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Transcript:\n${args.transcript}` },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`Phoeniqs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  return parseLlmDistill(data?.choices?.[0]?.message?.content || "", args);
}

export async function distill(args) {
  if (ENGINE === "heuristic") return distillHeuristic(args);
  try {
    return await distillWithLlm(args);
  } catch (err) {
    console.warn(`[distill] ${ENGINE} failed, falling back to heuristic: ${err.message}`);
    return distillHeuristic(args);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test news-test/distill.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add news-test/distill.mjs news-test/distill.test.mjs
git commit -m "feat: backend transcript distill (heuristic + phoeniqs seam)"
```

---

### Task 2: Wire the `/api/transcript/distill` route

**Files:**
- Modify: `news-test/server.mjs`

- [ ] **Step 1: Add the import**

In `news-test/server.mjs`, below the `assessBatch` import line, add:

```js
import { distill, distillInfo } from "./distill.mjs";
```

- [ ] **Step 2: Add a JSON body reader + handler**

Above the `const server = createServer(...)` line, add:

```js
function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => { buf += c; if (buf.length > 1e6) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

async function handleDistill(req, res) {
  const body = await readJson(req);
  const { clientId, transcript, rmName, clientContact, date } = body;
  if (!clientId || !transcript) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "clientId and transcript are required" }));
  }
  const result = await distill({
    clientId,
    transcript,
    rmName: rmName || "RM",
    clientContact: clientContact || "Client",
    date: date || new Date().toISOString().slice(0, 10),
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ engine: distillInfo(), ...result }));
}
```

- [ ] **Step 3: Register the route**

Inside the `createServer` callback `try` block, add before the `/api/news` line:

```js
    if (url.pathname === "/api/transcript/distill" && req.method === "POST")
      return await handleDistill(req, res);
```

- [ ] **Step 4: Manual verify**

Run (terminal A): `node news-test/server.mjs`
Run (terminal B):
```bash
curl -s -X POST http://localhost:4000/api/transcript/distill \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"ammann","transcript":"Any link to labour exploitation is unacceptable. My reputation is my business.","rmName":"T. Keller","clientContact":"Mr Ammann","date":"2026-06-20"}'
```
Expected: JSON with `note`, `dnaDeltas` (a `reputation` affinity), `receipts` quoting the transcript, and an `engine` field.

- [ ] **Step 5: Commit**

```bash
git add news-test/server.mjs
git commit -m "feat: add POST /api/transcript/distill route"
```

---

### Task 3: Vite dev proxy for `/api`

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Add the proxy**

Replace the contents of `frontend/vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
```

- [ ] **Step 2: Manual verify**

With `node news-test/server.mjs` running, run `cd frontend && npm run dev`, then in another terminal:
```bash
curl -s -X POST http://localhost:5173/api/transcript/distill -H 'Content-Type: application/json' -d '{"clientId":"ammann","transcript":"My reputation is my business."}'
```
Expected: same JSON shape as Task 2 (proxied through vite).

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat: proxy /api to the news-test server in dev"
```

---

### Task 4: Frontend types + pure merge logic

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/conversation.ts`
- Test: `frontend/src/lib/conversation.test.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Add vitest tooling**

Run: `cd frontend && npm install -D vitest`
Then in `frontend/package.json` `"scripts"`, add: `"test": "vitest run"`.

- [ ] **Step 2: Add types**

Append to `frontend/src/types.ts`:

```ts
export interface ConsentRecord {
  clientId: string;
  rmName: string;
  method: "verbal" | "written";
  timestamp: string; // ISO datetime
}

export interface AffinityDelta {
  theme: ThemeId;
  fromWeight: number; // current weight (0 if new)
  toWeight: number;   // proposed weight (0..1)
}

export interface DnaDeltas {
  values: string[];
  dislikes: string[];
  affinities: AffinityDelta[];
}

export interface DistillNote {
  date: string;
  medium: string;
  rmName: string;
  clientContact: string;
  text: string;
}

export interface DistillResult {
  note: DistillNote;
  dnaDeltas: DnaDeltas;
  receipts: Evidence[];
}
```

- [ ] **Step 3: Write the failing test**

Create `frontend/src/lib/conversation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeDeltas } from "./conversation";
import type { Client, DnaDeltas } from "../types";

const base = {
  values: ["Existing value"],
  dislikes: [],
  affinities: [{ theme: "reputation", weight: 0.4 }],
} as Partial<Client> as Client;

const deltas: DnaDeltas = {
  values: ["Reputation = financial risk", "Existing value"], // dup ignored
  dislikes: ["Labour exploitation"],
  affinities: [
    { theme: "reputation", fromWeight: 0, toWeight: 0.9 }, // updates existing
    { theme: "environmental", fromWeight: 0, toWeight: 0.6 }, // new
  ],
};

describe("mergeDeltas", () => {
  it("adds new values/dislikes without duplicates", () => {
    const m = mergeDeltas(base, deltas);
    expect(m.values).toEqual(["Existing value", "Reputation = financial risk"]);
    expect(m.dislikes).toEqual(["Labour exploitation"]);
  });
  it("updates an existing affinity weight and appends new ones", () => {
    const m = mergeDeltas(base, deltas);
    const rep = m.affinities.find((a) => a.theme === "reputation");
    const env = m.affinities.find((a) => a.theme === "environmental");
    expect(rep?.weight).toBe(0.9);
    expect(env?.weight).toBe(0.6);
    expect(m.affinities).toHaveLength(2);
  });
  it("does not mutate the input client", () => {
    mergeDeltas(base, deltas);
    expect(base.affinities[0].weight).toBe(0.4);
    expect(base.values).toEqual(["Existing value"]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/conversation.test.ts`
Expected: FAIL — `mergeDeltas` not exported.

- [ ] **Step 5: Write minimal implementation**

Create `frontend/src/lib/conversation.ts`:

```ts
import type { Client, DnaDeltas } from "../types";

/** Pure merge: returns a new Client with the accepted DNA deltas applied. */
export function mergeDeltas(client: Client, deltas: DnaDeltas): Client {
  const values = [...client.values];
  for (const v of deltas.values) if (!values.includes(v)) values.push(v);

  const dislikes = [...client.dislikes];
  for (const d of deltas.dislikes) if (!dislikes.includes(d)) dislikes.push(d);

  const affinities = client.affinities.map((a) => ({ ...a }));
  for (const delta of deltas.affinities) {
    const existing = affinities.find((a) => a.theme === delta.theme);
    if (existing) existing.weight = delta.toWeight;
    else affinities.push({ theme: delta.theme, weight: delta.toWeight });
  }

  return { ...client, values, dislikes, affinities };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/conversation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/lib/conversation.ts frontend/src/lib/conversation.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: conversation types + pure DNA mergeDeltas (tested)"
```

---

### Task 5: Conversation store

**Files:**
- Create: `frontend/src/lib/conversationStore.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create the store**

Create `frontend/src/lib/conversationStore.tsx` (mirrors `learningStore.tsx`):

```tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Client, DnaDeltas, DistillNote, Evidence } from "../types";
import { mergeDeltas } from "./conversation";

export interface ConversationEntry {
  clientId: string;
  note: DistillNote;
  receipts: Evidence[];
}

interface ConversationContextValue {
  /** Approved DNA deltas applied per client. */
  deltasFor: (clientId: string) => DnaDeltas[];
  notes: ConversationEntry[];
  /** Commit an approved conversation: store the note + receipts and the deltas. */
  commit: (clientId: string, deltas: DnaDeltas, note: DistillNote, receipts: Evidence[]) => void;
  /** Returns the client with all approved deltas merged in. */
  withDeltas: (client: Client) => Client;
}

const Ctx = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [deltas, setDeltas] = useState<Record<string, DnaDeltas[]>>({});
  const [notes, setNotes] = useState<ConversationEntry[]>([]);

  const commit = useCallback<ConversationContextValue["commit"]>((clientId, d, note, receipts) => {
    setDeltas((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), d] }));
    setNotes((prev) => [{ clientId, note, receipts }, ...prev]);
  }, []);

  const deltasFor = useCallback((clientId: string) => deltas[clientId] ?? [], [deltas]);

  const withDeltas = useCallback<ConversationContextValue["withDeltas"]>(
    (client) => (deltas[client.id] ?? []).reduce((c, d) => mergeDeltas(c, d), client),
    [deltas]
  );

  const value = useMemo(
    () => ({ deltasFor, notes, commit, withDeltas }),
    [deltasFor, notes, commit, withDeltas]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConversation(): ConversationContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConversation must be used within a ConversationProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap the app**

In `frontend/src/main.tsx`, import the provider and wrap the existing root element (place it as the outermost provider so all pages can read it):

```tsx
import { ConversationProvider } from "./lib/conversationStore";
```
Wrap the rendered `<App />` (and any existing providers) with `<ConversationProvider> ... </ConversationProvider>`.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/conversationStore.tsx frontend/src/main.tsx
git commit -m "feat: conversation store (approved notes + merged DNA deltas)"
```

---

### Task 6: Web Speech recorder hook

**Files:**
- Create: `frontend/src/lib/useRecorder.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/src/lib/useRecorder.ts`:

```ts
import { useCallback, useRef, useState } from "react";

// Minimal Web Speech API typings (not in lib.dom for all targets).
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: SpeechRecognitionLike = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";
  return r;
}

export interface RecorderState {
  supported: boolean;
  recording: boolean;
  transcript: string;   // finalized text
  interim: string;      // in-progress text
  error: string | null;
  start: () => void;
  stop: () => void;
  setTranscript: (t: string) => void; // paste-transcript escape hatch
  reset: () => void;
}

export function useRecorder(): RecorderState {
  const [supported] = useState(() => getRecognition() !== null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscriptState] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const r = getRecognition();
    if (!r) { setError("Speech recognition is not supported in this browser (use Chrome)."); return; }
    recRef.current = r;
    setError(null);
    setInterim("");
    r.onresult = (e: any) => {
      let fin = "", inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += txt; else inter += txt;
      }
      if (fin) setTranscriptState((prev) => (prev ? prev + " " : "") + fin.trim());
      setInterim(inter);
    };
    r.onerror = (e: any) => setError(String(e?.error || "recognition error"));
    r.onend = () => setRecording(false);
    r.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
    setInterim("");
  }, []);

  const setTranscript = useCallback((t: string) => setTranscriptState(t), []);
  const reset = useCallback(() => { setTranscriptState(""); setInterim(""); setError(null); }, []);

  return { supported, recording, transcript, interim, error, start, stop, setTranscript, reset };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/useRecorder.ts
git commit -m "feat: Web Speech recorder hook with paste-transcript fallback"
```

---

### Task 7: ConversationCapture panel (consent → record → review → approve)

**Files:**
- Create: `frontend/src/components/ConversationCapture.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ConversationCapture.tsx`:

```tsx
import { useState } from "react";
import type { Client, ConsentRecord, DistillResult, AffinityDelta } from "../types";
import { useRecorder } from "../lib/useRecorder";
import { useConversation } from "../lib/conversationStore";
import { SIGNAL_META } from "../lib/format"; // existing module; safe to import for styling consts if needed

type Phase = "consent" | "record" | "review";

export function ConversationCapture({ client }: { client: Client }) {
  const rec = useRecorder();
  const { commit } = useConversation();
  const [phase, setPhase] = useState<Phase>("consent");
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [result, setResult] = useState<DistillResult | null>(null);
  const [noteText, setNoteText] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function giveConsent(method: "verbal" | "written") {
    setConsent({
      clientId: client.id,
      rmName: "T. Keller",
      method,
      timestamp: new Date().toISOString(),
    });
    setPhase("record");
  }

  async function distill() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/transcript/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          transcript: rec.transcript,
          rmName: consent?.rmName ?? "RM",
          clientContact: client.name,
        }),
      });
      if (!res.ok) throw new Error(`distill failed (${res.status})`);
      const data: DistillResult = await res.json();
      setResult(data);
      setNoteText(data.note.text);
      const init: Record<string, boolean> = {};
      data.dnaDeltas.values.forEach((v) => (init[`v:${v}`] = true));
      data.dnaDeltas.dislikes.forEach((d) => (init[`d:${d}`] = true));
      data.dnaDeltas.affinities.forEach((a) => (init[`a:${a.theme}`] = true));
      setAccepted(init);
      setPhase("review");
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    if (!result) return;
    const deltas = {
      values: result.dnaDeltas.values.filter((v) => accepted[`v:${v}`]),
      dislikes: result.dnaDeltas.dislikes.filter((d) => accepted[`d:${d}`]),
      affinities: result.dnaDeltas.affinities.filter((a: AffinityDelta) => accepted[`a:${a.theme}`]),
    };
    commit(client.id, deltas, { ...result.note, text: noteText }, result.receipts);
    // reset to consent for a fresh capture
    setPhase("consent"); setConsent(null); setResult(null); rec.reset();
  }

  return (
    <section className="conv-capture" style={{ border: "1px solid var(--border, #2a3142)", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3>🎙️ Conversation Capture — {client.name}</h3>

      {phase === "consent" && (
        <div>
          <p>Recording requires the client's consent. Confirm how consent was given:</p>
          <button onClick={() => giveConsent("verbal")}>Client consented verbally</button>{" "}
          <button onClick={() => giveConsent("written")}>Client consented in writing</button>
        </div>
      )}

      {phase === "record" && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            ✓ Consent ({consent?.method}) recorded {consent?.timestamp}
          </p>
          {!rec.supported && <p style={{ color: "var(--amber, #d69e2e)" }}>Live mic needs Chrome. Paste a transcript below instead.</p>}
          <div>
            {!rec.recording
              ? <button onClick={rec.start} disabled={!rec.supported}>● Record</button>
              : <button onClick={rec.stop}>■ Stop</button>}
          </div>
          <textarea
            value={rec.transcript + (rec.interim ? " " + rec.interim : "")}
            onChange={(e) => rec.setTranscript(e.target.value)}
            rows={6}
            style={{ width: "100%", marginTop: 8 }}
            placeholder="Live transcript appears here… (or paste one)"
          />
          {rec.error && <p style={{ color: "var(--red, #e53e3e)" }}>{rec.error}</p>}
          <button onClick={distill} disabled={busy || !rec.transcript.trim()}>
            {busy ? "Distilling…" : "Distill → review"}
          </button>
          {err && <p style={{ color: "var(--red, #e53e3e)" }}>{err}</p>}
        </div>
      )}

      {phase === "review" && result && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>✓ Consent ({consent?.method}) · {consent?.timestamp}</p>
          <label><strong>CRM note</strong></label>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} style={{ width: "100%" }} />

          <h4>Proposed DNA updates (uncheck to reject)</h4>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {result.dnaDeltas.values.map((v) => (
              <li key={`v:${v}`}><label><input type="checkbox" checked={!!accepted[`v:${v}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`v:${v}`]: e.target.checked }))} /> Value: {v}</label></li>
            ))}
            {result.dnaDeltas.dislikes.map((d) => (
              <li key={`d:${d}`}><label><input type="checkbox" checked={!!accepted[`d:${d}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`d:${d}`]: e.target.checked }))} /> Dislike: {d}</label></li>
            ))}
            {result.dnaDeltas.affinities.map((a) => (
              <li key={`a:${a.theme}`}><label><input type="checkbox" checked={!!accepted[`a:${a.theme}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`a:${a.theme}`]: e.target.checked }))} /> Affinity: {a.theme} → {a.toWeight.toFixed(2)}</label></li>
            ))}
          </ul>

          <h4>Quote receipts</h4>
          <ul>
            {result.receipts.map((r, i) => (
              <li key={i} style={{ fontSize: 13, opacity: 0.85 }}>“{r.quote}” <span style={{ opacity: 0.6 }}>— {r.sourceId}</span></li>
            ))}
          </ul>

          <button onClick={approve}>✓ Approve &amp; merge</button>{" "}
          <button onClick={() => setPhase("record")}>← Back</button>
        </div>
      )}
    </section>
  );
}
```

> Note: the `SIGNAL_META` import is optional styling sugar. If `frontend/src/lib/format.ts` does not export it, delete that import line — it is not otherwise used.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no errors. (If `SIGNAL_META` import errors, remove that line per the note.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConversationCapture.tsx
git commit -m "feat: ConversationCapture panel (consent → record → review → approve)"
```

---

### Task 8: Mount on the client page + DNA reflects approved deltas

**Files:**
- Modify: `frontend/src/components/ClientPage.tsx`

- [ ] **Step 1: Import the panel + store**

In `frontend/src/components/ClientPage.tsx`, add imports:

```tsx
import { ConversationCapture } from "./ConversationCapture";
import { useConversation } from "../lib/conversationStore";
```

- [ ] **Step 2: Use merged client + render the panel**

In the `ClientPage` component, near where `client` is obtained, derive the merged client so the DNA view reflects approved conversations:

```tsx
  const { withDeltas } = useConversation();
  const client = withDeltas(rawClient);
```
(Rename the original resolved client variable to `rawClient`; if it is a prop, do `const client = withDeltas(props.client);` and use `client` downstream.)

Then render the panel inside the page's main column (e.g. just after the `ComplianceDesk` block around line 134):

```tsx
        <ConversationCapture client={client} />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Full manual smoke test**

1. Terminal A: `node news-test/server.mjs` (confirm it logs port 4000).
2. Terminal B: `cd frontend && npm run dev`.
3. Open the app in **Chrome**, navigate to a client (e.g. Ammann).
4. In the Conversation Capture panel: click "Client consented verbally" → "● Record" → say (or paste) "Any link to labour exploitation is unacceptable. My reputation is my business." → "■ Stop" → "Distill → review".
5. Confirm a CRM note, a `reputation` affinity delta, and quote receipts appear.
6. Click "✓ Approve & merge". Confirm the client's DNA/affinities view reflects the change (e.g. reputation affinity weight updated).

- [ ] **Step 5: Run the full test + lint suite**

Run: `cd frontend && npm run test && npm run lint && npx tsc -b`
Then: `node --test news-test/distill.test.mjs`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ClientPage.tsx
git commit -m "feat: mount ConversationCapture on client page; DNA reflects approved deltas"
```

---

## Self-Review Notes

- **Spec coverage:** ConsentGate (Task 7 consent phase + ConsentRecord in Task 4), Recorder/STT (Task 6), `/api/transcript/distill` reusing engine seam + heuristic fallback (Tasks 1–2), DistillReview (Task 7 review phase), store merge into DNA (Tasks 4–5, 8), vite proxy (Task 3). Out-of-scope items (no audio storage, no alert recompute) are respected.
- **Type consistency:** `DistillResult` / `DnaDeltas` / `AffinityDelta` / `ConsentRecord` defined once in Task 4 and used identically in Tasks 5, 7, 8. Backend (`distill.mjs`) returns the same JSON shape (`note`, `dnaDeltas`, `receipts`); affinities carry `fromWeight`/`toWeight`. `mergeDeltas` uses `toWeight` consistently.
- **Reliability:** distill always degrades to the heuristic; recorder degrades to paste-transcript; both surface clear messages.
- **Known tradeoff:** component-level UI is verified via the Task 8 manual smoke test rather than a React testing-library suite (not installed) — deliberate for hackathon speed. Pure logic (`mergeDeltas`, backend heuristic/parse) is unit-tested.
