# AGENTS.md — read this first

Orientation for AI agents working in `swisshacks-dukes`. Dense by design: read
this once, then open only the files your task names. Deeper detail lives in the
sibling `context/*.md` (linked inline).

## TL;DR

**RM Copilot** — a relationship-manager cockpit for the SwissHacks 2026 SIX ·
Noumena · NTT DATA "Next Generation of Wealth Advisory" challenge. It turns each
client's CRM history into a **Client DNA**, watches their portfolio against live
news + the CIO list, and surfaces ranked, fully-traceable alerts so the RM can
act. **The AI never advises the client directly** — RM reviews/approves → client
decides. Full pitch: `project.md`. Challenge brief: `challenge.md`.

## Repo map

```
frontend/            React 19 + Vite + TS dashboard (the RM cockpit). Mock-data driven.
  src/App.tsx        4 tabs: Priority queue · Clients · News feed · Rehearse (+ full client page)
  src/types.ts       ★ all shared domain types — read before touching any feature
  src/data/          AUTHORED deterministic mock data (clients, news, themes, portfolio)
  src/lib/           pure logic + React context stores (engines, learning, stores)
  src/components/    UI (PriorityQueue, ClientDetail/Page, ValueRadar, Rehearse, ComplianceDesk, …)
  src/index.css      the whole design system (dark theme, CSS vars). Add styles here.
  AGENTS.md          frontend-prototype pickup guide (NOTE: partly stale — trust types.ts/App.tsx)
news-test/           zero-dep node:http backend — live-news pipeline + LLM seams
  server.mjs         HTTP server + 3-stage news relevance pipeline (offline fixture by default)
  classify.mjs       Stage 1 deterministic relevance + noise filter
  assessor.mjs       Stage 2 pluggable theme tagger (claude | phoeniqs | heuristic)
  holdings.mjs       Stage 3 deterministic news→holding (ISIN) match
  distill.mjs        transcript→Client-DNA seam; POST /api/transcript/distill (+ distill.test.mjs)
  env.mjs            loads demo/.env into the environment
data/                challenge data — CRM + portfolio CSVs (from .xlsx via extract.py)
  crm/*.csv          one file per persona: Date, Medium, RM Name, Client Contact, Note
  portfolio/*.csv    holdings, CIO recommendation list, strategies, transactions, cash flows
context/             these orientation docs (project, architecture, challenge, decisions, team)
docs/superpowers/    specs + implementation plans (e.g. voice-conversation-capture)
demo/                challenge reference starter + .env (keys; NOT committed)
```

Full component/module inventory + data flow: `architecture.md`.

## Domain glossary

- **Client DNA** — a client's investment identity: `values`, `dislikes`, value
  `affinities` (weighted themes), `commStyle`. Lives on `Client` in `types.ts`.
- **ThemeId universe** (fixed, 6) — `environmental`, `us_tech_bullish`,
  `defensive`, `income`, `reputation`, `healthcare`. The Value Radar axes; the
  distiller must only emit these.
- **Glass Thread** — the explainable reasoning chain behind a priority score:
  `dna → holding → news → conflict → relationship → score`, each step carrying
  verbatim **Evidence** receipts (`kind`/`sourceId`/`quote`). See `lib/explain.ts`.
- **Mandate** — `Defensive | Balanced | Growth`; CHF 10M each. Strategy is fixed;
  personalisation happens at the **asset level**, constrained by the CIO list.
- **Mandate drift** — sub-asset-class allocation breaching the **±2.0pp** rule.
- **CIO recommendation list** — BUY/HOLD/SELL + swap candidates; **constrains the
  swap universe**. `data/portfolio/cio_recommendation_list.csv`.
- **Engine seam** — LLM-backed agents pick `claude | phoeniqs | heuristic` and
  **always degrade to the deterministic heuristic** on missing key/network/error.
- **Rehearse** — the client-twin simulator: predicted reaction, objections, best
  framing, trust/alignment trajectory — run *before* sending advice.
- **Voice Conversation Capture** *(active: `feat/voice-conversation-capture`)* —
  consent gate → live STT → distill → RM review → merge DNA deltas.

## The 4 personas

| id | Persona | Mandate | DNA hook | Trigger |
|---|---|---|---|---|
| `raeber` | Räber | Defensive | conservative; averse to US tech | CIO suggests blue chips → US AI stocks |
| `schneider` | Schneider | Balanced | family foundation, chronic-illness research | pharma shuts that research down |
| `huber` | Huber | Defensive | environmentalist, reforestation | consumer co. ends palm-oil deforestation |
| `ammann` | Ammann | Growth | reputation = financial risk | labour-exploitation scandal at a holding |

Persona↔portfolio file mapping: `data/README.md`.

## Hard invariants (do not violate)

- **Human-in-the-loop:** the AI equips the RM; it never messages/advises the
  client. Drafts are RM-reviewed; nothing merges or sends without approval.
- **Explainability:** every number/claim a user sees traces to a source receipt
  or a stated assumption. Reuse the receipt pattern (`EVIDENCE_META` + `.receipt`).
- **Never hard-fail the demo:** keep the heuristic fallback path working; flaky
  wifi during the live pitch must degrade gracefully, not crash.
- **TypeScript:** no `any`; keep `tsc -b` clean. Pure logic → `lib/` (testable);
  UI → `components/`; shared styles → `index.css` (no CSS framework).
- **Dashboard data is mock** (`frontend/src/data/`) for a reliable demo; live
  SIX/Event-Registry + LLM wiring lives in `news-test/`.

## Build / test / run

```bash
cd frontend && npm install && npm run dev    # dashboard → http://localhost:5173
cd frontend && npm run lint && npx tsc -b    # must stay clean
cd frontend && npm run test                  # vitest (pure-logic; being added)

node news-test/server.mjs                     # backend → http://localhost:4000 (offline)
NEWS_LIVE=1 node news-test/server.mjs         # live Event Registry (spends API)
ASSESSOR_ENGINE=heuristic node news-test/server.mjs   # no LLM spend
node --test news-test/*.test.mjs              # backend tests

python3 data/extract.py                       # regenerate CSVs from the .xlsx
```

Keys: copy `demo/.env.example` → `demo/.env` (not committed). Vite proxies
`/api` → `:4000`.

## Conventions

- Branch off `main`; PR non-trivial changes. Don't push to others' feature
  branches. Keep `context/` current when scope/architecture/decisions change.
- One feature/fix per change; if a task balloons, stop and report.
- Read the files your task names + skim neighbours for the existing pattern
  before writing. Verify (`tsc`/lint/tests + exercise the feature) before done.
