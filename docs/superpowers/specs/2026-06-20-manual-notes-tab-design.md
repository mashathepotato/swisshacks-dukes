# Manual Notes Tab — Design

**Date:** 2026-06-20
**Branch:** `feat/voice-conversation-capture`
**Status:** Approved design — ready for implementation planning

## One-liner

When a client consents, the RM uses voice capture (as now); when they don't, the
RM types notes manually in a second tab — and either way the system proposes
Client-DNA changes for approval.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Manual-note behaviour | **Still propose DNA changes** (LLM distill on the typed text) + save the note; **no digest** |
| Layout | **Two tabs** — `Voice (consented)` and `Manual notes`; Voice is the default |

## Layout

The Conversation Capture panel gains a tab bar with two tabs:

- **`Voice (consented)`** — the **default** active tab. Unchanged flow: consent
  gate → record → live digest → Stop → combined panel (digest + proposed DNA
  changes + note + receipts + Approve). A hint under the consent buttons points
  the RM to Manual notes when consent isn't given.
- **`Manual notes`** — requires no consent. A notes `textarea` + a
  **"Generate insights"** button.

Tabs are switchable anytime; per-session state (consent, transcript, manual
text, result, digest) is preserved when switching.

## Manual notes flow

1. RM types notes into the textarea.
2. Clicks **Generate insights** → runs **distill only** on the typed text
   (`POST /api/transcript/distill`, the existing endpoint — LLM Haiku proposes
   DNA changes). **No digest call** (there is no live conversation to summarise).
3. The shared proposed-DNA-changes panel renders: editable CRM note + accept/
   reject deltas (showing `current → proposed` affinity weights) + quote
   receipts + Approve.
4. **Approve** commits the note + accepted deltas to the client via the existing
   conversation store. The committed note's `medium` is labelled **"Manual
   note"** so it is distinguishable from a recorded conversation in the CRM log.

## Components & boundaries

- **`ConversationCapture`** gains a `tab` state (`"voice" | "manual"`, default
  `"voice"`) and renders the tab bar.
- **`DnaProposal`** *(new sub-component, extracted for DRY)* — renders the
  editable note, the accept/reject delta checkboxes, the quote receipts, and the
  Approve button. Props: the `DistillResult`, the client (for current affinity
  weights), the `noteText` + setter, the `accepted` map + setter, and an
  `onApprove` callback. Used by **both** the voice combined panel and the manual
  tab.
- **Voice path** keeps `finalize()` (digest + distill in parallel → sets `digest`
  + `result`).
- **Manual path** adds `finalizeManual()` (distill only → sets `result`, leaves
  `digest` null).
- Approve logic is shared; the manual path commits with `medium: "Manual note"`.

No backend changes — manual notes reuse `POST /api/transcript/distill`.

## Testing

- Existing backend (`node:test`) and frontend (`vitest`) suites stay green;
  `tsc -b`, `lint`, `build` clean.
- The tab toggle and the manual distill path are verified by the build plus the
  human browser smoke test. The distill engine itself is already unit-tested.
- Consent remains required for the voice/recording path only; the manual tab is
  reachable without consent.

## Out of scope

- Backend changes (manual reuses the distill endpoint).
- A digest for manual notes.
- Persisting drafts across reloads.
