# Project — Priori

A next-generation **wealth-advisory copilot** for SwissHacks 2026 (SIX · Noumena
· NTT DATA challenge — see `challenge.md`).

## One-liner

A relationship-manager cockpit that turns each client's CRM history into a living
**Client DNA**, watches their portfolio against live news + the CIO list, and
surfaces the right insight — with a fully traceable "why" — so the RM can act
while the client always decides.

## Problem

Hyper-personalised advice today only reaches a handful of UHNW clients: tailoring
proposals, monitoring news across every holding, and drafting individual
narratives takes more time than any RM has. We scale that care to every client
24/7 while keeping the RM in the loop.

## Solution

The strategy (Defensive / Balanced / Growth mandate) stays fixed; personalisation
happens at the **asset level**, constrained by the CIO recommendation list. The
copilot:

1. **Builds Client DNA** from CRM conversation logs (values, dislikes, value
   affinities, comm style).
2. **Connects portfolio + live news** — matches DNA × holdings × incoming news.
3. **Surfaces ranked alerts** as a priority queue, each backed by a **Glass
   Thread**: a deterministic DNA → holding → news → conflict → relationship →
   score chain with verbatim "source receipts."
4. **Drafts a tailored message** in the RM's house style and the client's
   preferred voice (data-driven or values-led) and channel.

**Human-in-the-loop is non-negotiable:** the AI equips the RM; it never advises
the client. RM recommends → client decides.

## Differentiators (lean into Creativity + Trust/Explainability = 50% of score)

- **Glass Thread** — every priority score expands into its reasoning chain and
  the exact CRM note / news snippet / CIO instruction that justifies each step.
- **Client-twin simulator (Rehearse)** — predict a client's reaction, objections,
  and a trust/alignment trajectory *before* sending a proposal.
- **Learning loop** — RM accept / tweak / decline feedback nudges a per-client
  preference model (value affinities + preferred voice).
- **Voice Conversation Capture** *(active branch)* — record a *consented* client
  call, transcribe it live, and distill it into a reviewed CRM note + Client-DNA
  deltas with verbatim quote receipts — the upstream source of the CRM logs.
- **Compliance Desk** — live mandate-drift (±2.0pp) check + CIO-constrained,
  explainable swap proposals.

## Scope

### MVP (must demo)

- [x] Priority queue of ranked clients with signal + recommendation.
- [x] Client detail / full client page with Value Radar (DNA) + Glass Thread.
- [x] News feed → news-impact map (which clients a story reaches and why).
- [x] Rehearse simulator (predicted reaction + trajectory).
- [x] Tailored draft message in RM house style + client voice/channel.
- [x] Compliance Desk: drift + CIO-constrained swap.
- [ ] Voice Conversation Capture → reviewed note + DNA deltas (in progress).

### Stretch

- Re-run alerts / recompute priority after a captured conversation merges DNA.
- Live SIX MCP prices + live Event Registry news in the dashboard (today the
  dashboard runs on deterministic mock data; the `news-test/` pipeline proves the
  live-news seam separately).
- Persist approved changes back to the source CRM data.

### Out of scope

- Storing real audio, speaker diarization, multi-language transcription.
- Writing back to the source `*.xlsx` workbooks.
- The AI ever messaging the client directly.

## Demo story

RM opens the priority queue → Ammann is top, flagged by a labour-exploitation
scandal touching a held consumer brand. The Glass Thread shows *why* (CRM:
"reputation is my business" → the holding → the news → the conflict → relationship
sensitivity → score). RM opens Rehearse to test a discreet, brief call framing,
sees the predicted reaction and trajectory, edits the draft note in their house
style, and approves. Separately: RM records a consented lunch with a client, and
the captured conversation distills into a CRM note + DNA updates the RM reviews
and merges — closing the loop back to step 1.
