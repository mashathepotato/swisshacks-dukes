# Dialogue Attribution + Theme Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use `- [ ]`.

**Goal:** Split the mic transcript into an RM/Client dialogue via Haiku, feed the labeled text to digest/distill, render the dialogue, and restyle the panel's buttons/tabs to the Swiss house theme.

**Architecture:** New `news-test/dialogue.mjs` seam + `POST /api/transcript/dialogue`. `ConversationCapture.finalize()` calls dialogue first, then digest+distill on the labeled transcript. New `conv-*` CSS classes in `index.css` replace default buttons + dark inline colors.

**Tech Stack:** node:http + Anthropic (backend), React 19 + TS + CSS (frontend).

---

### Task 1: Backend dialogue module

**Files:**
- Create: `news-test/dialogue.mjs`
- Test: `news-test/dialogue.test.mjs`

- [ ] **Step 1: failing test** — create `news-test/dialogue.test.mjs`:
```js
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
```

- [ ] **Step 2: run `node --test news-test/dialogue.test.mjs`** → FAIL (module missing).

- [ ] **Step 3: implement** — create `news-test/dialogue.mjs`:
```js
// Splits a single conversation transcript into an RM/Client dialogue using
// Claude (Haiku). Heuristic fallback returns one "Conversation" turn so the
// demo never hard-fails. Anthropic key read from demo/.env via env.mjs.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.DIALOGUE_MODEL || process.env.DIGEST_MODEL_SMALL || "claude-haiku-4-5-20251001";

export function dialogueInfo() {
  return { engine: ANTHROPIC_READY ? "anthropic" : "heuristic", model: ANTHROPIC_READY ? MODEL : "none" };
}

export function heuristicDialogue(transcript) {
  return { model: "heuristic", turns: [{ speaker: "Conversation", text: String(transcript || "").trim() }] };
}

const VALID = new Set(["RM", "Client"]);

export function toLabeledTranscript(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return "";
  if (turns.length === 1 && turns[0]?.speaker === "Conversation") return String(turns[0].text || "").trim();
  return turns.map((t) => `${VALID.has(t.speaker) ? t.speaker : "RM"}: ${String(t.text || "").trim()}`).join("\n");
}

const SYSTEM =
  "You are given a raw single-stream transcript of a wealth-management meeting between a " +
  "relationship manager (RM) and a client, captured on one microphone with no speaker labels. " +
  "Split it into turns and attribute each to RM or Client using content cues (the RM asks " +
  "questions, advises, and references the portfolio; the client states personal views, " +
  "preferences and circumstances). Respond with ONLY a minified JSON object: " +
  '{"turns":[{"speaker":"RM"|"Client","text":"<the words for this turn, verbatim>"}]}.';

function parseObj(content) {
  const s = content.indexOf("{"); const e = content.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no JSON object in model output");
  return JSON.parse(content.slice(s, e + 1));
}

async function anthropicDialogue(transcript) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content: `Transcript:\n${transcript}` }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const obj = parseObj(text);
  const turns = (Array.isArray(obj.turns) ? obj.turns : [])
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ speaker: VALID.has(t.speaker) ? t.speaker : "Client", text: t.text.trim() }));
  if (!turns.length) throw new Error("no turns parsed");
  return { model: MODEL, turns };
}

export async function dialogue({ transcript }) {
  if (!transcript || !transcript.trim()) return heuristicDialogue(transcript || "");
  if (!ANTHROPIC_READY) return heuristicDialogue(transcript);
  try {
    return await anthropicDialogue(transcript);
  } catch (err) {
    console.warn(`[dialogue] ${MODEL} failed, falling back to heuristic: ${err.message}`);
    return heuristicDialogue(transcript);
  }
}
```

- [ ] **Step 4: run `node --test news-test/dialogue.test.mjs`** → PASS (3 tests).

- [ ] **Step 5: commit**
```bash
git add news-test/dialogue.mjs news-test/dialogue.test.mjs
git commit -m "feat: backend RM/Client dialogue attribution (Haiku + heuristic)"
```

---

### Task 2: Wire `/api/transcript/dialogue` route

**Files:** Modify `news-test/server.mjs`

- [ ] **Step 1:** after `import { digest, digestInfo } from "./digest.mjs";` add:
```js
import { dialogue, dialogueInfo } from "./dialogue.mjs";
```

- [ ] **Step 2:** after the `handleDigest` function add:
```js
async function handleDialogue(req, res) {
  const body = await readJson(req);
  const { transcript } = body;
  if (!transcript) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "transcript is required" }));
  }
  const result = await dialogue({ transcript });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
```

