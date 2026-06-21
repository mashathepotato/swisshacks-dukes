# AGENTS.md — Priori frontend

Pickup guide for sub-agents taking on **small, scoped tasks** in the dashboard.
Read this once, then open only the files your task names.

> Repo-wide orientation (backend, data, personas, glossary) lives in
> [`../context/AGENTS.md`](../context/AGENTS.md). This file is frontend-specific.

## What this is

**Priori** — a relationship-manager dashboard for the SwissHacks "Next
Generation of Wealth Advisory" challenge. It surfaces which clients need
attention, explains *why* (with source receipts), lets the RM rehearse the
outcome of advice, and drafts client messages. **The AI never advises the client
directly** — it equips the RM, who decides.

- **Stack:** React 19 + Vite + TypeScript. No router (tab + full-page state in
  `App.tsx`); shared state via React context providers.
- **Data:** authored deterministic mock data in `src/data/` (clients, news,
  themes) **plus** real CSV-derived portfolio/CIO/strategy data
  (`src/data/portfolio.ts`) that grounds the deterministic engines.
- **Backend:** mostly mock-driven, but the Voice Capture feature calls a Node
  backend (`../news-test/`) via `POST /api/transcript/distill`; Vite proxies
  `/api` → `http://localhost:4000`. Everything else is local.
- **Branch:** off `main`; PR non-trivial changes.

## Run & verify

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
npx tsc -b             # typecheck — must stay clean
npm run lint           # eslint — must stay clean
npm run test           # vitest (pure-logic tests; e.g. src/lib/conversation.test.ts)
```

Verify a change by: (1) `tsc -b` clean, (2) `npm run lint` clean, (3) `npm run
test` green, (4) load the app and exercise the feature you touched.

## Map of the codebase

```
src/
  App.tsx                 4 tabs: Priority queue · Clients · News feed · Rehearse
                          (+ full-screen ClientPage, RM-profile panel)
  main.tsx                wraps App in Conversation/RmProfile/Learning/Done/CommPref providers
  types.ts                ★ all domain types: Client, NewsItem, Evidence, ReasonStep,
                          ThemeId, PreferenceModel, SimulationResult, Distill* …
  index.css               the whole design system (dark theme, CSS vars). Add styles here.
  data/                   AUTHORED mock datasets + GENERATED real portfolio data
    clients.ts            4 personas (rich) + synthetic twins
    news.ts, themes.ts, feedback.ts, bookSim.ts, simulate.ts   authored datasets/sims
    portfolio.ts          GENERATED real holdings/CIO/strategies (see "Data + engines")
  lib/                    pure logic + context stores
    portfolio.ts          ★ deterministic engines: drift, swap, what-if, impact + PERSONA_PLAY
    explain.ts            Glass-Thread reasoning chain + REASON_META / EVIDENCE_META
    format.ts             money/date/score formatters, SIGNAL_META
    learning.ts / learningStore.tsx     feedback → per-client preference model
    doneStore.tsx         priority-queue "mark complete" state (context)
    commPrefs.ts / commPrefStore.tsx    per-client channel + message-length prefs
    rmProfile.ts / rmProfileStore.tsx   RM "house style" (greeting, tone, sign-offs)
    conversation.ts / conversationStore.tsx   Voice Capture: mergeDeltas + approved-notes store
    useRecorder.ts        Web Speech API hook (+ paste-transcript fallback)
  components/
    PriorityQueue.tsx     ranked book + active/Completed split
    ClientGrid.tsx        all-clients grid → opens full ClientPage
    ClientDetail.tsx      the drawer: DNA, Glass Thread + receipts, learning, recs, draft message
    ClientPage.tsx        full-screen client cockpit (+ ComplianceDesk)
    ComplianceDesk.tsx    live drift + CIO-grounded explainable swap + what-if (receipts)
    ValueRadar.tsx        Client DNA as a 6-axis value hexagon
    NewsFeed.tsx / NewsDetail.tsx / NewsImpactMap.tsx   news views + which clients a story reaches
    Rehearse.tsx          client-twin simulator: reaction, objections, trajectory
    RmProfilePanel.tsx    edit the RM house style
scripts/gen-portfolio.cjs   regenerates src/data/portfolio.ts from repo-root data/*.csv
```

Voice Conversation Capture is **in progress**: `conversation*.ts(x)` +
`useRecorder.ts` exist; the `ConversationCapture.tsx` panel and its mount on
`ClientPage` are still to come (plan: `../docs/superpowers/plans/2026-06-20-voice-conversation-capture.md`).

## Data + engines (the important part)

Authored client narratives use **fictional instrument names** (e.g. "LuxeWear
Group"); the deterministic engines instead run on the **real** portfolio/CIO data,
bridged to each persona through one map.

- `src/data/portfolio.ts` — **generated** from repo-root `data/*.csv` via
  `scripts/gen-portfolio.cjs`. Exports `PORTFOLIOS` (holdings by mandate), `CIO`
  (recommendation list), `STRATEGIES` (target weights). Committed; rarely
  regenerated. (Generator needs `csv-parse` from the sibling `demo/` project.)
- `src/lib/portfolio.ts` — pure functions:
  - `computeDrift(holdings, strategies, mandate)` → ±2.0pp breaches
  - `proposeSwap(sellIsin, holdings, cio)` → CIO-constrained, **explainable** swap
    (`chosen` + `alternatives` + `rejected`, each with a `reason`)
  - `simulateSwap(input)` → what-if compliance (same-sector / CIO-BUY / drift / DNA)
  - `estimateImpact({exposureCHF, mode, severity, hasTrade})` → **explainable** CHF
    benefit/cost, component-by-component with the assumption in each `note`
  - `PERSONA_PLAY` — maps persona id → real flagged holding + scenario + aversion
    terms. **The bridge between authored personas and real data.**

**Explainability is a hard requirement.** Every number a user sees must trace to a
source or a stated assumption. Reuse the receipt pattern (`EVIDENCE_META` +
`.receipt` markup) for evidence; surface model assumptions in-line.

## Conventions & guardrails

- **Match the existing style.** Use the CSS variables and class patterns already
  in `index.css` (`.card`, `.section-title`, `.receipt`, `.verdict`/`.stamp`).
  Add new styles to `index.css`; don't introduce a CSS framework.
- **State** lives in React context providers when shared (mirror the existing
  `*Store.tsx`); local `useState`/`useMemo` otherwise.
- **TypeScript:** no `any`. Keep `tsc -b` clean. Pure logic → `lib/` (testable
  with vitest); UI → `components/`; shared styles → `index.css`.
- **Never** make the AI message or advise the client directly — drafts are
  RM-reviewed; inbound client messages are logged/flagged, not answered.
- **Git:** branch off `main`; PR non-trivial changes; one feature/fix per change.
  If a task balloons, stop and report rather than sprawl.

## Workflow for a task

1. Read the files your task names; skim neighbours for the existing pattern.
2. Make the scoped change, matching style. Pure logic in `lib/`, UI in
   `components/`, shared styles in `index.css`.
3. Verify: `npx tsc -b` clean, `npm run lint` clean, `npm run test` green, and
   load `http://localhost:5173` to exercise it.
4. Commit.
