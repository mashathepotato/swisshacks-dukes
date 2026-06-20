# Dynamic Transcript Digest — Design

**Date:** 2026-06-20
**Branch:** `feat/voice-conversation-capture` (same branch as the voice-capture feature)
**Status:** Approved design — ready for implementation planning

## One-liner

While the RM records a client conversation, show a **live rolling digest** (cheap
model); on Stop, run a **finalize pass** that connects the talk to the client's
history, escalating to a stronger model when the conversation is long or covers
many topics.

## Relationship to the voice-capture feature

This extends the existing Voice Conversation Capture panel (`ConversationCapture`)
on the client page. The capture flow (consent → record → distill → review →
approve, producing a CRM note + DNA deltas) is unchanged. The digest is a new,
**separate** read-only understanding surface shown during/after recording — it
does not feed the DNA-delta distill.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Digest timing | **Live during recording + a finalize pass on Stop** |
| Escalation trigger | **On length / complexity** of the transcript |
| Provider / models | **Anthropic: Haiku (live) + Sonnet (heavy finalize)** |

## Models & routing

- **Provider:** Anthropic Messages API. Key read from `demo/.env` as
  `ANTHROPIC_API_KEY` (loaded by the existing `news-test/env.mjs`).
- **Live pass:** Claude **Haiku** (default `claude-haiku-4-5-20251001`), no
  history — fast rolling summary as the conversation streams in.
- **Finalize pass (on Stop):** model chosen by a complexity metric over the
  transcript:
  - `words ≥ FINALIZE_WORDS (default 350)` **OR** `topics ≥ FINALIZE_TOPICS
    (default 3)` → **Sonnet** (default `claude-sonnet-4-6`)
  - otherwise → **Haiku**
  - `topics` = count of distinct keyword themes detected (reuse the theme keyword
    idea from `distill.mjs`).
- The finalize pass **always** receives the client's history as context (see
  below), regardless of which model is chosen.
- **Model IDs and thresholds are env-configurable**
  (`DIGEST_MODEL_SMALL`, `DIGEST_MODEL_LARGE`, `FINALIZE_WORDS`,
  `FINALIZE_TOPICS`).
- **Fallback:** no `ANTHROPIC_API_KEY` or any API error → a deterministic
  **heuristic digest** (extractive summary = first/most-salient sentences +
  keyword topics). Never hard-fails the demo (matches the project invariant).
- The `DigestResult` carries the **model used**, surfaced as a badge in the UI
  ("Haiku" / "Sonnet" / "heuristic") — a transparency signal for judges.

## History the finalize pass connects to

For `mode:"final"`, the backend loads the client's CRM notes from
`data/crm/crm_<clientId>.csv` (columns `Date, Medium, RM Name, Client Contact,
Note`). The 4 personas map directly by id (`ammann`, `schneider`, `huber`,
`raeber`); unknown ids (synthetic twins) gracefully get no history. The frontend
additionally passes a compact current-DNA summary (`dnaContext`: values,
dislikes, top affinities) in the request body so the finalize digest can relate
the conversation to what the dashboard already believes about the client.

## Components & boundaries

- **`news-test/digest.mjs`** *(new)* — the digest engine seam. Exports
  `digest({clientId, transcript, mode, dnaContext})`. Internals:
  - `chooseModel(transcript)` → `{model, tier}` via the complexity metric.
  - `loadHistory(clientId)` → recent CRM notes (last ~8) from the CSV, or `[]`.
  - `anthropicDigest(transcript, model, context)` → calls the Anthropic Messages
    API (`https://api.anthropic.com/v1/messages`, `x-api-key`,
    `anthropic-version`), parses a JSON digest object.
  - `heuristicDigest(transcript)` → deterministic extractive digest.
  - `digest(...)` resolves engine: heuristic when no key; else live→Haiku,
    final→`chooseModel`; on any API error, fall back to heuristic.
- **`POST /api/transcript/digest`** *(new route in `news-test/server.mjs`)* —
  body `{clientId, transcript, mode:"live"|"final", dnaContext?}`; returns a
  `DigestResult`. Reuses the existing `readJson` helper.
- **Frontend digest in `ConversationCapture`** — a **Digest panel** in the record
  phase:
  - During recording, debounced live calls: fire when `≥ ~40` new words since the
    last digest **and** `≥ 5s` elapsed; ignore stale responses via a request
    sequence number.
  - On Stop, one `mode:"final"` call (passing `dnaContext` from the `client`).
  - Renders `summary`, `bullets`, `topics`, the **model badge**, and (final only)
    `historyLinks`. The final digest also shows in the review-phase header.
  - The debounce/stale-guard decision logic is extracted into a small **pure
    helper** (`shouldRequestDigest(prevWords, curWords, lastAtMs, nowMs)`) so it
    is unit-testable without timers or the network.

## Data shape

```ts
export interface DigestResult {
  model: string;          // e.g. "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "heuristic"
  mode: "live" | "final";
  summary: string;        // 1–2 sentence rolling summary
  bullets: string[];      // key points so far
  topics: string[];       // detected topics / themes
  historyLinks?: string[]; // (final only) connections drawn to past CRM context
}
```

## Architecture diagrams (deliverables)

Graphviz `dot` (v14.x) is installed; `context/agents.png` is rendered from
`context/agents.dot`. Two diagram deliverables:

1. **Amend `context/agents.dot`** to add the voice-capture + digest path into the
   multi-agent architecture: a **Conversation Capture** node (consent gate → live
   STT) feeding a **Distill** step (→ Client DNA, via the CRM Agent / Value Radar)
   and a **Digest** step. Show the model tiers on the digest (Haiku live / Sonnet
   finalize) and the heuristic fallback. Re-render `context/agents.png`.
2. **Add `context/voice-digest.dot`** (+ render `context/voice-digest.png`) — a
   focused diagram of *just* this bit: the flow `Consent → Live STT → Live digest
   (Haiku) → Stop → Finalize (Haiku | Sonnet by complexity) + CRM history →
   Distill → RM review → merge`, clearly labelling **which model runs where** and
   the **heuristic fallback** on every model call. Match the existing dark theme
   styling from `agents.dot` (same `bgcolor`, fonts, node styles) for visual
   consistency.

Both PNGs are committed alongside their `.dot` sources.

## Testing

- **Backend (`node:test`):**
  - `chooseModel`: short/simple transcript → small tier; long (`≥ FINALIZE_WORDS`)
    or multi-topic (`≥ FINALIZE_TOPICS`) → large tier.
  - `heuristicDigest`: returns the `DigestResult` shape with non-empty
    `summary`/`topics` for a sample transcript.
  - `loadHistory`: parses a persona CSV (e.g. `ammann`) into notes; returns `[]`
    for an unknown clientId.
  - Anthropic network calls are NOT exercised (force heuristic / test the pure
    pieces).
- **Frontend (`vitest`):**
  - `shouldRequestDigest` pure helper: fires only when both the word-delta and
    time-delta thresholds are met; suppresses otherwise.
- **Diagrams:** verified by re-rendering both `.dot` files with `dot -Tpng`
  without errors and confirming the PNGs are non-empty.

## Out of scope

- Feeding the digest into the DNA-delta distill (they stay separate).
- Persisting digests across reloads.
- Token-by-token streaming of the digest.
- Re-running alerts / priority from digest output.
