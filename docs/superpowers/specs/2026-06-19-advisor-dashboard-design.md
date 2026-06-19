# Design — Next-Generation Wealth Advisory Dashboard

**Date:** 2026-06-19 · **Event:** SwissHacks 2026 (48h) · **Team:** Dukes
**Challenge:** `context/challenge.md` · **Brainstorm:** `docs/brainstorm-dashboard-ideas.md`

## Summary

An RM (relationship manager) advisor dashboard that turns three years of CRM
notes + a portfolio + incoming news into **explainable, human-in-the-loop**
advisory actions. The investment *strategy* never changes; personalisation
happens at the **asset level** — flag holdings that conflict with a client's
"DNA" and propose a same-sector replacement constrained to the CIO recommendation
list. The AI equips the RM; it never advises the client directly.

**Scope decision (locked): phased.**
- **Phase A — core (guaranteed demo):** one persona (Schneider) polished
  end-to-end, with the deterministic **Glass Thread** provenance view and the
  **"cut the thread"** hero moment. The other three personas are selectable but
  lightly wired.
- **Phase B — stretch:** RM **priority inbox** over the book of clients + the
  **24/7 client-listener** (client messages flag + append to context; the agent
  never replies).
- **Phase C — reach:** **what-if simulator + RM copilot** chat.

Why phased: judging is 50% Creativity + Trust/Explainability, 20% Feasibility,
15% Visual, 15% Presentation. Phase A maximises the 50% with the least stage
risk; B/C add product breadth only after the winning demo is locked.

## Core principle

Every recommendation is computed by **deterministic code** and emitted as a
**trace object** `{ claim, type, confidence, evidence[], severity }`. The UI is
a *renderer of traces* — so explainability is structural, not cosmetic. The LLM
is used in exactly **two narrow places**, both with cached fallback:
1. **Client DNA extraction** — run **once, offline, frozen to JSON**, committed.
2. **Two-voice message draft** — the one **live** call, with a per-persona cache.

Everything else (drift, alert match, swap selection) is deterministic. This is
what makes the demo bulletproof on stage *and* fully traceable.

## Architecture

Build on the imported `demo/` starter (TS + Express + ts-node, static SPA, zod,
axios) — reuse its `PhoeniqsService` (OpenAI-compatible chat, tolerant JSON
parsing), `SixService` (MCP JSON-RPC by Valor / `{valor}_{mic}`),
`NewsAIService`, and the integration health-probe pattern. In-memory store loaded
from CSV/JSON at boot. No database.

```
data/ CSVs ──► build step ──► frozen JSON
  crm/*.csv         → DNA profiles  (LLM, run once offline, committed)
  portfolio/*.csv   → holdings + drift + CIO swap candidates (deterministic)
                                  │
                                  ▼
   Express backend (extends demo/ starter)
     GET  /api/clients              inbox list + priority
     GET  /api/clients/:id          DNA + portfolio + drift
     GET  /api/clients/:id/alerts   Trace[] (alerts)
     GET  /api/clients/:id/swap     CIO-constrained swap + rejected candidates
     POST /api/message              LLM draft (LIVE, cached fallback)
     GET  /api/integrations         health probes (from starter)
                                  │
                                  ▼
   SPA: Inbox ▸ Client view ▸ Glass Thread ▸ Message composer
```

### Live vs. frozen

| Piece | Mode | Why |
|---|---|---|
| Client DNA extraction | LLM once, offline, frozen JSON | Real LLM use, zero stage risk |
| Alert match / drift / swap | Deterministic code | Fast, correct, trustworthy |
| Two-voice message draft | LIVE LLM + per-persona cache | The one "watch it generate" moment |
| SIX prices / live news | Cached snapshot; live behind a flag | Realism without stage dependency |

## Components

### Backend modules (`demo/src/backend/`)
- **`store`** — loads CSV + frozen JSON at boot; `getClient`, `listClients`,
  `getPortfolio`, `getCioList`. Pure reads.
- **`agents/crmAgent`** — returns the frozen **DNA profile**: traits, each with
  `evidence[]` (CRM quote + date) and `confidence`.
- **`agents/portfolioAgent`** — deterministic holdings, sub-asset-class weights,
  **±2.0pp drift breaches**. Emits traces.
- **`agents/newsAgent`** — maps a (scripted or live) news event to affected
  holdings for a client.
- **`alertEngine`** — `DNA × portfolio × news → Trace[]`, typed
  (`dna-conflict | cio-sell | drift-breach | news-hit`), with severity,
  value-at-stake, evidence chain.
- **`swapEngine`** — for a flagged holding, find same-Industry-Group **CIO BUY**
  candidates, check mandate compliance, return ranked swap + **rejected**
  candidates with reasons (free counterfactual).
- **`agents/messageAgent`** — the **one live LLM call**; drafts the note in two
  voices (data-driven / values-led); per-persona cached fallback.
- **`traces`** — shared `Trace` type + builder so every module emits one shape.

"Agents" are plain modules run by a simple sequential pipeline — named per the
brief (CRM / Portfolio / News / Message), **not** a live multi-agent framework.

### Frontend (single SPA)
- **Inbox view** — Phase B real ranking; Phase A stub = 4 client cards.
- **Client view** — DNA card (traits + confidence + evidence chips), portfolio +
  drift monitor, alert feed.
- **Glass Thread (hero)** — fixed-layout provenance graph (CRM note → DNA trait →
  holding → news → swap); click a node to highlight evidence; **cut the
  neuroscience node → snaps to a precomputed "weaker case" state**.
