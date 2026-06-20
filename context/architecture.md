# Architecture

A multi-agent **conceptual** design (see `agents.dot` / `agents.png`) realised as
two concrete pieces: a React dashboard (the RM cockpit) and a zero-dependency
Node backend that proves the live-data + LLM seams.

## Stack

- **Frontend:** React 19 + TypeScript + Vite (`frontend/`). State via React
  context stores; no router (tab + full-page state in `App.tsx`). Lint: ESLint.
  Tests: Vitest for pure logic (being added on the voice-capture branch).
- **Backend:** zero-dependency `node:http` server (`news-test/server.mjs`).
  Tests: `node:test`. No framework — kept minimal for hackathon speed.
- **Data / storage:** static challenge data in `data/` (CRM + portfolio CSVs
  exported from the source `.xlsx`). The dashboard currently runs on
  deterministic **mock data** authored in `frontend/src/data/`. No database.
- **LLM:** Phoeniqs (OpenAI-compatible) or local Claude CLI, behind a pluggable
  engine seam; always degrades to a deterministic heuristic so the demo never
  hard-fails. Keys loaded from `demo/.env` (not committed).
- **Key APIs / services:** SIX Financial MCP (prices/fundamentals), Event
  Registry / Tenity News MCP (headlines + sentiment), Phoeniqs LLM. See
  `challenge.md` for credentials/contacts.

## Components

### Frontend — RM dashboard (`frontend/src/`)

Four tabs (`App.tsx`): **Priority queue**, **Clients**, **News feed**,
**Rehearse**, plus a full-screen client page and an RM-profile panel.

- `components/PriorityQueue.tsx` — clients ranked by `priorityScore`; done/reopen.
- `components/ClientDetail.tsx` / `ClientPage.tsx` — client cockpit.
- `components/ValueRadar.tsx` — Client DNA as a 6-axis value hexagon (`ThemeId`s:
  environmental, us_tech_bullish, defensive, income, reputation, healthcare).
- `lib/explain.ts` — the **Glass Thread**: DNA → holding → news → conflict →
  relationship → score reasoning steps, each with verbatim `Evidence` receipts.
- `components/NewsFeed.tsx` / `NewsDetail.tsx` / `NewsImpactMap.tsx` — news and
  which clients each story reaches (same value-hexagon geometry as the radar).
- `components/Rehearse.tsx` (+ `data/simulate.ts`, `data/bookSim.ts`) — the
  **client-twin simulator**: predicted reaction, objections, best framing, and a
  trust/alignment trajectory.
- `components/ComplianceDesk.tsx` (+ `lib/portfolio.ts`) — live mandate-drift
  (±2.0pp) + CIO-constrained, explainable swap proposals + what-if checker.
- `lib/learning.ts` / `learningStore.tsx` — feedback (accept/tweak/decline) →
  per-client preference model (value affinities + preferred voice).
- `lib/rmProfile*.ts(x)` / `RmProfilePanel.tsx` — RM "house style" (greeting,
  default tone, per-channel sign-offs).
- `lib/commPref*.ts(x)` — per-client preferred channel + message length.
- `components/ConversationCapture.tsx` + `lib/useRecorder.ts` /
  `conversationStore.tsx` / `conversation.ts` — **Voice Conversation Capture**
  (active branch): consent gate → live STT → distill → review → merge DNA deltas.
- `types.ts` — shared domain types (Client, ThemeId, Evidence, ReasonStep,
  NewsItem, PreferenceModel, SimulationResult, Distill\* …).

### Backend — `news-test/` (Node `node:http`)

- `server.mjs` — HTTP server + 3-stage news relevance pipeline; serves an
  offline fixture by default (`NEWS_LIVE=1` to call Event Registry).
- `classify.mjs` — Stage 1 deterministic investment-relevance + noise pre-filter.
- `assessor.mjs` — Stage 2 pluggable "agent" tagging themes (claude / phoeniqs /
  heuristic via `ASSESSOR_ENGINE`).
- `holdings.mjs` — Stage 3 deterministic news → portfolio-holding (ISIN) match.
- `distill.mjs` (+ `distill.test.mjs`) — transcript → Client-DNA seam, same
  engine pattern; `POST /api/transcript/distill`. Backs Voice Conversation
  Capture; always degrades to a keyword heuristic.
- `env.mjs` — loads `demo/.env` into the environment.

## Data flow

```
CRM logs (data/crm/*.csv)          ─┐
SIX MCP (prices/fundamentals)       ├─► [agent layer] ─► Client DNA × portfolio × news
Event Registry news (live/fixture) ─┘        │            ─► ranked signals + Glass Thread
CIO recommendation list ───────────── constrains swaps ───┘
Phoeniqs/Claude LLM ── powers the reasoning agents (else heuristic fallback)
                                             │
                                             ▼
                              RM dashboard (priority queue · client detail ·
                              value radar · news impact · Rehearse simulator)
                                             │
                          RM reviews/edits/approves ──► recommends ──► CLIENT decides

Voice capture loop:  consent ─► live STT ─► /api/transcript/distill
                     ─► review (edit/accept/reject) ─► merge DNA deltas back into the client
```

The dashboard today is wired to deterministic mock data (`frontend/src/data/`)
for a reliable demo; `news-test/` and `distill.mjs` are the live-data + LLM
seams that the dashboard's mock layer mirrors and can be swapped onto.

## Setup

```bash
# Frontend (dashboard)
cd frontend && npm install && npm run dev          # http://localhost:5173

# Backend (news pipeline + distill API) — offline by default, no API spend
node news-test/server.mjs                          # http://localhost:4000
NEWS_LIVE=1 node news-test/server.mjs              # live Event Registry calls

# Vite proxies /api → http://localhost:4000 (added on the voice-capture branch).
# LLM/API keys: copy demo/.env.example → demo/.env and fill in.

# Regenerate CRM/portfolio CSVs from the source workbooks
python3 data/extract.py
```
