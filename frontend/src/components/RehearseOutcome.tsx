import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { ADVICE, adviceFit } from "../data/bookSim";
import { simulateProposal } from "../data/simulate";
import { PORTFOLIOS, CIO, STRATEGIES } from "../data/portfolio";
import { PERSONA_PLAY, proposeSwap, simulateSwap } from "../lib/portfolio";
import { formatMoney } from "../lib/format";
import { TrajectoryChart } from "./TrajectoryChart";
import { BookSimulator } from "./BookSimulator";

type AdviceKind = "swap" | "rec" | "preset";
interface RAdvice {
  key: string;
  kind: AdviceKind;
  label: string;
  detail: string;
  fit?: number; // preset value-fit, -1..1
  trade?: { sellIsin: string; buyIsin: string };
}

const KIND_LABEL: Record<AdviceKind, string> = { swap: "Recommended swap", rec: "Copilot rec", preset: "Strategy" };

function adviceFor(client: Client): RAdvice[] {
  const list: RAdvice[] = [];
  const play = PERSONA_PLAY[client.id];
  if (play?.resolvesConflict) {
    const rec = proposeSwap(play.sellIsin, PORTFOLIOS[play.mandate], CIO);
    if (rec.chosen)
      list.push({
        key: "swap",
        kind: "swap",
        label: `Swap ${rec.sell.issuer} → ${rec.chosen.issuer}`,
        detail: `Exit ${rec.sell.issuer} and rotate into ${rec.chosen.issuer}, a CIO-BUY in the same sector.`,
        trade: { sellIsin: play.sellIsin, buyIsin: rec.chosen.isin },
      });
  }
  client.recommendations.forEach((r) => list.push({ key: `rec:${r.id}`, kind: "rec", label: r.action, detail: r.rationale }));
  ADVICE.forEach((a) => list.push({ key: `preset:${a.id}`, kind: "preset", label: a.label, detail: a.detail, fit: adviceFit(client, a) }));
  return list;
}

