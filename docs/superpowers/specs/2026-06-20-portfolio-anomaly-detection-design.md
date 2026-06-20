# Portfolio Anomaly Detection — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorm) → ready for plan
**Feature:** Detect extreme market-data moves in held instruments via the SIX MCP,
associate each move with the clients who hold it (scaled by real CHF exposure),
and surface it as a first-class signal in the RM priority queue — contributing to
a newly **computed** priority score.

## Goal

Give the RM a market-data-driven early-warning signal: when a holding's price
makes an extreme move relative to its own volatility (or volume spikes), flag the
clients exposed to it, ranked by how much money is at stake, with a fully
traceable "why." This is the one capability the dashboard does not already have
(news → holdings → clients and mandate-drift are covered) and it is exactly what
the SIX MCP key unlocks.

## Decisions locked in brainstorming

1. **Anomaly signal = market-data price/volume moves** (not position/transaction
   anomalies). Detected on the instrument from SIX EOD/intraday data.
2. **Surfacing = fold into the existing Priority Queue** as a new signal type,
   reusing the Glass-Thread "why" — no separate tab.
3. **SIX integration = fetch-and-cache a fixture behind a provider seam.** The
   detector is a pure, deterministic, offline-testable function over OHLCV. A live
   MCP provider is a drop-in behind the same seam for a later app-wide migration.
4. **Priority score is recomputed from scratch** as a transparent weighted model;
   the market anomaly is one justifiably-weighted driver among the others. Weights
   are calibrated to preserve the four personas' relative order (locked by a test).

## Architecture

```
data/portfolio/*.csv ──► held instruments (Valor + MIC + ISIN)
        │
        ▼
[PriceProvider seam]  ── fixture (default) ─┐   six-live (later) ──┐
        │                                   ▼                      ▼
        │                       news-test/fixtures/        @modelcontextprotocol/sdk
        │                        six-prices.json            → SIX MCP (bearer key)
        ▼
anomalies.mjs  ──►  pure detector: per-instrument OHLCV → AnomalyEvent[]
        │            (vol-scaled return z-score + volume spike)
        ▼
associate to clients (held ISIN → client) → severity × CHF exposure
        │
        ▼
GET /api/anomalies  ──►  dashboard mirrors as a market_anomaly signal
        │
        ▼
Priority Queue (re-ranked by computed score) + Glass-Thread receipt
```

### The provider seam (the migration boundary)

The single interface a live migration swaps. Everything downstream depends only
on this, so going live app-wide later is "implement one more provider," not a
rewrite.

```js
// PriceProvider
//   getDailyHistory(listingId) -> { listingId, isin, bars: [{date, open, high, low, close, volume}] }
//   getSnapshot(listingId)     -> { listingId, close, volume, hist30dVol, asOf }
```

- `fixtureProvider` (now) reads `six-prices.json`.
- `sixLiveProvider` (later) wraps the MCP SDK; selected by `SIX_SOURCE=live`.
- On live error / missing key, log and **fall back to the fixture** (same
  degrade-to-deterministic pattern as the assessor/distill seams).

`listing_id = {valor}_{mic}` — composed from the portfolio CSVs, which already
carry Valor + MIC. SIX tools used: `end_of_day_history(listing_id)` (OHLCV
series) and `end_of_day_snapshot(listing_id)` (close, volume, `hist30dVol`).
Fundamentals/estimates/classification tools are gated with the hackathon token
and are **not** needed — CIO ratings + industry groups come from our CSVs.

### New / touched files

| File | Purpose |
|---|---|
| `news-test/priceProvider.mjs` | seam + `fixtureProvider` (+ stub for `sixLiveProvider`) |
| `news-test/anomalies.mjs` | pure detector + client association |
| `news-test/fixtures/six-prices.json` | cached real SIX EOD series for held instruments |
| `news-test/fetch-six.mjs` | dev script: (re)generate the fixture via the SIX MCP; reference for the future live provider |
| `news-test/anomalies.test.mjs` | detector / association / priority-calibration tests |
| `news-test/server.mjs` | add `GET /api/anomalies` route |
| `frontend/src/types.ts` | add `"market_anomaly"` to `SignalType` |
| `frontend/src/lib/priority.ts` | new: transparent weighted priority-score recompute |
| `frontend/src/data/clients.ts` | scores become computed outputs (driver inputs authored) |
| `frontend/src/lib/explain.ts` | Glass-Thread step for the anomaly + each score driver |

## Detector (the maths)

Pure deterministic function over one instrument's daily OHLCV. Two independent,
vol-normalised detectors:

**1. Return shock.** Daily log returns from the bars. Baseline σ = the snapshot's
`hist30dVol` de-annualised to a daily figure, falling back to the trailing-30-bar
stdev if the snapshot is missing.

```
z = latestDailyReturn / dailySigma
flag if |z| ≥ Z_THRESHOLD   (default 3.0, tunable)
```

**2. Volume spike.** `volRatio = latestVolume / mean(prior 30 bars volume)`; flag
if `volRatio ≥ VOL_THRESHOLD` (default 4.0, tunable). Volume-only is a weaker
"watch" signal; a return shock is primary.

