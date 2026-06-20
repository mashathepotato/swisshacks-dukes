# Voice Conversation Capture — Design

**Date:** 2026-06-20
**Branch:** `feat/voice-conversation-capture`
**Status:** Approved design — ready for implementation planning

## One-liner

Let an RM record a *consented* client call or lunch, transcribe it live in the
browser, and turn it into a reviewed CRM note plus proposed Client-DNA updates
that feed the existing advisor dashboard.

## Why this fits the challenge

The challenge loop is: parse CRM *conversation logs* → build **Client DNA** →
match against portfolio + news → surface alerts → draft a tailored message. The
existing app starts from *static* CRM logs (`data/crm/*.csv`). This feature adds
the **upstream source** of those logs: instead of the RM hand-typing a note
after a conversation, the consented conversation is transcribed and distilled
into DNA signals automatically.

It scores directly on the two heaviest judging axes:

- **Creativity (25%):** voice → live transcript → structured DNA is a novel
  human–AI interaction beyond a chatbot.
- **Trust & Explainability (25%):** explicit consent gate + verbatim quote
  receipts mean every DNA update traces back to *"the client said this, out
  loud, on this date."* Human-in-the-loop is preserved — the RM reviews and
  approves every change; nothing is committed automatically.

## Scope

### In scope (target for the demo)

- In-browser live speech-to-text (real STT via the Web Speech API).
- A consent gate that blocks recording and records a consent artifact.
- Backend distillation endpoint that extracts a draft CRM note + DNA deltas +
  quote receipts, reusing the existing pluggable assessor engine.
- A review surface where the RM edits/accepts/rejects and approves.
- On approval: append the CRM note and merge DNA deltas into the client (client
  side store), visible in the client's DNA/affinities.

### Out of scope

- Storing real audio files; speaker diarization; multi-language.
- Re-running alerts / recomputing priority score from the new DNA (the scope
  stops at merging the DNA deltas — see Data flow).
- Persisting to the source `*.csv` / `.xlsx` data files.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Transcription fidelity | **Live mic, real STT** (Web Speech API in-browser) |
| Output scope | **DNA signals + draft CRM note** (stop before re-triggering alerts) |
| Extraction architecture | **Reuse Express + pluggable `assessor` seam** (`claude \| phoeniqs \| heuristic`) |
| Consent | **Gate + recorded consent** (recording blocked until confirmed; consent artifact stored & shown) |
| UI placement | **"Conversation Capture" panel on the client detail page** |

## Architecture

The frontend is React 19 + Vite + TypeScript, currently 100% deterministic
client-side mock data (`frontend/src/data/`, `frontend/src/lib/`). The backend
seam already exists in `news-test/` (Express + `assessor.mjs`, which talks to
Phoeniqs / Claude / a deterministic heuristic, loading keys from `demo/.env`).
This feature reuses both patterns rather than introducing new ones.

### Components & boundaries

- **`ConsentGate`** *(frontend component)*
  - **Does:** blocks recording until the RM confirms client consent. On confirm,
    produces a `ConsentRecord` and unlocks the recorder. Renders the consent
    summary on the resulting transcript and note.
  - **Depends on:** nothing external; pure UI + local state.

- **`Recorder`** *(frontend component / hook)*
  - **Does:** wraps the Web Speech API (`SpeechRecognition`). Streams interim and
    final transcript segments into the UI live; "Stop" yields the full transcript
    string. Shows a clear message if the browser lacks support.
  - **Depends on:** browser `SpeechRecognition` (Chrome + network). STT is
    injectable so tests and the "paste transcript" escape hatch can supply text.

- **`POST /api/transcript/distill`** *(backend endpoint, added to the existing Express server)*
  - **Input:** `{ clientId: string, transcript: string, consent: ConsentRecord }`
  - **Does:** reuses the `assessor` engine seam with a DNA-extraction prompt to
    return a `DistillResult`. Falls back to the deterministic heuristic when no
    LLM key/network is available.
  - **Output:** `DistillResult` (see Data shapes).
  - **Depends on:** the existing `assessor` module + `demo/.env` keys.

