# news-test — Event Registry viewer + 3-stage relevance pipeline

A tiny, zero-dependency web app that fetches news from Event Registry
(newsapi.ai) and runs it through three filtering stages before showing the
survivors split into "incoming feed" vs "selected". The Node server proxies the
API so the key stays server-side (no CORS, key never reaches the browser).

## The pipeline

1. **Stage 1 — investment relevance** (fast, deterministic, no LLM): keeps
   company/business/market articles (incl. business moves like "Nestlé launches
   a green venture"); drops the obviously irrelevant ("top 10 dog toys").
2. **Stage 2 — core-value themes** (the agent stage): tags each survivor with
   themes from a fixed vocabulary (environment, tech-innovation, healthcare,
   energy, financials, market-movement, geopolitics, governance, consumer) and a
   `marketMovement` flag. Runs on Claude / Phoeniqs / heuristic (see Engines).
3. **Stage 3 — instruments** (deterministic): matches each selected article to
   the specific portfolio holdings it affects and labels them by **ISIN**.

## Run

**Offline is the default** while developing — it serves a saved fixture and
spends **no API calls**:

```bash
node news-test/server.mjs        # OFFLINE: serves news-test/fixtures/news.json
# open http://localhost:4000
```

Go live (calls Event Registry, spends API) only when you mean to:

```bash
NEWS_LIVE=1 node news-test/server.mjs
```

Refresh the fixture occasionally (one API call per query):

```bash
node news-test/fetch-fixture.mjs   # saves keyword:oil / keyword:markets / business
```

## Engines (the relevance "agent")

Set `ASSESSOR_ENGINE`:

- `claude` *(default)* — local Claude CLI, headless. Uses this machine's Claude
  auth, no API key. Model via `ASSESSOR_CLAUDE_MODEL` (default `haiku`).
- `phoeniqs` — OpenAI-compatible LLM; needs `PHOENIQS_API_KEY` in `demo/.env`.
- `heuristic` — deterministic regex, no LLM. Fastest; use to test plumbing.

```bash
ASSESSOR_ENGINE=heuristic node news-test/server.mjs   # offline + no LLM spend
```

Config is read from the real environment, falling back to `demo/.env`.

## API endpoints (LLM seams)

All seams degrade gracefully — missing key or network failure returns a
deterministic heuristic result so the demo never hard-fails.

- **`POST /api/transcript/distill`** — summarise a meeting transcript into
  structured talking points. Body `{ transcript }` → `{ ...result, engine }`.
  Backed by `distill.mjs` (Anthropic, key from `demo/.env`).

- **`POST /api/transcript/digest`** — lightweight single-pass digest of a
  transcript. Body `{ transcript }` → `{ ...result }`. Backed by `digest.mjs`.

- **`POST /api/transcript/dialogue`** — analyse dialogue turns in a transcript.
  Body `{ transcript }` → `{ ...result }`. Backed by `dialogue.mjs`.

- **`POST /api/simulate`** — Rehearse-a-proposal client-reaction simulator.
  Body `{ client, proposal, baseline }` → `{ ...result }`. Backed by
  `simulate.mjs` (Anthropic, key from `demo/.env`); degrades to the baseline.
  Overrides: `SIMULATE_MODEL` (default `claude-opus-4-8`), `SIMULATE_EFFORT`
  (default `medium`).

- **`POST /api/ask`** — ask-about-client copilot. Body
  `{ client, context, question, history }` → `{ answer, engine, model }`.
  Backed by `ask.mjs` (Anthropic, key from `demo/.env`); degrades to a
  deterministic keyword router. Overrides: `ASK_MODEL` (default
  `claude-opus-4-8`), `ASK_EFFORT` (default `medium`).

- **`GET /api/news`** — fetch and pipeline-filter news articles (proxies Event
  Registry, applies the 3-stage pipeline).

## Files

- `server.mjs` — HTTP server + pipeline (fetch → dedup → pre-filter → assess).
- `query.mjs` — shared Event Registry request shape + batch key.
- `classify.mjs` — regex layer + noise pre-filter.
- `assessor.mjs` — pluggable relevance agent (claude / phoeniqs / heuristic).
- `distill.mjs` — transcript → talking-points LLM seam.
- `digest.mjs` — transcript digest LLM seam.
- `dialogue.mjs` — transcript dialogue-analysis LLM seam.
- `simulate.mjs` — proposal client-reaction simulator LLM seam.
- `ask.mjs` — ask-about-client copilot LLM seam (keyword router fallback).
- `fetch-fixture.mjs` — capture raw articles → `fixtures/news.json`.
- `env.mjs` — loads `demo/.env` into the environment.
- `public/index.html` — the split feed / market-relevant UI.