export function RehearseOutcome() {
  const [mode, setMode] = useState<"client" | "book">("client");
  const personas = CLIENTS.filter((c) => c.isPersona);
  const [clientId, setClientId] = useState(personas[0].id);
  const client = CLIENTS.find((c) => c.id === clientId)!;

  const advice = useMemo(() => adviceFor(client), [client]);
  const [adviceKey, setAdviceKey] = useState(advice[0].key);
  const sel = advice.find((a) => a.key === adviceKey) ?? advice[0];

  const reaction = useMemo(() => simulateProposal(client, sel.detail), [client, sel]);
  const play = PERSONA_PLAY[client.id];
  const compliance = useMemo(
    () =>
      sel.trade && play
        ? simulateSwap({
            holdings: PORTFOLIOS[play.mandate], strategies: STRATEGIES, cio: CIO, mandate: play.mandate,
            sellIsin: sel.trade.sellIsin, buyIsin: sel.trade.buyIsin,
            aversionTerms: play.aversionTerms, sellResolvesConflict: play.resolvesConflict,
          })
        : null,
    [sel, play]
  );

  function pickClient(id: string) {
    setClientId(id);
    setAdviceKey(adviceFor(CLIENTS.find((c) => c.id === id)!)[0].key);
  }

  if (mode === "book") {
    return (
      <div className="booksim">
        <div className="bs-head">
          <div className="head-row">
            <div>
              <h1>Whole-book view — if the entire book follows one broadcast advice</h1>
              <p className="lead">The case for personalisation: one message fits some clients and not others.</p>
            </div>
            <button className="bs-toggle" onClick={() => setMode("client")}>← Rehearse one client</button>
          </div>
        </div>
        <BookSimulator />
      </div>
    );
  }

  const acc = Math.round(reaction.acceptanceProbability * 100);
  const accColor = reaction.acceptanceProbability > 0.6 ? "var(--green)" : reaction.acceptanceProbability > 0.4 ? "var(--amber)" : "var(--red)";

  return (
    <div className="booksim">
      <div className="bs-head">
        <div className="head-row">
          <div>
            <h1>Rehearse the outcome — simulate a client following a piece of advice</h1>
            <p className="lead">Pick a client and an action, then see how they'd likely react, how the relationship would trend, and whether the trade keeps their mandate.</p>
          </div>
          <button className="bs-toggle" onClick={() => setMode("book")}>Whole-book view →</button>
        </div>
      </div>

      <div className="ro-clients">
        {CLIENTS.map((c) => (
          <button key={c.id} className={"pick" + (c.id === clientId ? " on" : "")} onClick={() => pickClient(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="bs-advice">
        {advice.map((a) => (
          <button key={a.key} className={"adv" + (a.key === adviceKey ? " on" : "")} onClick={() => setAdviceKey(a.key)} title={a.detail}>
            <span className="k">{KIND_LABEL[a.kind]}</span>{a.label}
          </button>
        ))}
      </div>

      <div className="bs-body">
        <div className="bs-main">
          <div className="ro-accept">
            <span className="pct" style={{ color: accColor }}>{acc}%</span>
            <span className="lbl">likely acceptance · {client.name}</span>
          </div>
          <div className="bar" style={{ maxWidth: 320 }}>
            <div style={{ width: `${acc}%`, background: accColor }} />
          </div>
          <p className="ro-react">{reaction.predictedReaction}</p>

          <div className="ro-block ro-traj">
            <div className="lbl">Relationship trajectory if they follow it</div>
            <TrajectoryChart points={reaction.trajectory} />
            <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 12, marginTop: 2 }}>
              <span style={{ color: "#4f8ff7" }}>— Trust</span>
              <span style={{ color: "#805ad5" }}>-- Values alignment</span>
            </div>
          </div>

          <div className="ro-block">
            <div className="lbl">Likely objections</div>
            {reaction.objections.map((o, i) => <p key={i}>• {o}</p>)}
          </div>
          <div className="ro-block">
            <div className="lbl">Best framing</div>
            <p>{reaction.bestFraming}</p>
          </div>
          <div className="ro-block">
            <div className="lbl">Suggested next step</div>
            <p className="strong">{reaction.nextStep}</p>
          </div>
        </div>

        <div className="bs-side">
          <div className="lbl" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--text-faint)", marginBottom: 10 }}>
            Portfolio &amp; compliance
          </div>
          {compliance ? (
            <>
              <div className={"verdict " + (compliance.compliant ? "ok" : "no")}>
                {compliance.compliant ? "✓ Mandate-compliant" : "✗ Not mandate-compliant"}
              </div>
              <div className="stamp"><span className={"mk " + (compliance.sameSector ? "y" : "n")}>{compliance.sameSector ? "✓" : "✗"}</span> Same sector{compliance.buy.industryGroup ? ` (${compliance.buy.industryGroup})` : ""}</div>
              <div className="stamp"><span className={"mk " + (compliance.buyRatingOk ? "y" : "n")}>{compliance.buyRatingOk ? "✓" : "✗"}</span> Buy is CIO-rated BUY</div>
              <div className="stamp"><span className={"mk " + (compliance.newBreaches.length === 0 ? "y" : "n")}>{compliance.newBreaches.length === 0 ? "✓" : "✗"}</span> No new ±2.0pp drift breach</div>
              <div className="cdesk-moved"><b>{formatMoney(compliance.amountCHF)}</b> moves from {compliance.sell.issuer} to {compliance.buy.issuer}.</div>
              <div className={"dverdict " + compliance.dna.verdict}><b>Client values: {compliance.dna.verdict}</b> — {compliance.dna.reason}</div>
            </>
          ) : (
            <>
              {sel.kind === "preset" && sel.fit != null ? (
                <div className={"dverdict " + (sel.fit > 0.15 ? "honors" : sel.fit < -0.15 ? "conflicts" : "neutral")}>
                  <b>Value fit: {sel.fit > 0.15 ? "strong" : sel.fit < -0.15 ? "misfit" : "neutral"}</b> — {sel.fit > 0.15 ? "this broadcast strategy aligns with the client's values." : sel.fit < -0.15 ? "this broadcast strategy cuts against the client's stated values." : "this strategy is roughly value-neutral for the client."}
                </div>
              ) : (
                <p className="ro-block" style={{ marginTop: 0 }}>No single instrument trade to check for this advice — it's a {sel.kind === "preset" ? "broadcast strategy" : "qualitative recommendation"}.</p>
              )}
              <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 12, lineHeight: 1.5 }}>
                Pick the <b>Recommended swap</b> for this client to see the full mandate &amp; CIO compliance check.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
