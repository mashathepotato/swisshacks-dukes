# By-client news relevance — combined priority score

The **By client** news view ranks each client's funnel stories by a single
**combined priority score** in `[0, 1]`. It blends three independent signals:

```
combined = 0.5 · valueOverlap  +  0.3 · severity  +  0.2 · recency
```

All three inputs are in `[0, 1]` and the weights sum to `1`, so the result is
always in `[0, 1]`. Implementation: `src/lib/newsRelevance.ts` (`RELEVANCE_WEIGHTS`,
`severityOf`, `recencyOf`, `relevance`).

---

## The three components

### 1. Value overlap — *does it touch what this client cares about?*  (weight 0.5)
The weighted average of `story value × client value` over the value-axes the
story implicates and the client holds:

```
valueOverlap = Σ(storyValue_i · clientValue_i) / (number of affected axes)
```

- `storyValue_i` = `article.values[i].score` (0..1, how strongly the story
  implicates axis *i*, from the pipeline's `scoreValues`).
- `clientValue_i` = the client's conviction (0..1) on that axis.

This is the **personalisation core** of the view and the only client-specific
term — see "Why these weights" below.

### 2. Severity — *how big is the story, regardless of client?*  (weight 0.3)
An intrinsic significance score, built only from signals actually present in the
baked feed:

```
severity = clamp01( 0.45 · marketMovement
                  + 0.35 · min(1, |sentiment| / 0.5)
                  + 0.20 · min(1, themeCount / 2) )
```

- **marketMovement (0.45)** — a broad market move (sell-off, rally, index event)
  is the most consequential category for a portfolio, so it dominates.
- **|sentiment| / 0.5 (0.35)** — Event Registry sentiment magnitude proxies how
  strong/charged the story is. Observed magnitudes top out near `0.5` in the
  feed, so we normalise by `0.5` to span the range.
- **theme breadth (0.20)** — a story spanning multiple themes touches more of the
  market than a single-theme item; a small contribution.

We deliberately **exclude `confidence`**: the offline Stage-2 engine is the
heuristic, which emits a near-constant `0.5`, so it carries no information here.
(With the LLM engine, `confidence` could be folded back in.)

### 3. Recency — *is it still timely?*  (weight 0.2)
Exponential decay with a **7-day half-life**, anchored to the **newest story in
the feed** (so recency is meaningful on a static, captured feed rather than
collapsing to ~0 against real wall-clock time):

```
recency = 0.5 ^ (ageDays / 7)        # ageDays measured from the feed's latest story
```

A 7-day half-life matches how actionable RM news ages: a story is worth ~half as
much to raise with a client each week that passes; multi-month-old items fall to
near zero.

---

## Why these weights (0.5 / 0.3 / 0.2)

The ordering and magnitudes are chosen to match what the view is *for* — helping
an RM decide which stories to raise with **a specific client** — not pulled from
thin air:

1. **Value overlap leads (0.5).** This view's whole purpose is personalisation:
   surface what's relevant to *this* client's values. It's the only
   client-specific term, so it gets the plurality of the weight — it must be able
   to outrank a generically big-but-irrelevant story.
2. **Severity is second (0.3).** Among stories that *are* relevant, a more
   material event deserves attention sooner. It's important but should *modulate*
   the personalised signal, not override it — hence below value overlap.
3. **Recency is the smallest (0.2).** Freshness is a tie-breaker / nudge: a newer
   story is more actionable, but a slightly older story that strongly matches the
   client's values and is highly material should still rank above a brand-new but
   marginal one. Giving recency the lowest weight prevents the feed from becoming
   a pure reverse-chronological list.

**Sanity bounds.** With the weights above:
- A story can never rank on recency or severity alone above the cap those two
  contribute (`0.3 + 0.2 = 0.5`), so a maximally-relevant story
  (`valueOverlap = 1`) always beats any story with no value overlap.
- A holdings-only story (the client owns the instrument but it touches none of
  their values → `valueOverlap = 0`) still appears, ranked by its severity and
  recency, but below anything that engages the client's values — matching the
  product intent.

Only stories with **some** concrete client link (a held instrument, a value
overlap, or mandate exposure) enter the ranking at all (`hasRelevance`); the
combined score then orders that already-relevant set.

---

## Tuning

The weights live in one place — `RELEVANCE_WEIGHTS` in
`src/lib/newsRelevance.ts` — and must continue to sum to `1`. The half-life
(`HALF_LIFE_DAYS`) and the severity sub-weights are adjacent constants in the
same file. If the live LLM Stage-2 engine replaces the heuristic, reconsider
folding `confidence` into `severity`.
