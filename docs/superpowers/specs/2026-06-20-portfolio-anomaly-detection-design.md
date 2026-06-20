# Portfolio Anomaly Detection — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorm) + validated against live SIX MCP → ready for implementation
**Feature:** Detect extreme market-data moves in held instruments using SIX EOD
price/volume data, associate each move with the clients who hold it (scaled by
real CHF exposure), and surface it as a first-class `market_anomaly` signal that
flows through the existing priority-score model and Glass Thread.

## Goal

A market-data-driven early-warning signal: when a holding's daily return is
extreme relative to its own 30-day volatility (or volume spikes), flag the
exposed clients, ranked by money at stake, with a fully traceable "why." It is
the one capability the dashboard lacks (news → holdings → clients and
mandate-drift are covered) and is exactly what the SIX MCP key unlocks.

## Decisions locked (brainstorm + validation)

1. **Signal = market-data price/volume moves** (vol-scaled daily-return z-score
   and volume spike), detected per instrument.
2. **Surfacing = the existing Priority Queue** via a new `market_anomaly`
   `SignalType`, reusing the Glass Thread — no separate tab.
3. **Detector is frontend-centric.** A pure TS detector (`lib/anomaly.ts`)
   computes anomalies in-browser over a committed SIX-derived price fixture
   (`data/sixPrices.ts`), exactly like `news.ts` `newsImpacts()` computes impact
   in-browser. Deterministic, offline, self-contained demo. The zero-dep
   `news-test` backend **cannot call the SIX MCP at runtime** (no MCP SDK), so a
   thin `/api/anomalies` + `PriceProvider` seam there is documented as the
   later live-migration path, not built now.
4. **Priority score extends the existing model** in `frontend/src/lib/priority.ts`
   (do NOT rewrite). That file already is a transparent weighted blend
   (severity 0.35 / exposure 0.25 / conflict 0.2 / recency 0.2 with a per-
   `SignalType` `CONFLICT_WEIGHT`). We add `market_anomaly` to `CONFLICT_WEIGHT`
   and make the "active signal" the highest-severity one so a fresh anomaly
   re-ranks the client. Weights unchanged ⇒ persona ordering cannot regress.
5. **Provenance = real US + honest synthetic.** SIX EOD coverage on this token is
   **US-listed instruments only** (validated below). The fixture carries REAL SIX
   series for US holdings and clearly-labeled `source:"synthetic"` series for
   non-US holdings. The Glass-Thread receipt shows the true source per
   instrument; synthetic is never disguised as SIX.

## SIX data reality (validated live, 2026-06-20)

Smoke-tested against the connected MCP:

- **Coverage:** US listings (XNAS/XNYS) return full data; Swiss/EU venues
  (XSWX, XETR) return **empty for both `end_of_day_history` and
  `end_of_day_snapshot`** — even XETR flagged `MOST_LIQUID_MARKET` for Adidas.
  So real SIX anomalies are available for the book's US names (Meta, Apple,
  NVDA, Amazon, Alphabet, Tesla, Costco, J&J, Walmart, Visa, Eli Lilly,
  Broadcom, …); Swiss/EU names (Nestlé, Roche, Adidas, Novartis, ABB, …) get
  synthetic series.
- **Persona impact:** only **LeCun → Meta** (US30303M1027, `14917609_XNAS`) has
  real data. Ammann→Adidas, Schneider→Roche, Räber→Nestlé use synthetic.
- **Fields:** `end_of_day_history(format="full")` returns
  `sessionDate, open, high, low, close, volume, historicalVolatility30Days`.
  `totalReturn` comes back **empty**, so we compute daily returns from `close`
  ourselves. `historicalVolatility30Days` is an **annualized %** (e.g. 26.6) →
  de-annualize to a daily σ via `/100/sqrt(252)`.
- **Real anomalies exist:** Meta 2026-03-26 close 547.54 (−8.0% vs 594.89, ~26.9%
  annualized vol ⇒ ≈ −4.7σ); 2026-04-30 −8.6% on 14M volume (~3.5× normal);
  2026-06-18 volume spike 12M. No synthetic seeding needed for Meta.
