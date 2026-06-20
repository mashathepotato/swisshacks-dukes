# Decision Log

Append a short entry whenever we make a notable choice. Newest first.

## Template

### YYYY-MM-DD — <decision title>
- **Decision:**
- **Why:**
- **Alternatives considered:**
- **Owner:**

---

### 2026-06-20 — Voice Conversation Capture as the next feature
- **Decision:** Add in-browser live STT (Web Speech API) behind a consent gate
  that distills a consented client conversation into a reviewed CRM note + Client-
  DNA deltas with verbatim quote receipts; RM approves before anything merges.
- **Why:** Supplies the *upstream source* of the CRM logs the whole app is built
  on, and scores directly on Creativity + Trust/Explainability (50% of judging).
- **Alternatives considered:** uploading audio files (rejected — storage, no live
  demo wow); fully automatic merge (rejected — breaks human-in-the-loop).
- **Owner:** Masha · branch `feat/voice-conversation-capture` (see
  `docs/superpowers/specs|plans/2026-06-20-voice-conversation-capture*`).

### 2026-06-20 — Pluggable LLM engine seam (claude | phoeniqs | heuristic)
- **Decision:** Every LLM-backed "agent" (news assessor, transcript distiller)
  goes through one pattern that picks an engine and **always degrades to a
  deterministic heuristic** on missing key / network / error.
- **Why:** Hackathon wifi is flaky and we present live; the demo must never
  hard-fail, and the heuristic keeps results plausible offline.
- **Owner:** Masha.

### 2026-06-20 — Dashboard runs on deterministic mock data
- **Decision:** The React dashboard is wired to authored mock data
  (`frontend/src/data/`) rather than live SIX/Event Registry calls; the live
  seams live in `news-test/` and mirror the mock shapes.
- **Why:** A reliable, fast, repeatable demo; live integration is a stretch goal.
- **Alternatives considered:** full live wiring (rejected for demo risk).
- **Owner:** Masha.

### 2026-06-20 — Stack: React 19 + Vite frontend, zero-dep node:http backend
- **Decision:** React 19 + TypeScript + Vite for the cockpit; a dependency-free
  `node:http` server for the backend; `node:test` + Vitest for tests.
- **Why:** Fast iteration, minimal install/setup friction during a 48h build.
- **Owner:** Masha.

### 2026-06-19 — Repo & context scaffold
- **Decision:** Set up the repo with a standard `.gitignore` and a `context/` folder for shared docs.
- **Why:** Give the team (and AI agents) a single place to stay oriented during the hackathon.
- **Owner:** Masha
