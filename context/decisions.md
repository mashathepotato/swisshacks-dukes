# Decision Log

Append a short entry whenever we make a notable choice. Newest first.

## Template

### YYYY-MM-DD — <decision title>
- **Decision:**
- **Why:**
- **Alternatives considered:**
- **Owner:**

---

### 2026-06-20 — Portfolio anomaly detection via SIX, into a computed priority score
- **Decision:** Detect extreme market-data moves (vol-scaled daily-return z-score
  ≥ 3, or volume ≥ 4×) on held instruments using the SIX MCP, associate each move
  with the clients who hold it (severity scaled by real CHF exposure), and surface
  it as a new `market_anomaly` signal in the existing priority queue. SIX is read
  through a **fetch-and-cache fixture behind a `PriceProvider` seam** (live MCP
  provider drop-in later). The priority score is **recomputed from scratch** as a
  transparent weighted model; the anomaly is one driver among
  value-conflict 0.32 / exposure 0.22 / relationship 0.16 / drift 0.16 /
  **anomaly 0.14**.
- **Why:** Price/volume anomalies are the one signal the dashboard lacks (news and
  mandate-drift are covered) and are exactly what the SIX key unlocks. The fixture
  seam keeps the demo deterministic (never hard-fail on flaky wifi) while the
  provenance is genuinely SIX EOD data, and leaves a one-file path to go live
  app-wide later. Recomputing the score makes it a glass-threaded, decomposable
  number rather than an authored constant — straight at the Trust/Explainability
  criterion. Anomaly weight sits below value-conflict and drift because a sharp
  price move is urgent but should not outrank a values conflict or a mandate
  breach; it still compounds with exposure so the same move ranks higher for the
  client with more at stake. Weights are calibrated to preserve the four personas'
  order, locked by a test.
- **Alternatives considered:** position/transaction anomalies (rejected — doesn't
  use SIX, overlaps Compliance Desk); a dedicated "Market Anomalies" tab (rejected
  — second surface, loses the queue's existing trust + Glass Thread); live runtime
  MCP calls (rejected for demo path — flaky-network risk, EOD lags a settled day
  anyway); layering anomaly onto the existing authored score (rejected — user
  asked for a from-scratch, justifiably-weighted recompute).
- **Owner:** Varad · spec `docs/superpowers/specs/2026-06-20-portfolio-anomaly-detection-design.md`.

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