- [ ] **Step 3:** inside the createServer try block, after the `/api/transcript/digest` route line add:
```js
    if (url.pathname === "/api/transcript/dialogue" && req.method === "POST")
      return await handleDialogue(req, res);
```

- [ ] **Step 4:** in the `server.listen` callback, after the `Digest:` log line add:
```js
  console.log(`   Dialogue: ${dialogueInfo().engine} (${dialogueInfo().model})`);
```

- [ ] **Step 5: verify**
```bash
node news-test/server.mjs & sleep 1
curl -s -X POST http://localhost:4000/api/transcript/dialogue -H 'Content-Type: application/json' -d '{"transcript":"How have you been? I have been worried about my reputation lately."}'
curl -s -X POST http://localhost:4000/api/transcript/dialogue -H 'Content-Type: application/json' -d '{}'
kill %1 2>/dev/null; pkill -f news-test/server.mjs 2>/dev/null
```
Expected: first → `{model, turns:[...]}` (RM/Client turns if key set, else one Conversation turn); second → 400.

- [ ] **Step 6: commit**
```bash
git add news-test/server.mjs
git commit -m "feat: add POST /api/transcript/dialogue route"
```

---

### Task 3: Frontend types + dialogue in finalize + render

**Files:** Modify `frontend/src/types.ts`, `frontend/src/components/ConversationCapture.tsx`

- [ ] **Step 1: types** — append to `frontend/src/types.ts`:
```ts
export interface DialogueTurn {
  speaker: "RM" | "Client" | "Conversation";
  text: string;
}
export interface DialogueResult {
  model: string;
  turns: DialogueTurn[];
}
```

- [ ] **Step 2: state + import** — in `ConversationCapture.tsx` add `DialogueResult` to the type import, and add state: `const [turns, setTurns] = useState<DialogueResult["turns"] | null>(null);` (next to `digest`). Add `setTurns(null)` to both `approve()` reset and `switchTab()`.

- [ ] **Step 3: rewrite `finalize()`** to attribute first, then run digest + distill on the labeled transcript:
```tsx
  async function finalize() {
    const raw = rec.transcript.trim();
    if (!raw) return;
    setBusy(true); setErr(null);
    const seq = ++seqRef.current;
    try {
      // 1) attribute speakers (best-effort; falls back to one Conversation turn)
      let labeled = raw;
      try {
        const dr = await fetch("/api/transcript/dialogue", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: raw }),
        });
        if (dr.ok) {
          const dlg = (await dr.json()) as DialogueResult;
          if (seq === seqRef.current) setTurns(dlg.turns);
          if (dlg.turns.length && !(dlg.turns.length === 1 && dlg.turns[0].speaker === "Conversation")) {
            labeled = dlg.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
          }
        }
      } catch { /* keep raw */ }
      if (seq !== seqRef.current) return;
      // 2) digest + distill on the labeled transcript
      const digestReq = fetch("/api/transcript/digest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript: labeled, mode: "final", dnaContext: dnaContextOf(client) }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const distillReq = fetch("/api/transcript/distill", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript: labeled, rmName: consent?.rmName ?? profile.name, clientContact: client.name }),
      }).then(async (r) => { if (!r.ok) throw new Error(`distill failed (${r.status})`); return (await r.json()) as DistillResult; });
      const [d, data] = await Promise.all([digestReq, distillReq]);
      if (seq !== seqRef.current) return;
      if (d) setDigest(d);
      setResult(data);
      setNoteText(data.note.text);
      const init: Record<string, boolean> = {};
      data.dnaDeltas.values.forEach((v) => (init[`v:${v}`] = true));
      data.dnaDeltas.dislikes.forEach((dd) => (init[`d:${dd}`] = true));
      data.dnaDeltas.affinities.forEach((a) => (init[`a:${a.theme}`] = true));
      setAccepted(init);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 4: render dialogue** — inside the voice combined panel, render the dialogue above the digest:
```tsx
              {turns && turns.length > 0 && <DialogueView turns={turns} />}
              {digest && <DigestView d={digest} />}
