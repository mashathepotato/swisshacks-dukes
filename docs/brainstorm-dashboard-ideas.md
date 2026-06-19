# Brainstorm — Advisor Dashboard Ideas

> Working ideation for the SwissHacks 2026 "Next Generation of Wealth Advisory"
> build. Raw idea dump — not yet a committed design. See `context/challenge.md`
> for the brief. Centered on an **event / persona simulation** as the demo spine.

## Demo spine: the event/persona simulation

Pick a client → fire a trigger event → watch the whole system react live, stage
by stage. Interactive, tells a story, and naturally shows the explainability
that's worth 50% of the score (Creativity 25% + Trust/Explainability 25%).

- **Scenario picker** — the 4 built-in triggers, plus a **custom event box**
  where a judge types/pastes any headline and the system reacts to *that*. The
  custom box is the creativity unlock — live, unscripted.
  - Schneider (Balanced): pharma company shuts down her foundation's chronic-illness research.
  - Huber (Defensive): consumer-goods co. announces historic palm-oil deforestation cut-off.
  - Räber (Defensive): CIO suggests rebalancing blue chips → US AI stocks (which he hates).
  - Ammann (Growth): labour-exploitation scandal hits a portfolio consumer brand.
- **Visible stage-by-stage cascade** — News ingested → matched to holding →
  checked against Client DNA → swap proposed → message drafted. Each stage
  lights up as it runs. This *is* the traceability judges want.
- **Scripted vs. live** — open question. Hybrid is likely the sweet spot:
  bulletproof preloaded triggers for the stage + a live custom box for wow.

## Core panels

1. **Client DNA card** — parsed identity from CRM logs: core values, no-go list
   (e.g. Räber's real quote: "keep our money in established global consumer
   staples and industrials… not speculate on Silicon Valley cloud bubbles"),
   family/foundation context, communication style. Each trait shows **the
   source quote + date** it was inferred from → instant explainability.
2. **Portfolio + drift monitor** — holdings with Target vs. drifted Current, and
   a live **±2.0pp breach flag** per sub-asset class. Balanced & Growth have
   deliberate breaches baked in, so this lights up for real.
3. **Alert feed** — ranked conflicts/opportunities from profile × portfolio ×
   news. Each alert badged by type: DNA conflict · CIO SELL not yet actioned ·
   mandate-drift breach · news hit on a holding.
4. **Swap proposal (the money shot)** — before/after **diff**: "SELL X → BUY Y,
   same Industry Group, CIO-rated BUY, stays within mandate." Shows *why it's
   allowed* (CIO list constrains the universe) and *why it fits this client*
   (DNA). A reasoning-trace expander shows the constraint chain.
5. **Tailored message composer** — drafts the RM's note in the client's style
   (data-driven vs. values-led toggle), with citations back to the alert + DNA
   traits. RM edits → approves. Never auto-sends — human-in-the-loop made visible.
6. **Trust/provenance layer** — every AI claim links to its source (CRM quote,
   CIO rating + "rating since" date, news article, market data point).
   Confidence indicator + audit log of what the AI did.

## Show the multi-agent system working

- **Agent activity strip** — Orchestrator dispatching CRM Agent → Portfolio
  Agent → News Agent → Message Agent, each showing what it found. Turns the
  suggested architecture into a *visible* feature.
- **Agent handoff trace** — click an alert and replay which agent produced which fact.

## Explainability / trust features

- **"Cite or it didn't happen"** — every sentence in the draft message carries
  an inline footnote to a CRM quote, CIO rating, or news article.
- **Confidence + dissent** — weak DNA inference (one offhand comment vs.
  repeated emphasis) shows low confidence; RM confirms/rejects → feeds back.
- **Audit log** — append-only record of every AI suggestion and every RM
  decision (accept/edit/reject). Serves traceability + human control directly.
- **"Why now?" justification** — each alert explains trigger + urgency (e.g.
  "CIO SELL issued 47 days ago + today's news = act now").

## Client DNA depth

- **DNA timeline** — how identity emerged across 3 years of CRM logs, with the
  moments that defined each trait.
- **Values / knowledge graph** — entities (foundation, disease, reforestation,
  "no US tech") linked to the holdings they touch. (Noumena knowledge-graph angle.)
- **Conflict heatmap** — holdings shaded by how well they align with DNA.

## Interaction / wow hooks (pick 1–2)

- **Natural-language scenario** — "What if oil prices spike 20%?" → re-scan,
  surface affected clients.
- **Cross-client radar** — one event, *which of my clients does it touch?* Flips
  the demo from one client to a book of clients (RMs manage many).
- **Side-by-side message styles** — same recommendation rendered "data-driven &
  precise" vs. "values-led & inspiring," proving the personalization.
- **DNA-vs-CIO tension meter** — when the bank's rec conflicts with client
  values, surface the tension and let the RM mediate (on-theme: human decides).
- **Client-side preview** — toggle to see how the message lands for the client.
- **Time-machine / rating-since aging** — show how long a CIO SELL has gone
  unactioned, turning latency into visible risk.
- **"What the RM would've missed"** — counterfactual the human scanning 200
  holdings wouldn't catch.

## Feasibility-friendly niceties

- **Mandate-compliance guardrail** — proposed swap auto-checked: same sub-asset
  class, CIO BUY-rated, drift within ±2.0pp. Green/red compliance stamp.
- **"Absence is a signal"** — flag the two cantonal-bank holdings *not* covered
  by CIO research (deliberately in the data).
- **Replay / scrubber** — rewind the simulation to re-pitch on stage.

## Open questions to resolve next

- Hero panel? (Leaning: swap-proposal diff + reasoning trace — personalization
  *and* explainability in one view.)
- Scripted vs. live integrations for the stage demo?
- One persona deep, or all four? Single client, or RM's whole book?
- Stack — build on the reference `demo/` (TS/Express + SPA) or our own?
