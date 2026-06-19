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

## The RM's daily reality (not just one event)

- **Morning briefing** — RM logs in to "3 clients need attention today," ranked
  by urgency × value-at-stake. The simulation is one event; this is the
  *standing* product an RM would open every morning. Strong feasibility story.
- **Action queue with SLAs** — each alert has an age and a suggested deadline. A
  CIO SELL sitting 47 days unactioned screams from the top.
- **"Done" satisfaction loop** — RM acts → alert clears → portfolio drift visibly
  re-centers. Proves the system *resolves* things, not just flags them.

## Quantify the value (judges love a number)

- **Value-at-stake per alert** — "CHF 92k exposed to this scandal." Makes
  abstract conflicts concrete.
- **Drift cost** — how far off-mandate, in CHF, and the tracking-error implication.
- **"Time saved" meter** — manual = scan 200 holdings × news; AI = surfaced in
  seconds. A single before/after stat lands hard in a pitch.

## Cold-start / onboarding angle

- **DNA from scratch** — drop in a new client's first CRM notes and watch the DNA
  card populate. Shows the parsing isn't hard-coded to the 4 personas — big
  credibility boost if a judge is skeptical.
- **DNA confidence growing over time** — slider over the 3-year log; traits
  sharpen as evidence accumulates.

## Trust-oriented visual identity (Visual Design = 15%)

- **Calm, private-bank aesthetic** — muted, serif-ish, lots of whitespace; not a
  flashy SaaS dashboard. Signals "this is for wealth, not crypto."
- **AI vs. human color language** — AI suggestions in one consistent treatment,
  RM/confirmed actions in another. You always know who said what — that *is*
  trust UI.
- **Provenance on hover everywhere** — never a naked claim; the whole UI teaches
  "you can check this."

## Sophistication / edge cases that impress

- **Conflicting signals** — CIO says BUY, client DNA says no (Räber + US AI).
  Don't auto-resolve — *escalate the tension to the RM*. The single most
  on-theme moment in the brief ("RM stays in the loop, client decides").
- **No good swap exists** — sometimes the same-sector CIO BUY list is empty;
  system says "no compliant swap — flag for review" instead of inventing one.
  Knowing its limits = trustworthy.
- **Bond/illiquid handling** — gracefully degrade to par-pricing when SIX history
  is thin (the data warns about this). Shows we read the fine print.

## Conversational / explanation layer

- **"Ask why" on any element** — click a recommendation, ask "why this one?", get
  a grounded answer citing DNA + CIO + news. Conversational *on top of*
  structure, not instead of it.
- **RM coaching the AI** — RM corrects a DNA trait; system acknowledges and
  re-reasons. Two-way, not a vending machine.

## Demo-narrative devices

- **Split-screen "old world vs. new world"** — left: RM drowning in spreadsheets
  + 200 holdings; right: our surfaced insight. Frames the problem in 5 seconds.
- **One persona as the through-line** — Schneider's foundation story is the most
  emotional (research for a disease her family cares about gets shut down). Lead
  the pitch with the human stakes, then show the machinery.

## Converged synthesis (two-agent cross-critique)

Ran two independent sub-agents — a *pragmatic engineer* (feasibility lens) and a
*creative/design visionary* (the 50% Creativity + Trust lens) — then had each
critique and revise against the other. They converged on one design:

**Thesis:** A's deterministic rails aren't a constraint on the wow — they *are*
the trust story, made visible and interrogable. Manipulation = navigating
precomputed states, not live recompute. The judge never knows the difference and
nothing can break on stage.

**The merged MVP**
- **One persona polished (Schneider), four supported in data.** Schneider's
  buried neuroscience-research thread (repeated across CRM notes 2024-05 → 2025-06)
  is the most emotionally resonant and is genuinely in the data. Swap universe is
  real: Novartis/Roche are CIO-BUY in Health Care.
- **Deterministic engine** — frozen DNA traits, ±2.0pp drift flags, rule-based
  alert match, swap constrained to `cio_recommendation_list.csv`. Everything emits
  a **trace object** `{claim, evidence[], confidence, source}`. The UI is a renderer
  of traces → explainability is architectural, not cosmetic.
- **Exactly ONE live LLM call:** the two-voice message draft (data-driven vs.
  values-led), with a per-persona cached fallback. DNA extraction is run **once,
  offline, frozen to JSON** (real LLM use, zero stage risk).
- **The hero — "The Glass Thread":** a provenance graph (CRM note → DNA trait →
  holding → news event → swap), **pre-laid-out and animate-on-replay** — NOT a
  live force-directed/recomputing graph (that's the #1 cut).

**The hero moment to stake the pitch on — "Cut the thread":**
The thread connects Schneider's buried CRM quote → DNA trait → pharma holding →
"research shut down" news → proposed same-sector CIO-BUY swap. Presenter says
"what if I don't buy that this note reflects his values?" and **cuts the evidence
node**. Instantly (precomputed alternate state): confidence bar drops, evidence
chips grey out, alert downgrades act→watch, swap rationale rewrites to a hedged
form, and the **Override Ledger** logs it. Punchline: *"The AI didn't argue. It
showed its work, took my correction, and changed its mind — on the record."*
Scores all four soft criteria at once (Creativity, Trust, Visual, Presentation).

**Build (ranked, S/M/L):**
1. Deterministic match + swap engine + trace objects — **M** (the spine)
2. Static provenance graph, clickable highlight + one cut-node branch — **M** (hero)
3. **Override Ledger** (append-only accept/edit/reject) — **S** (highest trust-per-hour)
4. Evidence Receipt chip component (reused everywhere) — **S**
5. Live two-voice message draft + cached fallback — **M** (the one live call)
6. Frozen DNA extraction (run once, commit JSON) — **S**
7. Conflict-vs-Mandate split meter — **S**

**Stretch (only if core solid Sat night):** counterfactual "why not this one?"
(folds into the cut-node alternate state for free); single-node toggle feel.

**Cut (do not build):** manipulable/recomputing force-directed graph; confidence-
gated autonomy lanes; time-scrub timeline; live multi-agent orchestrator (produce
traces deterministically instead); bespoke gene-viz / heavy motion.

**⚠️ Factual finding both agents flagged:** the reference `demo/` starter is **NOT
in our repo** — it lives in the upstream challenge repo. Wiring it (clone, `.env`
for Phoeniqs/SIX/Event Registry, green health check) is ~2–4h of real Phase-0 work
that earlier notes silently assumed away.

**Rough 48h arc (4 people):** Phase 0 (h0–6) wire starter + keys + pin Schneider's
thread; Phase 1 (h6–18) deterministic spine + frozen DNA + render linear flow;
Phase 2 (h18–32) provenance graph + Override Ledger + live message — *feature-freeze
candidate*; Phase 3 (h32–42) load other 3 personas in data + one stretch + polish;
Phase 4 (h42–48) .pptx + pitch coaching + cached-everything dry run. Rules:
feature-freeze h32, hard stop on new features h44, every live call has a cached
fallback, SIX MCP optional-not-blocking.

## Open questions to resolve next

The synthesis above answers most of the earlier opens (hero = Glass Thread;
deterministic + 1 live call; one persona polished + 4 in data; build on `demo/`).
Still to decide with the team:

- Do we commit to "Cut the thread" as the staked hero moment, or keep the safer
  linear walkthrough as the centerpiece?
- Graph rendering: hand-placed layout vs. pre-solved D3 force frozen to JSON?
- Is SIX live market-data enrichment worth any Phase-3 time, or fully cached?
- Who owns which lane (BE engine / LLM+wiring / FE graph / design+pitch)?