- **`DistillReview`** *(frontend component)*
  - **Does:** shows the draft CRM note, the proposed DNA deltas, and the quote
    receipts. The RM edits the note, accepts/rejects each delta, then approves.
    "Approve" commits the note + accepted deltas.
  - **Depends on:** a client-side store (below).

- **Conversation store** *(frontend, mirrors existing `*Store.tsx` like `learningStore`)*
  - **Does:** holds approved CRM notes and merged DNA deltas per client, exposed
    via context so the client's DNA/affinities reflect the new conversation.

### Data shapes

```ts
interface ConsentRecord {
  clientId: string;
  rmName: string;
  method: "verbal" | "written";  // how consent was given
  timestamp: string;             // ISO datetime
}

interface AffinityDelta {
  theme: ThemeId;
  fromWeight: number;  // existing affinity weight (0..1), 0 if new
  toWeight: number;    // proposed weight (0..1)
}

interface DnaDeltas {
  values: string[];          // proposed new values to add
  dislikes: string[];        // proposed new dislikes to add
  affinities: AffinityDelta[];
}

interface DistillResult {
  note: {
    date: string;            // ISO date
    medium: string;          // e.g. "In-person (lunch)", "Call"
    rmName: string;
    clientContact: string;
    text: string;            // the summarized CRM note
  };
  dnaDeltas: DnaDeltas;
  receipts: Evidence[];       // existing Evidence type; kind:"crm",
                              // sourceId:"transcript:<clientId>:<date>",
                              // quote = verbatim passage from the transcript
}
```

`Evidence`, `ThemeId`, and the `Client` DNA fields (`values`, `dislikes`,
`affinities`, `commStyle`) already exist in `frontend/src/types.ts` — the
distill output is shaped to merge into them directly.

### Data flow

```
Consent confirmed
  → record (live STT streams transcript into UI)
  → Stop (full transcript)
  → POST /api/transcript/distill { clientId, transcript, consent }
  → assessor distills → DistillResult { note, dnaDeltas, receipts }
  → DistillReview: RM edits note, accepts/rejects deltas
  → Approve
  → conversation store: append CRM note + merge accepted DNA deltas into client
  → client's DNA / affinities now reflect the conversation;
    receipts available to the Glass Thread as transcript-sourced evidence
```

Per the locked scope, the flow **stops at the merge** — alerts and priority
score are not recomputed in this feature.

### Reliability & fallback

- LLM extraction runs via Phoeniqs/Claude when keys are present; the
  **deterministic heuristic** (keyword / affinity matching against the persona's
  known DNA themes) produces a plausible `DistillResult` offline, so the live
  demo never hard-fails on flaky room wifi.
- The Web Speech API needs Chrome + network. The UI states this clearly, and the
  review step keeps a **"paste transcript" escape hatch** (dev/testing and
  demo-safety) so distillation can be exercised without the mic.

## Testing

- **Backend:** unit-test the distill prompt construction + response parsing, and
  the heuristic fallback, against a canned transcript per persona with
  deterministic assertions (expected themes/values surface; receipts quote the
  transcript verbatim).
- **Frontend:**
  - `ConsentGate` blocks recording until consent is confirmed; the consent
    artifact is rendered on the result.
  - `DistillReview` edit/accept/reject then approve merges only the accepted
    deltas into the store correctly.
  - STT is mocked (inject a transcript) — the Web Speech API itself is not
    exercised in tests.

## Open implementation notes (resolve during planning)

- Confirm the exact integration point on the client detail page (the page
  renders stacked sections rather than a hard tab bar — match that layout).
- Confirm which Express server hosts the new endpoint (extend the `news-test`
  server vs. the challenge `demo/` server) and how the frontend dev server
  proxies `/api` to it.
- Decide the DNA-extraction prompt + heuristic keyword maps per persona theme.
