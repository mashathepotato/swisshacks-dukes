# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`swisshacks-dukes` is the **SwissHacks 2026** team repo for the SIX · Noumena ·
NTT DATA challenge: a next-generation **wealth-advisory copilot** ("Priori").
See `context/project.md` for the idea and `context/architecture.md` for the stack.

## Build / test / run

```bash
# Frontend dashboard (React 19 + Vite + TS) — http://localhost:5173
cd frontend && npm install && npm run dev
cd frontend && npm run build      # tsc -b && vite build
cd frontend && npm run lint       # eslint
cd frontend && npm run test       # vitest (pure-logic tests; being added)
cd frontend && npx tsc -b         # typecheck only

# Backend news pipeline + distill API (zero-dep node:http) — http://localhost:4000
node news-test/server.mjs                         # offline fixture, no API spend
NEWS_LIVE=1 node news-test/server.mjs             # live Event Registry
node --test news-test/*.test.mjs                  # backend tests
ASSESSOR_ENGINE=heuristic node news-test/server.mjs   # no LLM spend

# Data: regenerate CRM/portfolio CSVs from the source .xlsx workbooks
python3 data/extract.py
```

LLM/API keys are read from `demo/.env` (copy `demo/.env.example`; not committed).
The dashboard runs on deterministic mock data (`frontend/src/data/`); `news-test/`
holds the live SIX/Event-Registry + LLM seams. See `news-test/README.md`.

## Shared context

Team-facing docs live in `context/` (see `context/README.md` for conventions). Read these first to get oriented:

- `context/challenge.md` — challenge prompt, rules, judging criteria, deadlines
- `context/project.md` — what we're building: idea, scope, MVP, stretch goals
- `context/architecture.md` — stack, components, data flow, local setup
- `context/team.md` — who's who and who owns what
- `context/decisions.md` — running log of notable decisions and why

When the project takes shape, `context/` holds the human-facing detail; keep this file pointed at it and focused on build/test/run commands.

## Conventions

- Branch off `main`; open PRs for non-trivial changes.
- Keep `context/` current when scope, architecture, or decisions change.
- The LLM engine seam always degrades to a deterministic heuristic — never let a
  missing key or flaky network hard-fail the demo.
- Human-in-the-loop is non-negotiable: the AI equips the RM, never advises the
  client directly. The RM reviews/approves; the client decides.