- **Message composer** — two-voice toggle, RM edit, Accept/Edit/Reject → writes
  the **Override Ledger**.
- **Evidence chip** — one reusable component wherever a claim appears.

### Phase B / C add-ons
- **B:** priority ranking across the book + the **24/7 client-listener** panel
  (client message → flag high-priority + append to context; agent never replies).
- **C:** **what-if simulator + RM copilot** (chat with client+news context, runs
  the idea through the deterministic engines).

## Data & trace flow

```ts
interface Trace {
  claim: string;
  type: "dna-conflict" | "cio-sell" | "drift-breach" | "news-hit";
  confidence: number;          // 0..1
  evidence: Evidence[];
  severity: "act" | "watch" | "info";
  valueAtStakeCHF?: number;
}
interface Evidence {
  kind: "crm" | "cio" | "news" | "market";
  sourceId: string;            // e.g. "crm_schneider.csv:2024-05-14"
  quote: string;
  date: string;
  ref?: string;                // ISIN / article url
}
```

Request flow (deterministic; one live call):
```
GET /api/clients/:id/alerts
  store → crmAgent (frozen DNA) ┐
          portfolioAgent (drift) ┼─► alertEngine ─► Trace[] (sorted by severity)
          newsAgent (event→holding)┘
GET /api/clients/:id/swap?holding=ISIN
  swapEngine → { chosen, rejected: {candidate, reason}[] }
POST /api/message { clientId, alertId, voice }
  messageAgent → LIVE Phoeniqs draft  ||  cached fallback
```

### "Cut the thread" state machine (hero — fully precomputed)
Schneider has two frozen states authored from real CSV data:
- **`full_case`** — neuroscience trait confidence 0.9 (3 CRM sources),
  alert = ACT, strong swap rationale.
- **`cut_neuroscience`** — trait confidence 0.4 (1 source), 2 evidence chips
  greyed, alert = WATCH, hedged rationale.

Cutting the 2024-05-14 evidence node navigates `full_case → cut_neuroscience`.
Every transition logs to the Override Ledger
`{ action, node, before→after, timestamp }`. Manipulation = navigation between
frozen states, never a recompute.

## Reliability

- **One network call in the critical path** — the live message draft; everything
  else is frozen JSON / deterministic from memory.
- **Cached fallback** on that call — per-persona, per-voice, committed. If
  Phoeniqs exceeds ~5s or errors, silently serve the cache.
- **`?live=false` master switch** — forces everything (incl. message) to cached
  mode for an offline dry run and the pitch.
- **SIX MCP optional-not-blocking** — cached price snapshot; live MCP behind a
  flag, never gates a render (starter's `configured` flags degrade gracefully).
- **Frozen DNA** — committed, so a flaky LLM can't change the hero.

## Testing

- **Unit tests on deterministic engines** (pure functions over fixed CSVs):
  - `portfolioAgent`: flags exactly the known ±2.0pp breaches (Balanced, Growth).
  - `swapEngine`: chosen swap is same-Industry-Group + CIO-BUY + compliant;
    rejected candidates carry correct reasons.
  - `alertEngine`: Schneider's event yields the expected `dna-conflict` ACT alert
    with the right evidence chain.
- **Trace shape validated by zod** — UI never receives a malformed claim.
- **Cut-the-thread = fixtures** — snapshot-assert the two frozen states.
- **Manual smoke** — the `?live=false` walkthrough is the integration test; run
  the full Schneider story end to end ≥3× before the pitch.
- **Skip** — frontend unit tests, E2E frameworks, live-integration CI.

## Build plan (48h, 4 people)

Lanes: **BE** (engine+data), **LLM** (Phoeniqs/SIX wiring + prompts),
**FE** (graph+UI), **PM/Design** (data prep, styling, pitch).

- **Phase 0 (h0–6):** stand up `demo/` starter, `.env` keys, green health check
  (SIX optional). Pin Schneider's hero thread (which CRM note → trait → holding →
  news → swap). FE scaffold + Swiss/calm design tokens. *Gate: keys work or go
  fully cached.*
- **Phase 1 (h6–18):** deterministic spine — store, drift, alertEngine,
  swapEngine, trace objects; freeze DNA JSON; render linear flow. *Gate:
  end-to-end JSON renders for Schneider (ugly ok).*
- **Phase 2 (h18–32):** Glass Thread (static layout + cut-node branch), Override
  Ledger, live two-voice message + cache. *Gate: Schneider demo-able front to
  back. Feature-freeze candidate.*
- **Phase 3 (h32–42):** load other 3 personas in data; one Phase-B/C stretch if
  green (inbox OR client-listener OR simulator — pick one); design polish.
- **Phase 4 (h42–48):** `.pptx`; pitch coaching (Sat); cached-everything dry run
  ≥3×; freeze.

Rules: feature-freeze h32, hard stop on new features h44, every live call has a
committed cached fallback, SIX MCP optional-not-blocking.

## Out of scope (do not build)

Manipulable/recomputing force-directed graph; confidence-gated autonomy lanes;
time-scrub timeline; a live multi-agent orchestrator; auth / multi-RM / database;
news sentiment ranking. (Rationale in `docs/brainstorm-dashboard-ideas.md`.)

## Open questions

- Glass Thread layout: hand-placed vs. pre-solved D3 force frozen to JSON?
- Which single Phase-3 stretch (inbox / client-listener / simulator) if time allows?
- Any live SIX price enrichment in the demo, or fully cached?
- Lane ownership across the four team members.
