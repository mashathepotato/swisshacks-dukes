# Challenge — The Next Generation of Wealth Advisory

**Hosts:** SIX · Noumena Digital · NTT DATA
**Event:** SwissHacks, Zurich, 19–21 June 2026 (48-hour build)
**Source:** https://github.com/SwissHacks-2026/SIX-Noumena-NTT-Data

## The problem

Hyper-personalised wealth advice is today only available to a handful of
ultra-high-net-worth clients, because tailoring proposals, monitoring news
across every holding, and drafting individual narratives takes more time than
any relationship manager (RM) has. AI can scale that level of care to every
client — 24/7 — while the RM stays in the loop and the client always decides.

## What we build

A **next-generation advisor dashboard**: one place where an RM can understand a
client's investment identity, monitor their portfolio against live news + CIO
signals, and act on the right insight at the right time.

**Core insight:** the investment *strategy* stays unchanged. Personalisation
happens at the **asset level** — within a client's mandate (Defensive / Balanced
/ Growth), AI flags holdings that conflict with the client's personal "DNA" and
proposes a replacement **from the same sector** that fits both the strategy and
the client. The **CIO recommendation list constrains the swap universe**.

### Four steps / capabilities

1. **Build the Client DNA** — parse raw CRM conversation logs into each client's
   investment identity: values, business context, family, personal priorities.
2. **Connect to Portfolio & News** — link the profile to current holdings and a
   live news feed.
3. **Surface Relevant Alerts** — match profile × portfolio × incoming news to
   flag conflicts or opportunities.
4. **Generate a Tailored Message** — draft the RM's advisory note in the
   client's preferred style (data-driven & precise, or values-led & inspiring).

**Human in the loop (non-negotiable):** AI equips the RM with insights and draft
proposals. It **never advises the client directly**. RM recommends → client
decides and places the orders.

**Suggested architecture (optional):** multi-agent — orchestrator coordinating a
CRM Agent, Portfolio Agent, News Agent, and Message Agent, feeding a dashboard.
Teams are free to innovate.

## Client personas (4 — each with a trigger event)

| Persona | Profile | Strategy | Trigger |
|---|---|---|---|
| **Schneider** — Personal Connection | Emotional, purpose-driven; family foundation funds a specific chronic-illness research field | Balanced | Pharma company shuts down research for that disease |
| **Huber** — Purpose-Driven Investor | Environmentalist financing South American reforestation; holds consumer staples | Defensive | Consumer goods co. announces historic palm-oil deforestation cut-off |
| **Räber** — Defensive Value Investor | Conservative Swiss couple; precision-engineering background; averse to US tech | Defensive | CIO suggests rebalancing blue chips → US AI stocks |
| **Ammann** — Corporate Reputation | Prominent Swiss entrepreneur; reputational risk = financial risk | Growth | Labour-exploitation scandal hits a portfolio consumer brand |

## Provided data & tech

- **SIX Financial Information** — MCP server (streamable-http, bearer token) + Web
  API (REST/JSON, cert auth). Market/financial data: real-time & historical
  prices, macro indicators, fundamentals. 23 MCP tools (6 outside the hackathon
  token). Positions carry Valor + MIC (`{Valor}_{MIC}` for listing tools; Valor
  alone for instrument tools; ISIN for bonds). See `docs/SIX_MCP.md`.
- **Event Registry / Tenity MCP-News server** — live news + sentiment.
  https://newsapi.ai/ (Yahoo Finance & Google News also work).
- **LLM credits via Phoeniqs** — no need to bring your own key.
  https://console.phoeniqs.com/ — setup in `docs/Phoeniqs_AI.md`.
- **Noumena Digital** — domain models, knowledge graphs, AI-ready financial
  abstractions (Azure-based Noumena Cloud).
- **NTT DATA** — reference architectures; Azure OpenAI patterns for explainable
  AI, RAG, multi-agent decision support.
- **Datasets** (`data/`):
  - `SwissHacks CRM.xlsx` — 3-year RM interaction logs, one tab per client
    (Räber, Schneider, Huber, Ammann).
  - `SwissHacks Portfolio Construction.xlsx` — 3 mandates (Defensive/Balanced/
    Growth, each CHF 10M): CIO sub-asset-class targets, current vs. drifted
    market values, CIO recommendation list (BUY/HOLD/SELL + swap candidates),
    3-yr transactions, cash flows. Balanced & Growth have deliberate mandate-drift
    breaches (±2.0pp rule). Includes SIX (Valor+MIC) and Yahoo tickers.
  - Data conventions: amounts in CHF; ISINs per ISO 6166; equities at historical
    closes, bonds at par; bond qty = face value ÷ 100; position = Σ(BUY − SELL).
    `Current (CHF)` ≈ 10 days post-April-2026 rebalance; `Target (CHF)` sums to
    CHF 10M.

### Reference demo (`demo/`)
Runnable TypeScript/Express + SPA starter wiring **Phoeniqs LLM + SIX MCP +
Event Registry** end to end. Endpoints: `POST /api/analysis/analyze`,
`GET /api/analysis/integrations` (health check). Setup: copy `.env.example` →
`.env`, fill keys; `cd demo && npm install && npm run dev` → http://localhost:3000.

## Deliverables

- End-to-end clickable prototype / working front-end.
- Minimal back-end or agent flow demonstrating personalisation + reasoning.
- Short demo story: RM understands a client change → explains it → decides next
  best action.
- **Presentation (.pptx):** problem & solution, in-slide demo, core features,
  user journey.
- **Submit code** + a 5-min MCP feedback form (one per team):
  https://forms.office.com/e/tX2cH5n9Yi

## Judging criteria

| Criterion | What it measures | Weight |
|---|---|---|
| Creativity | Novel human–AI interaction, beyond standard chatbots | 25% |
| Trust & Explainability | Transparency, traceability, human control | 25% |
| Feasibility | Technical realism, architectural soundness | 20% |
| Visual Design | Clarity, usability, trust-oriented UI | 15% |
| Presentation Quality | Clear, convincing storytelling | 15% |

> Creativity + Trust/Explainability = **50%** of the score. Lean into a
> transparent, traceable, human-in-the-loop experience.

## Key contacts

- **SIX MCP:** Ramiro Lopez Cento — ramiro.lopez@six-group.com
- **SIX Web API + MCP:** Laurent Lefevre — laurent.lefevre@six-group.com
- **Tech / LLM (Phoeniqs):** Stefan Taroni — stefan.taroni@phoenix-technologies.ch
- **Wealth Mgmt / Personas:** Thomas Geiger (NTT DATA), Sandra Daub (Noumena)
- **Pitch training:** Magdalena Tuta (SIX booth) — coaching Sat for Sun eval.

## Prize

Top two teams pitch to SIX Management + goodie bags. All hackers can book private
pitch coaching (Saturday).
