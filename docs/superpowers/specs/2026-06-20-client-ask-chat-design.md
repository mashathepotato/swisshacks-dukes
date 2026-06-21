# Ask-about-client chat — design

**Date:** 2026-06-20
**Branch:** `feat/client-ask-chat`
**Status:** approved (pending spec review)

## Goal

Give the RM a chat-style text box on a client's page to ask questions about that
client in natural language and get custom overviews and quick info retrieval —
e.g. "What should I lead with?", "Summarise their portfolio risk", "What changed
since last contact?". The copilot answers from what the firm already knows about
the client; it equips the RM and never advises the client directly.

## Approach

Reuse the existing **Anthropic API seam** pattern already used by `simulate.mjs`,
`dialogue.mjs`, and `digest.mjs`: a new zero-dependency backend module + HTTP
route on the news server, keyed from `demo/.env` (`ANTHROPIC_API_KEY`), that
always degrades to a deterministic heuristic so the demo never hard-fails. The
frontend assembles the grounding context (it is the only place with
`PORTFOLIOS`, `behavioralForClient`, the learning model, and conversation notes)
and renders a threaded chat at the top of the client page's right column.

## Backend — `news-test/ask.mjs` + `/api/ask`

### Contract

`POST /api/ask`

Request body:
```json
{
  "client":   { /* the merged Client object (for name + light profile) */ },
  "context":  "pre-rendered grounding facts as plain text (assembled client-side)",
  "question": "the RM's natural-language question",
  "history":  [ { "role": "rm" | "copilot", "text": "..." }, ... ]
}
```

Response body:
```json
{ "answer": "prose answer for the RM", "engine": "anthropic" | "heuristic", "model": "claude-..." | "none" }
```

`question` is required; `context`/`history` default to empty. Missing `question`
→ 400, mirroring `handleSimulate`.

### `ask({ client, context, question, history })`

- Reads `ANTHROPIC_API_KEY` from `process.env` (populated by `env.mjs`).
  `ASK_MODEL` (default `claude-opus-4-8`) and `ASK_EFFORT` (default `medium`)
  overrides, matching `simulate.mjs`. Exposes `askInfo()` → `{ engine, model }`,
  logged on server boot alongside the other seams.
- **System prompt:** "You are a relationship manager's copilot inside a Swiss
  private bank. Answer the RM's question about THIS client using ONLY the
  grounding facts provided. Be concise and specific; prefer the client's own
  values, holdings and history over generalities. You equip the RM — you never
  address or advise the client directly, and the RM keeps the final say. If a
  fact isn't in the grounding context, say so plainly rather than inventing it."
- Replays `history` as prior `user`/`assistant` messages (rm→user,
  copilot→assistant) so multi-turn follow-ups have context, then appends the
  grounding `context` + the new `question` as the final user message.
- Returns prose text (NOT JSON) — the answer is the model's text content joined.
- Adaptive thinking + effort, same call shape as `simulate.mjs`.

### Heuristic fallback

Used when there is no key, the call fails, or output is empty. Routes the
question by keyword over the **same `context` string** and returns a templated
overview, so the offline fixture demo still answers:

- portfolio / holdings / risk / mandate / values / dislikes / signals /
  recommendations / "last contact" / behavioral / learning → return the matching
  section(s) of the context, lightly framed ("Here's what's on file for
  {name}: …").
- No keyword match → return a short overview (name, archetype, mandate, top
  reason) plus a note that a more specific question yields a sharper answer.

The fallback is pure and deterministic (no key, no network) — directly unit
testable.

## Frontend — `frontend/src/components/AskClient.tsx`

Rendered at the **top of the right column** in `ClientPage.tsx`, above
`ConversationCapture`, keyed by client id so the thread resets on client switch.

### Context assembly

A local `buildContext(client)` composes a plain-text grounding block from data
the component already has access to:

- **DNA:** name, archetype, mandate, risk profile, comm style, tenure, values,
  dislikes, signed affinities, priority score, top reason, last contact.
- **Portfolio:** `PORTFOLIOS[client.mandate]` — issuer, ISIN, sector, value via
  `formatMoney`, plus the total portfolio value.
- **Signals & recommendations:** off the merged client object.
- **Behavioral DNA:** `behavioralForClient(client.id)` traits (skipped for
  synthetic twins with no real portfolio).
- **Learning:** `modelFor(client)` — acceptance rate, sample size, preferred
  tone.
- **Conversation notes:** entries from `useConversation().notes` filtered to this
  client.

### Chat UI

- Reuses the existing `ChatMessage` type (`{ role: "rm" | "copilot"; text }`).
  Thread state is `useState<ChatMessage[]>([])`, in-memory for the session,
  reset on client switch (component is keyed in the parent).
- Composer `<input>` + send button; Enter-to-send (same idiom as the Rehearse
  composer). Empty input is a no-op.
- On send: push the RM message, POST `{ client, context, question, history }`
  to `/api/ask`, show the existing `sim-thinking` dots animation while awaiting,
  then push the copilot answer. A `seqRef` guard discards stale responses if the
  client switched mid-flight (same pattern as `Rehearse.tsx`).
- 3 **suggested-question chips** seed discovery and disappear once a thread
  starts: "What should I lead with?", "Summarise their portfolio risk", "What
  changed since last contact?". Clicking one sends it.
- An `✦ AI` marker on copilot bubbles when `engine === "anthropic"`, mirroring
  Rehearse's "AI-refined" treatment.

### Error handling

A failed/aborted fetch yields an inline copilot bubble ("I couldn't reach the
copilot just now — try again."). The backend already degrades to the heuristic,
so a reachable server always returns a usable answer; the client-side bubble
only covers transport failure. Never blocks the page.

## Styling

Add a small `.askclient` block to `frontend/src/index.css` following existing
conventions (cards, chips, `sim-thinking`). RM bubbles right-aligned/accent,
copilot bubbles left-aligned/neutral. No new dependencies.

## Testing

- `news-test/ask.test.mjs` (`node --test`): heuristic routing returns the right
  section per keyword; `ask()` returns the heuristic shape with `engine:
  "heuristic"` when no key is set; malformed/empty model output falls back.
  Mirrors `simulate.test.mjs`.
- `npx tsc -b` + `npm run lint` clean in `frontend/`.

## Out of scope (YAGNI)

- Persisting chat history across sessions or reloads (in-memory only).
- Streaming responses (single response, with the thinking animation).
- Cross-client / book-wide questions (this is the per-client page).
- Sending anything to the client — drafting/sending stays in `DraftMessage`.
