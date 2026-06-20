# Decision Log

Append a short entry whenever we make a notable choice. Newest first.

## Template

### YYYY-MM-DD — <decision title>
- **Decision:**
- **Why:**
- **Alternatives considered:**
- **Owner:**

---

### 2026-06-20 — Portfolio anomaly detection via SIX, into the priority score
- **Decision:** Detect extreme market-data moves (vol-scaled daily-return z-score
  ≥ 3, or volume ≥ 4×) on held instruments using SIX EOD data, associate each move
  with the clients who hold it (severity scaled by real CHF exposure), and surface
  it as a new `market_anomaly` signal in the existing priority queue + Glass
  Thread. Detection is **frontend-centric**: a pure TS detector (`lib/anomaly.ts`)
  runs in-browser over a committed SIX-derived fixture (`data/sixPrices.ts`), like
  `newsImpacts()`. The priority score **extends the existing weighted model** in
  `lib/priority.ts` (severity 0.35 / exposure 0.25 / conflict 0.2 / recency 0.2):
  add `market_anomaly` to `CONFLICT_WEIGHT` (0.85) and pick the highest-severity
  signal as the active driver. Provenance is **real US + honest synthetic**: SIX
  EOD coverage on the hackathon token is US-listed only (Swiss/EU venues return
  empty, validated live), so US holdings carry real SIX series and non-US holdings
  carry clearly-labeled `source:"synthetic"` series — never disguised.
- **Why:** Price/volume anomalies are the one signal the dashboard lacks (news and
  mandate-drift are covered) and are what the SIX key unlocks. Frontend-centric +
  committed fixture keeps the demo deterministic and offline (the zero-dep backend
  can't be an MCP client at runtime anyway); the fixture is generated once by the
  MCP-connected Claude Code session. Extending the existing priority model (not a
  rewrite — that model already exists and is exactly "weighted like the others")
  means weights stay unchanged so persona ordering can't regress, while the
  anomaly is justifiably weighted just below reputational/value-conflict and above
  mandate-drift. Real Meta data already shows genuine −4.7σ / volume-spike events,
  so the SIX provenance is real where coverage exists.
- **Alternatives considered:** position/transaction anomalies (rejected — doesn't
  use SIX, overlaps Compliance Desk); a dedicated "Market Anomalies" tab (rejected
  — loses the queue's trust + Glass Thread); backend `news-test` pipeline as the
  primary path (deferred — kept as the documented live-migration seam, but the
  backend can't call the MCP at runtime and the dashboard is static); rewriting
  the priority score from scratch (rejected once `lib/priority.ts` was found to
  already be the transparent weighted model requested); all-synthetic prices
  (rejected — wastes the real SIX integration); US-only with no Swiss anomalies
  (rejected — three of four personas are Swiss/EU, so honest synthetic keeps them
  demoable).
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
