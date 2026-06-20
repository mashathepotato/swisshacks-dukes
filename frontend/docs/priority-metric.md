# Priority queue — transparent priority score

The **Priority queue** ranks the book by a single **priority score** in `[0, 1]`,
displayed out of 100. It replaces the old hand-authored `priorityScore` number
(which was opaque — a value with no visible derivation) with a weighted blend of
four signals, each normalised to `[0, 1]`:

```
priority = 0.35 · severity  +  0.25 · exposure  +  0.20 · conflict  +  0.20 · recency
```

The weights sum to `1`, so the score stays in `[0, 1]`. Implementation:
`src/lib/priority.ts` (`PRIORITY_WEIGHTS`, `priorityOf`, `rankBook`). The
breakdown is shown in the client preview drawer.

---

## The four components

### 1. Severity — *how big is the triggering event?*  (weight 0.35)
```
severity = (activeSignal.severity) / 100        # 0 if the client has no active signal
```
The magnitude of the event that surfaced the client (a forced-labour
investigation, an R&D cut, a mandate-drift alert). Clients with **no active
signal** score 0 here — correctly, since nothing is happening to them right now.

### 2. Exposure — *how much is at stake?*  (weight 0.25)
```
exposure = amountAtStake / (largest amountAtStake in the book)
```
CHF exposure tied to the situation, normalised against the book's largest
position so it spans `[0, 1]`. A severe event on a large position is more
material than the same event on a small one.

### 3. Conflict — *is it a risk or just an opportunity?*  (weight 0.20)
A fixed weight per signal **type** — how adversarial the event is:

| signal type | weight | rationale |
|---|---|---|
| `reputational`, `value_conflict` | 1.0 | direct threat — must be defused proactively |
| `mandate_drift`, `exposure` | 0.7 | a real risk to manage, less acute |
| `opportunity` | 0.3 | positive news — worth raising, not urgent |
| *(no signal)* | 0 | nothing to action |

This separates "must call them before the press does" from "nice to mention."

### 4. Recency — *is the trigger still fresh?*  (weight 0.20)
Exponential decay with a **7-day half-life**, anchored to the **most recent
trigger in the book** (so it's meaningful on the static demo dataset rather than
collapsing against real wall-clock time):

```
recency = 0.5 ^ (ageDays / 7)     # ageDays from the latest signal / last message in the book
```
The trigger date is the client's last inbound message, else their top signal's
publish date. Fresh triggers need timely action; stale ones decay.

---

## Why these weights (0.35 / 0.25 / 0.20 / 0.20)

The ordering reflects what actually drives an RM's "who do I deal with first":

1. **Severity leads (0.35).** The size of the event is the dominant determinant
   of urgency — a front-page reputational scandal outranks a routine review,
   regardless of anything else. It gets the largest single weight.
2. **Exposure is second (0.25).** Money at risk raises the stakes of acting (or
   not). It scales the severity of the situation but shouldn't, alone, push a
   client with no live issue to the top — hence below severity.
3. **Conflict (0.20).** Distinguishes problems to defuse from opportunities to
   surface. Important for *what kind* of attention is needed, so it modulates
   rather than dominates.
4. **Recency (0.20).** A timeliness nudge so genuinely fresh triggers rise, but
   small enough that a slightly older, severe, high-exposure conflict still
   outranks a brand-new trivial one.

**Consequences (sanity checks).**
- A client with **no active signal** scores only on exposure (`≤ 0.25`), so they
  sit below any client with a live, material event — which is the correct default
  for a "needs attention" queue.
- The maximum a non-severe client can reach on exposure + recency alone
  (`0.25 + 0.20 = 0.45`) is below what a maximally-severe conflict contributes
  (`0.35 + 0.20 = 0.55`), so a real crisis always outranks a big-but-quiet account.

---

## Tuning

Weights live in `PRIORITY_WEIGHTS` (`src/lib/priority.ts`) and must continue to
sum to `1`. The per-type `CONFLICT_WEIGHT` table and the `HALF_LIFE_DAYS` constant
are adjacent. This mirrors the news feed's combined-score design
(`docs/relevance-metric.md`) so the two rankings stay methodologically consistent.