```

- [ ] **Step 5: add `DialogueView`** at the end of the file:
```tsx
function DialogueView({ turns }: { turns: DialogueResult["turns"] }) {
  if (turns.length === 1 && turns[0].speaker === "Conversation") {
    return (
      <div className="conv-dialogue">
        <div className="conv-dialogue-label">Transcript</div>
        <p style={{ margin: "4px 0", fontSize: 13 }}>{turns[0].text}</p>
      </div>
    );
  }
  return (
    <div className="conv-dialogue">
      <div className="conv-dialogue-label">Dialogue · AI-inferred speakers</div>
      {turns.map((t, i) => (
        <div key={i} className={`conv-turn ${t.speaker === "RM" ? "rm" : "client"}`}>
          <span className="conv-turn-who">{t.speaker}</span> {t.text}
        </div>
      ))}
    </div>
  );
}
```
Add `DialogueResult` to the type import if not already present.

- [ ] **Step 6: verify** `cd frontend && npx tsc -b && npm run lint && npm run build && npm run test` (all clean / 8 pass).

- [ ] **Step 7: commit**
```bash
git add frontend/src/types.ts frontend/src/components/ConversationCapture.tsx
git commit -m "feat: attribute RM/Client dialogue on Stop; feed labeled text to digest/distill"
```

---

### Task 4: Theme-aligned buttons, tabs, badge, dialogue styles

**Files:** Modify `frontend/src/index.css`, `frontend/src/components/ConversationCapture.tsx`

- [ ] **Step 1: add CSS** — append to `frontend/src/index.css`:
```css
/* Conversation Capture — house-style controls */
.conv-tabs { display: flex; gap: 6px; margin: 8px 0 14px; }
.conv-tab {
  background: var(--panel-2); border: 1px solid var(--border-soft); color: var(--text-dim);
  border-radius: 2px; padding: 6px 12px; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
}
.conv-tab:hover:not(:disabled) { color: var(--text); border-color: var(--border); }
.conv-tab.on { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-line); cursor: default; }
.conv-btn {
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  border-radius: 2px; padding: 7px 13px; font-size: 13px; font-family: inherit; cursor: pointer; margin-right: 8px;
}
.conv-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.conv-btn:disabled { opacity: .45; cursor: default; }
.conv-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.conv-btn.primary:hover:not(:disabled) { background: #c4310f; border-color: #c4310f; color: #fff; }
.conv-badge {
  padding: 1px 7px; border-radius: 2px; background: var(--accent-soft); color: var(--accent);
  font-size: 11px; font-weight: 700; letter-spacing: .02em;
}
.conv-dialogue { margin: 8px 0; padding: 10px 12px; background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: 2px; }
.conv-dialogue-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-faint); margin-bottom: 6px; }
.conv-turn { font-size: 13px; line-height: 1.5; padding: 4px 8px; border-radius: 2px; margin-bottom: 4px; }
.conv-turn.rm { background: var(--accent-soft); }
.conv-turn.client { background: var(--panel); border: 1px solid var(--border-soft); }
.conv-turn-who { font-weight: 700; font-size: 11px; color: var(--accent); margin-right: 6px; }
```

- [ ] **Step 2: swap buttons to classes in `ConversationCapture.tsx`:**
  - Tab bar buttons → `className={\`conv-tab${tab === "voice" ? " on" : ""}\`}` / `" on"` for manual; drop the `disabled`-based styling reliance but keep `disabled={tab === ...}`.
  - Record + "Generate insights" (voice + manual) + Approve → `className="conv-btn primary"`.
  - Stop, consent "verbally"/"in writing" → `className="conv-btn"`.
  - Replace the DigestView badge `<span style={{...purple...}}>` with `<span className="conv-badge">`.
  - Remove the dark-theme inline color fallbacks where a class now covers it; keep layout-only inline styles (margins). The outer `.conv-capture` border may switch to `1px solid var(--border)` (drop the `#2a3142` fallback).

- [ ] **Step 3: verify** `cd frontend && npx tsc -b && npm run lint && npm run build && npm run test` (clean / 8 pass).

- [ ] **Step 4: commit**
```bash
git add frontend/src/index.css frontend/src/components/ConversationCapture.tsx
git commit -m "style: house-theme buttons, tabs, badge, and dialogue bubbles for Conversation Capture"
```

---

## Self-Review Notes
- **Spec coverage:** dialogue.mjs + heuristic + toLabeledTranscript (T1), route (T2), finalize attributes then feeds labeled text to digest/distill + renders dialogue (T3), house-style classes replacing default/dark buttons + badge (T4).
- **Type consistency:** `DialogueResult`/`DialogueTurn` defined in T1 step1 (types.ts) and consumed in T3/finalize + DialogueView. Backend `{model, turns}` matches the TS type.
- **Stale-guard:** finalize bumps `seqRef` once and checks it after the dialogue call and again after digest/distill — late responses are dropped; consistent with the existing live-digest guard.
- **Fallback:** dialogue degrades to one "Conversation" turn → finalize keeps the raw transcript for digest/distill; DialogueView shows a plain transcript block.
