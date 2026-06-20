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

## Files

- `server.mjs` — HTTP server + pipeline (fetch → dedup → pre-filter → assess).
- `query.mjs` — shared Event Registry request shape + batch key.
- `classify.mjs` — regex layer + noise pre-filter.
- `assessor.mjs` — pluggable relevance agent (claude / phoeniqs / heuristic).
- `fetch-fixture.mjs` — capture raw articles → `fixtures/news.json`.
- `env.mjs` — loads `demo/.env` into the environment.
- `public/index.html` — the split feed / market-relevant UI.