- **Quota:** `end_of_day_history` is hard-capped at **1 listing per call**
  (auto-fans 5/sec). The fixture is generated once at dev time by the
  MCP-connected session (this Claude Code), not at runtime.
- **Identifier resolution:** `listing_id = {valor}_{mic}` from the portfolio
  CSVs. Some portfolio ISINs are stale (e.g. Roche `CH0012032048` → current line
  `CH1499059983`); the fixture stores prices under the **portfolio's** ISIN.

## Architecture

```
data/portfolio/*.csv ──► held instruments (Valor + MIC + ISIN, per mandate)
        │
        │  (dev-time, MCP-connected session)
        ▼
fetch via SIX MCP (US: real EOD) + synthetic (non-US)  ──►  frontend/src/data/sixPrices.ts
        │                                                    (committed fixture; per-instrument `source`)
        ▼
frontend/src/lib/anomaly.ts  ── pure detector ──►  AnomalyEvent[] (per instrument)
        │   z = return/dailySigma ; volRatio ; severity ; direction ; source
        ▼
associate to clients: ISIN → issuer → clients in that mandate (PORTFOLIOS[mandate])
        │   per-client severity scaled by holding.currentCHF (exposure)
        ▼
attach as a `market_anomaly` NewsSignal on the client (+ set/raise amountAtStake)
        │
        ▼
lib/priority.ts (existing model, extended)  ── re-ranks the queue
        │
        ▼
Priority Queue badge (SIGNAL_META) + Glass-Thread step (explain.ts) with the
SIX/synthetic receipt
```

### New / touched files (frontend)

| File | Purpose |
|---|---|
| `frontend/src/data/sixPrices.ts` | committed price fixture: per-instrument `{ isin, listingId, issuer, source: "six"\|"synthetic", asOf, bars:[{date,close,volume}], hvol30 }` |
| `frontend/src/lib/anomaly.ts` | pure detector (returns/z/volRatio/severity) + client association + signal construction |
| `frontend/src/lib/anomaly.test.ts` | Vitest unit tests (detector, severity, association, calibration) |
| `frontend/src/types.ts` | add `"market_anomaly"` to `SignalType` (forces the `CONFLICT_WEIGHT` + `SIGNAL_META` additions — TS-enforced) |
| `frontend/src/lib/priority.ts` | add `market_anomaly` to `CONFLICT_WEIGHT`; select active signal by max severity |
| `frontend/src/lib/format.ts` | add `market_anomaly` to `SIGNAL_META` (label "Market move") |
| `frontend/src/lib/explain.ts` | Glass-Thread step for the anomaly with `Evidence{kind:"market"}` (kind already exists) |
| `frontend/src/data/clients.ts` | attach computed `market_anomaly` signals to affected clients (via the detector, at module load) |
| `frontend/scripts/gen-sixprices.cjs` *(optional)* | regenerate the synthetic portion / merge real pulls; the real pulls are produced by the MCP session |
| `docs/priority-metric.md` | create (currently a dangling ref in `priority.ts`); document the weights incl. the new `market_anomaly` conflict weight |

The `news-test` `PriceProvider` seam + `/api/anomalies` are described in
"Migration" below but are **not** part of this implementation.

## Detector (the maths) — `lib/anomaly.ts`

Pure deterministic functions over one instrument's daily bars:

**Return shock.** `dailyReturn[i] = close[i]/close[i-1] - 1`. Baseline daily σ
from `hvol30` (annualized %): `dailySigma = hvol30/100/Math.sqrt(252)`, with a
fallback to the trailing-30-bar stdev of returns when `hvol30` is missing.

```
z = latestDailyReturn / dailySigma
flag if |z| ≥ Z_THRESHOLD   (default 3.0, tunable)
```

**Volume spike.** `volRatio = latestVolume / mean(prior 30 bars volume)`; flag if
`volRatio ≥ VOL_THRESHOLD` (default 4.0, tunable). Volume-only is a weaker
"watch" signal; a return shock is primary.

**Severity (0–100), instrument-level:**

```
sev = clamp( 100 * (|z| / Z_SAT)                        // Z_SAT = 6 (saturation)
           + 15 * max(0, volRatio/VOL_THRESHOLD - 1), 0, 100 )
direction = sign(latestDailyReturn)   // ▼ drop / ▲ spike
```

