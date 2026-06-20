# RM↔Client Dialogue Attribution + Theme-Aligned Buttons — Design

**Date:** 2026-06-20
**Branch:** `feat/voice-conversation-capture`
**Status:** Approved design — ready for implementation planning

## One-liners

1. Split the single mic transcript into an **RM-vs-Client dialogue** using the LLM
   (the Web Speech API can't separate voices), and feed the speaker-labeled text
   to the digest/distill so DNA is driven by what the *client* said.
2. Restyle the Conversation Capture panel's buttons and tabs to the **Swiss house
   theme** (white + `--accent #de3919`), replacing default browser buttons and a
   few leftover dark-theme inline colors.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Speaker split | **LLM attributes speakers** (Haiku), best-effort from one mic |
| Scope | Voice tab only (manual tab = RM's own notes, unaffected) |

## Part 1 — Dialogue attribution

### Backend
- **`news-test/dialogue.mjs`** *(new, mirrors the digest/distill seam)*:
  - `attributeDialogue(transcript)` → calls Anthropic Haiku
    (`DIGEST_MODEL_SMALL`/`DISTILL_MODEL` default `claude-haiku-4-5-20251001`) with a
    system prompt to return `{"turns":[{"speaker":"RM"|"Client","text":"..."}]}`.
  - `heuristicDialogue(transcript)` → returns a single
    `[{ speaker: "Conversation", text: transcript }]` (no attribution possible
    without a model).
  - `toLabeledTranscript(turns)` *(pure)* → `"RM: ...\nClient: ..."` string for
    feeding downstream.
  - `dialogue({ transcript })` resolves engine: heuristic when no
    `ANTHROPIC_API_KEY`; else Haiku; any API error → heuristic.
- **`POST /api/transcript/dialogue`** *(new route)* — body `{ transcript }` →
  `{ model, turns }`. Reuses `readJson`. 400 if no transcript.

### Frontend (voice tab only)
- On **Stop**: call `/api/transcript/dialogue` first → set `turns`. Build the
  labeled transcript via `toLabeledTranscript` and run the **final digest** and
  **distill** on that labeled text (so DNA attribution favours the client's
  words). Live digest during recording stays on the raw stream.
- Render the attributed dialogue as alternating **RM / Client** bubbles in the
  combined panel, labeled **"AI-inferred speakers"** for transparency.
- On heuristic fallback (one `"Conversation"` turn) the panel shows the single
  block; downstream still uses the raw transcript.

### Data shape
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

## Part 2 — Theme-aligned buttons & panel

The panel currently uses default browser buttons and a few dark-theme inline
fallbacks (notably the digest badge `background: var(--accent, #2e1630); color:
#d9b6df` renders as red-on-purple on the white theme). Fix in `index.css` with a
small set of `conv-*` classes using existing tokens:

- **`.conv-tabs` / `.conv-tab` / `.conv-tab.on`** — segmented control; active uses
  `--accent-soft` bg + `--accent` text + `--accent-line` border (matches
  `.who-sel .pick`).
- **`.conv-btn`** — secondary/ghost: `1px solid var(--border)`, `--text`,
  `2px` radius; hover → `--accent` border/text. Used for Stop, consent choices.
- **`.conv-btn.primary`** — accent-filled: `var(--accent)` bg, `#fff` text,
  hover `#c4310f` (matches `.composer button`). Used for Record, Generate
  insights, Approve.
- **`.conv-badge`** — model badge: `--accent-soft` bg + `--accent` text (replaces
  the purple inline style).
- **`.conv-dialogue` / `.conv-turn.rm` / `.conv-turn.client`** — dialogue bubbles;
  RM uses `--accent-soft`, client uses `--panel-2`, with a small speaker label.

Replace the inline-styled/default buttons in `ConversationCapture.tsx` (and
`DigestView`/`DnaProposal`) with these classes; keep structural inline styles
(spacing) where trivial but remove the clashing dark colors.

## Testing
- Backend `node:test`: `heuristicDialogue` returns one `"Conversation"` turn;
  `toLabeledTranscript` formats `RM:`/`Client:` lines correctly. Anthropic call
  not exercised.
- Frontend `vitest` stays green; build/lint/tsc clean.
- Dialogue rendering + new button styling verified in the browser smoke test.

## Out of scope
- Real audio diarization (paid STT service).
- Attributing the manual-tab notes.
- Persisting the dialogue across reloads.
