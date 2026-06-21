# Priority metric — moved

The priority-score justification now lives at the repo root, in
[`docs/priority-metric.md`](../../docs/priority-metric.md). That is the single
source of truth referenced by the implementation (`frontend/src/lib/priority.ts`)
and it documents the current model — a five-component, per-mandate weighted blend
including the **Market anomaly** term.

This file used to describe an earlier four-component model
(`0.35 severity + 0.25 exposure + 0.20 conflict + 0.20 recency`) and is kept only
as a redirect. See the canonical doc for the up-to-date weights and rationale.
