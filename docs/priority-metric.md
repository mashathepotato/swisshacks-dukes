# Priority metric

The RM priority queue ranks the book by a single transparent score (0–100) — a
weighted blend of normalised components, each traceable to real data and shown
in the client's score breakdown (`components/PriorityScore.tsx`). Implementation:
`frontend/src/lib/priority.ts`.

## The blend

`score = 100 × Σ (weightᵢ × componentᵢ)`, each component in [0, 1]. **Weights are
tuned per mandate** and each vector sums to 1, so scores stay comparable across
the book.

| Component | What it measures (0..1) | Defensive | Balanced | Growth |
|---|---|---|---|---|
| **Event severity** | severity of the most-severe active signal ÷ 100 | 0.28 | 0.30 | 0.32 |
| **Portfolio exposure** | `amountAtStake` ÷ the book's largest | 0.20 | 0.22 | 0.24 |
| **Conflict** | how adversarial the active event is — `CONFLICT_WEIGHT[type]` | 0.15 | 0.16 | 0.17 |
| **Recency** | freshness of the trigger (7-day half-life) | 0.13 | 0.16 | 0.17 |
| **Market anomaly** | strongest SIX market-move signal touching the client ÷ 100 | **0.24** | **0.16** | **0.10** |

### Why the anomaly weight varies by strategy

A sharp price move means different things by mandate. A **Defensive** client chose
capital preservation, so a shock violates the core promise of their strategy →
it weighs most (0.24). A **Growth** client is risk-tolerant with a longer horizon
and expects volatility → a single move is more "within bounds" (0.10). Balanced
sits between. The same −8% move adds ~+8 score points for a Defensive client vs
~+3 for a Growth client.

### Conflict weights by signal type

`reputational 1.0 · value_conflict 1.0 · market_anomaly 0.85 · mandate_drift 0.7 ·
exposure 0.7 · opportunity 0.3` — a risk demands proactive contact more than a
positive opportunity.

## Why a dedicated market-anomaly term

The other components score the client's *single* most-severe event. A SIX-detected
price/volume shock (see [the anomaly-detection spec](superpowers/specs/2026-06-20-portfolio-anomaly-detection-design.md))
should count even when it isn't that top event — e.g. a client whose lead signal
is a reputational hit but who also holds a name that just gapped. So `anomaly` is
a distinct, always-on term (weight varies by mandate, see above). When a move
*is* the client's most-severe event it also flows through the severity/conflict
terms, so a market-driven top event scores highest of all.

Weights are calibrated so the challenge personas stay ahead of the synthetic
twins and Ammann stays top; `data/clients.calibration.test.ts` and
`lib/priority.test.ts` pin this.