**AnomalyEvent:** `{ isin, issuer, listingId, source, asOf, latestReturn, z,
volRatio, direction, severity, kind: "return_shock"|"volume_spike"|"both" }`.

Thresholds (`Z_THRESHOLD`, `VOL_THRESHOLD`, `Z_SAT`) live in one exported config
object so they're tunable.

## Client association

```
for each AnomalyEvent:
  for each mandate M, for each holding H in PORTFOLIOS[M] with H.isin === event.isin:
     clients in mandate M holding that issuer are exposed
     exposureCHF    = H.currentCHF
     clientSeverity = clamp( event.severity * exposureScale(exposureCHF), 0, 100 )
```

`exposureScale` gently boosts severity for larger positions (same `currentCHF`
the Compliance Desk reads). Clients reference holdings by **issuer name within
their mandate** (`Client.topHoldings` are names; `PERSONA_PLAY[id].mandate` /
`Client.mandate` gives the portfolio). The dashboard mirrors each holder's event
as a `NewsSignal`:

```
headline: "Meta ▼ 8.0% — 4.7σ daily move on 2.3× volume"
type:     "market_anomaly"
severity: clientSeverity
matchedHoldings: ["Meta Platforms Inc."]
```

## Priority score — extend the existing model

`frontend/src/lib/priority.ts` already computes the ranking. Changes:

1. **`CONFLICT_WEIGHT.market_anomaly = 0.85`** — a sharp price move is risk-type
   (demands proactive contact), just below `reputational`/`value_conflict` (1.0)
   and above `mandate_drift`/`exposure` (0.7). *Justification:* a market move is
   urgent but a values conflict or reputational hit still outranks it.
2. **Active signal = highest-severity** signal (replacing the implicit
   `signals[0]`), so a fresh extreme anomaly drives `severity`/`conflict` and the
   client re-ranks up. Exposure already flows through `amountAtStake`.
3. Weights (0.35/0.25/0.2/0.2) **unchanged** → personas keep their order. A test
   pins the persona ranking.

Every driver is already a Glass-Thread candidate; we add a `market_anomaly`
reason step with the SIX/synthetic receipt, e.g. `Market move +N: Meta −8.0%,
4.7σ, on CHF 185k · SIX EOD 2026-06-18`.

## Error handling & honesty

- **Provenance shown, never disguised.** Each event/receipt carries
  `source: "six" | "synthetic"`; the UI labels synthetic series explicitly.
- **Stale-data honesty.** SIX EOD lags a settled day; the `asOf` bar date is
  shown verbatim.
- **Short/empty series** (< ~5 bars) are skipped (no baseline) — not fatal.
- **Zero anomalies** is valid — the queue ranks on the other drivers.

## Testing (Vitest, pure logic, no network)

- **Detector:** a real Meta-derived series flags the −4.7σ day; a 1σ wiggle does
  not; a volume-only spike → `volume_spike`; flat/short series skip; thresholds
  honoured at the boundary.
- **Severity/direction:** monotonic in |z|, saturates at 100, sign correct.
- **Association:** one event → all holders in the mandate; per-client severity
  scales with `currentCHF`.
- **Priority:** `CONFLICT_WEIGHT.market_anomaly` applied; active-signal-by-max
  selection; **calibration test** pinning persona order (Ammann > Schneider > …).

## Migration to live SIX (future, not in this scope)

Implement `news-test/priceProvider.mjs` (`fixtureProvider` now; `sixLiveProvider`
wrapping `@modelcontextprotocol/sdk` calling `end_of_day_history`/`_snapshot`)
behind a `SIX_SOURCE=fixture|live` seam that degrades to the fixture on
error/missing key — mirroring the `assessor.mjs`/`distill.mjs` pattern. Expose
`GET /api/anomalies`; the dashboard can then fetch live instead of importing the
committed fixture. The dev-time pull this session performs is the working
reference for those exact MCP calls.

## Out of scope

- Runtime MCP calls in the demo path; intraday/tick detection; a separate
  "Market Anomalies" tab; writing computed scores back to source workbooks.