**Severity (0–100), instrument-level**, blended and clamped into the existing
`severity` field:

```
sev = clamp( 100 * (|z| / Z_SAT)                       // saturates at Z_SAT = 6
           + 15 * max(0, volRatio/VOL_THRESHOLD - 1), 0, 100 )
direction = sign(latestDailyReturn)   // ▼ drop / ▲ spike — drives framing
```

**Output** per flagged instrument:

```js
AnomalyEvent = {
  isin, listingId, issuer,
  asOf,                      // bar date (EOD lags a settled day — shown honestly)
  latestReturn, z, volRatio, // raw receipts
  direction,                 // -1 down / +1 up
  severity,                  // 0..100
  kind: "return_shock" | "volume_spike" | "both",
}
```

All thresholds (`Z_THRESHOLD`, `VOL_THRESHOLD`, `Z_SAT`) live in one config block,
overridable via env. The fixture is deliberately seeded so the persona holdings
(Adidas, Roche, Nestlé, Meta) light up for the demo.

## Client association

An anomaly is detected on an *instrument*; fan it out to every client holding it:

```
for each AnomalyEvent:
  holders = clients where event.isin ∈ client's holdings (by ISIN)
  for each holder:
    exposureCHF    = that holding's currentCHF for this client
    clientSeverity = combine(event.severity, exposureScale(exposureCHF))
```

`exposureScale` nudges severity up for larger positions (a 3σ drop on CHF 200k
matters more than on CHF 5k), using the same `currentCHF` the Compliance Desk
reads. The same market event therefore ranks differently per client, by their
real money at stake.

The dashboard mirrors each holder's event as a `NewsSignal`-shaped record so it
flows through the existing queue/feed UI unchanged:

```
headline: "ABB ▼ 9.2% — 3.4σ daily move on 11× volume"
type:     "market_anomaly"
severity: clientSeverity
matchedHoldings: ["ABB Ltd."]
```

## Priority score — recomputed from scratch

`priorityScore = round( 100 × Σ (wᵢ × mᵢ) )`, clamped 0–100. Each driver
`mᵢ ∈ [0,1]` is a normalised magnitude traceable to real data; weights sum to 1.

| Driver | `mᵢ` — what it measures (source) | Weight |
|---|---|---|
| Value conflict | dominant value/reputational signal severity ÷ 100 (persona triggers) | 0.32 |
| Exposure | CHF at stake on the flagged holding ÷ book size | 0.22 |
| Relationship | DNA sensitivity amplifier (affinity weight on the touched theme) | 0.16 |
| Mandate drift | breach magnitude vs the ±2.0pp line (Compliance Desk maths) | 0.16 |
| **Market anomaly** | client-level anomaly severity ÷ 100 (new SIX-driven driver) | **0.14** |

**Justification for the weights.** A *values* conflict is the heart of every
persona trigger, so it dominates (0.32). Money-at-stake (0.22) is the next most
objective urgency lever. A sharp price move is urgent but should not outrank a
values conflict or a mandate breach, so the market anomaly sits at 0.14 — below
drift (0.16) — yet it compounds with exposure and relationship, so the same move
ranks higher for a client with more in the position. A max-severity anomaly
contributes up to ~14 points on its own.

Every driver is rendered as a **Glass-Thread step with its receipt**, e.g.
`Market anomaly +11: ABB −9.2%, 3.4σ, on your CHF 185k position · SIX EOD
2026-06-18`, so the score is fully decomposable on screen. Weights live in the
tunable config block.

**Demo safety:** weights are calibrated so the four personas keep their current
relative order; `anomalies.test.mjs` asserts that ranking. A weight change that
reorders the personas fails the test.

## Error handling & fallback

- Fixture is the default and always present (`SIX_SOURCE=fixture`).
  `SIX_SOURCE=live` selects `sixLiveProvider`; on throw / missing key it logs and
  falls back to the fixture.
- Instruments with no bars or < ~5 bars are skipped (no baseline) — logged, not
  fatal.
- SIX EOD lags one settled day; the `asOf` bar date is shown verbatim, never
  disguised as live.
- Zero anomalies is valid — the queue ranks on the other drivers.

## Testing (`node:test`, pure logic, no network)

- **Detector:** clean 3.4σ drop flags; 1σ wiggle does not; volume-only spike →
  `volume_spike`; flat/short series skip; threshold boundaries honoured.
- **Severity/direction:** monotonic in |z|, saturates at 100, sign correct.
- **Association:** one event → multiple holders; per-client severity scales with
  `currentCHF`.
- **Priority recompute:** driver math; saturating clamp; **calibration test**
  pinning persona order (Ammann > Schneider > …).
- **Provider seam:** fixture provider returns the expected shape; live failure
  falls back to the fixture.

## Out of scope

- Live runtime MCP calls in the demo path (fixture is the demo source; the live
  provider is a drop-in for a later migration).
- Intraday/tick anomaly detection (EOD bars are sufficient for the demo).
- A separate "Market Anomalies" tab (folds into the priority queue).
- Writing back any computed score to source workbooks.
