# AGENTS.md — RM Copilot prototype

Pickup guide for sub-agents taking on **small, scoped tasks** in this prototype.
Read this top-to-bottom once, then grab a task from the backlog at the bottom.

## What this is

The **RM Copilot** — a relationship-manager dashboard for the SwissHacks "Next
Generation of Wealth Advisory" challenge. It surfaces which clients need
attention, explains *why* (with source receipts), lets the RM rehearse the
outcome of advice, and drafts client messages. **The AI never advises the client
directly** — it equips the RM, who decides.

- **Stack:** React 19 + Vite + TypeScript. **Frontend-only — no backend.**
- **Branch:** `feat/copilot-prototype` (forked from `dev`). Do **not** push to `dev`.
- **Data:** authored mock clients (`src/data/clients.ts`) **plus** real
  CSV-derived portfolio/CIO/strategy data (`src/data/portfolio.ts`) that grounds
  the deterministic engines.

## Run & verify

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
npx tsc --noEmit -p tsconfig.app.json   # typecheck — must stay clean
npm run lint           # eslint
```

There is **no test runner yet** (adding one for the `lib/` engines is a backlog
task). Until then, verify by: (1) tsc clean, (2) `npm run lint` clean, (3) load
the app and exercise the feature you touched.

## Map of the codebase

```
src/
  App.tsx                 4 tabs: Priority queue · News feed · Rehearse · Rehearse outcome
  main.tsx                wraps App in <LearningProvider> + <DoneProvider>
  types.ts                Client, NewsItem, Evidence, ReasonStep, etc. (authored model)
  index.css               the whole design system (dark theme, CSS vars). Add styles here.
  data/
    clients.ts            4 personas (rich) + synthetic twins — AUTHORED mock data
    news.ts, themes.ts, feedback.ts, bookSim.ts   authored datasets
    portfolio.ts          GENERATED real holdings/CIO/strategies (see "Data + engines")
  lib/
    portfolio.ts          ★ deterministic engines: drift, swap, what-if, impact + PERSONA_PLAY
    learning.ts / learningStore.tsx   RLHF feedback model (context provider)
    doneStore.tsx         tasklist "mark complete" state (context, localStorage-backed)
    explain.ts, format.ts REASON_META / EVIDENCE_META, money + date formatters
  components/
    PriorityQueue.tsx     ranked book + active/Completed split (tasklist)
    ClientDetail.tsx      the drawer: DNA, reasoning chain + receipts, learning, recs,
                          ComplianceDesk, draft message, "Mark as complete"
    ComplianceDesk.tsx    real drift + CIO-grounded explainable swap + what-if (source receipts)
    RehearseOutcome.tsx   single-client "follow this advice" sim (reaction + monetary impact + compliance)
    BookSimulator.tsx     whole-book adoption animation (kept behind a toggle in RehearseOutcome)
    NewsFeed/NewsDetail/ValueRadar/TrajectoryChart/Sparkline   supporting views
```

## Data + engines (the important part)

The authored client narratives use **fictional instrument names** (e.g. "LuxeWear
Group"). The deterministic engines instead run on the **real** portfolio/CIO data
and are connected to each persona through one map:

- `src/data/portfolio.ts` — **generated** from the repo-root `data/*.csv` via
  `scripts/gen-portfolio.cjs`. It exports `PORTFOLIOS` (holdings by mandate),
  `CIO` (the recommendation list), `STRATEGIES` (target weights). It is committed;
  you rarely need to regenerate it. (The generator needs the `csv-parse` package,
  which lives in the sibling `demo/` project — run it from there if you must.)
- `src/lib/portfolio.ts` — pure functions:
  - `computeDrift(holdings, strategies, mandate)` → ±2.0pp breaches
  - `proposeSwap(sellIsin, holdings, cio)` → CIO-constrained, **explainable** swap
    (prefers same sub-asset sleeve; returns `chosen` + `alternatives` + `rejected`,
    each with a `reason`)
  - `simulateSwap(input)` → what-if compliance (same-sector / CIO-BUY / drift / DNA verdict)
  - `estimateImpact({exposureCHF, mode, severity, hasTrade})` → **explainable**
    CHF benefit/cost, component-by-component with the assumption in each `note`
  - `PERSONA_PLAY` — maps each persona id → real flagged holding + scenario +
    aversion terms. **This is the bridge between authored personas and real data.**

**Explainability is a hard requirement.** Every number a user sees must trace to a
source or a stated assumption. Reuse the receipt pattern (`EVIDENCE_META` +
`.receipt` markup) for evidence; surface model assumptions in-line (see
`estimateImpact`'s `note` fields and the "An estimate, not a guarantee…" footer).

## Conventions & guardrails

- **Match the existing style.** Use the CSS variables and class patterns already
  in `index.css` (`.card`, `.section-title`, `.receipt`, `.verdict`/`.stamp`,
  `.bs-*`). Add new styles to `index.css`; don't introduce a CSS framework.
- **State** lives in React context providers when shared (mirror `doneStore.tsx`
  / `learningStore.tsx`); local `useState`/`useMemo` otherwise.
- **TypeScript:** no `any`. Keep `tsc` clean. Engine logic goes in `lib/` as pure
  functions (so it stays testable).
- **Frontend-only:** no servers, no network calls, no new runtime deps without a
  good reason. All data is local.
- **Never** make the AI message or advise the client directly — drafts are
  RM-reviewed; inbound client messages are logged/flagged, not answered.
- **Git:** work on `feat/copilot-prototype` (or a branch off it). **Do not push to
  `dev` and do not merge to `main`.** Commit messages: clear, imperative, **no
  `Co-Authored-By` trailer**.
- **Keep tasks small.** One feature/fix per change. If a task balloons, stop and
  report rather than sprawl.

## Workflow for a task

1. Read the files your task names; skim neighbours for the existing pattern.
2. Make the scoped change, matching style. Put pure logic in `lib/`, UI in
   `components/`, shared styles in `index.css`.
3. Verify: `npx tsc --noEmit -p tsconfig.app.json` clean, `npm run lint` clean,
   and load `http://localhost:5173` to exercise it.
4. Commit (no co-author trailer).
