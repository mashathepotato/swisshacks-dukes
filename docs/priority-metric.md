# Priority metric

The RM priority queue ranks the book by a single transparent score (0–100) — a
weighted blend of normalised components, each traceable to real data and shown
in the client's score breakdown (`components/PriorityScore.tsx`). Implementation:
`frontend/src/lib/priority.ts`.

## The blend

`score = 100 × Σ (weightᵢ × componentᵢ)`, each component in [0, 1], weights sum to 1.

| Component | What it measures (0..1) | Weight |
|---|---|---|
| **Event severity** | severity of the client's most-severe active signal ÷ 100 | 0.30 |
| **Portfolio exposure** | `amountAtStake` ÷ the book's largest | 0.22 |
| **Conflict** | how adversarial the active event is — `CONFLICT_WEIGHT[type]` | 0.16 |
| **Recency** | freshness of the trigger (7-day half-life) | 0.16 |
| **Market anomaly** | strongest SIX market-move signal touching the client ÷ 100 | 0.16 |

### Conflict weights by signal type

`reputational 1.0 · value_conflict 1.0 · market_anomaly 0.85 · mandate_drift 0.7 ·
exposure 0.7 · opportunity 0.3` — a risk demands proactive contact more than a
positive opportunity.

## Why a dedicated market-anomaly term

The other components score the client's *single* most-severe event. A SIX-detected
price/volume shock (see [the anomaly-detection spec](superpowers/specs/2026-06-20-portfolio-anomaly-detection-design.md))
should count even when it isn't that top event — e.g. a client whose lead signal
is a reputational hit but who also holds a name that just gapped. So `anomaly` is
a distinct, always-on term. It's weighted at 0.16 — comparable to conflict and
recency, below severity and exposure: a sharp move is materially urgent but a
values conflict or reputational hit still outranks it. When a move *is* the
client's most-severe event it also flows through the severity/conflict terms, so a
market-driven top event scores highest of all.

Weights are calibrated so the four challenge personas keep their relative order;
`lib/priority.test.ts` pins this.
