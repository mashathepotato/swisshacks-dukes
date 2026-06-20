import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { ADVICE, adviceFit } from "../data/bookSim";
import { simulateProposal } from "../data/simulate";
import { PORTFOLIOS, CIO, STRATEGIES } from "../data/portfolio";
import { PERSONA_PLAY, proposeSwap, simulateSwap, estimateImpact } from "../lib/portfolio";
import { formatMoney } from "../lib/format";

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
  // For aversion personas, "follow the CIO's cross-sector rotation" is a real,
  // checkable trade — usually a poor fit, which the impact + compliance reveal.
  if (play?.aversionTerms?.length) {
    const held = new Set(PORTFOLIOS[play.mandate].map((h) => h.isin));
    const pushed = CIO.find((c) => c.rating === "BUY" && play.aversionTerms!.some((t) => c.industryGroup.toLowerCase().includes(t)) && !held.has(c.isin));
    const sell = PORTFOLIOS[play.mandate].find((h) => h.isin === play.sellIsin);
    if (pushed && sell)
      list.push({
        key: "cio-rotation",
        kind: "swap",
        label: `Follow CIO: ${sell.issuer} → ${pushed.issuer}`,
        detail: `Trim ${sell.issuer} and rotate into ${pushed.issuer} per the CIO tactical-allocation signal.`,
        trade: { sellIsin: play.sellIsin, buyIsin: pushed.isin },
      });
  }
  client.recommendations.forEach((r) => list.push({ key: `rec:${r.id}`, kind: "rec", label: r.action, detail: r.rationale }));
  ADVICE.forEach((a) => list.push({ key: `preset:${a.id}`, kind: "preset", label: a.label, detail: a.detail, fit: adviceFit(client, a) }));
  return list;
}

export function RehearseOutcome() {
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

  const impact = useMemo(() => {
    const severity = client.signals[0]?.severity ?? 55;
    let exposure: number;
    let mode: "protect" | "risk-on" | "neutral";
    let hasTrade = false;
    if (compliance) {
      exposure = compliance.amountCHF;
      hasTrade = true;
      mode = compliance.dna.verdict === "conflicts" ? "risk-on" : "protect";
    } else if (sel.kind === "rec") {
      exposure = client.amountAtStake ?? 0;
      mode = "protect";
    } else {
      exposure = client.amountAtStake ?? 0;
      mode = (sel.fit ?? 0) > 0.15 ? "protect" : (sel.fit ?? 0) < -0.15 ? "risk-on" : "neutral";
    }
    return estimateImpact({ exposureCHF: exposure, mode, severity, hasTrade });
  }, [client, sel, compliance]);

  function pickClient(id: string) {
    setClientId(id);
    setAdviceKey(adviceFor(CLIENTS.find((c) => c.id === id)!)[0].key);
  }

  const acc = Math.round(reaction.acceptanceProbability * 100);
  const accColor = reaction.acceptanceProbability > 0.6 ? "var(--green)" : reaction.acceptanceProbability > 0.4 ? "var(--amber)" : "var(--red)";

  return (
    <div className="booksim">
      <div className="bs-head" style={{ paddingBottom: 16 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>Rehearse outcome</h1>
        <p className="lead" style={{ margin: 0 }}>Pick a client and an action to see predicted reaction, estimated CHF impact, and mandate compliance.</p>
      </div>

      <div className="ro-clients" style={{ marginBottom: 12 }}>
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
          <div className="ro-accept" style={{ marginBottom: 6 }}>
            <span className="pct" style={{ color: accColor }}>{acc}%</span>
            <span className="lbl" style={{ marginLeft: 8 }}>likely acceptance · {client.name}</span>
          </div>
          <div className="bar" style={{ maxWidth: 280, marginBottom: 10 }}>
            <div style={{ width: `${acc}%`, background: accColor }} />
          </div>
          <p className="ro-react" style={{ marginBottom: 16 }}>{reaction.predictedReaction}</p>

          <div className="ro-block">
            <div className="lbl" style={{ marginBottom: 6 }}>Estimated monetary impact · next {impact.horizonMonths} months</div>
            {impact.components.length ? (
              <>
                <div className="impact-net" style={{ color: impact.netCHF >= 0 ? "var(--green)" : "var(--red)" }}>
                  {impact.netCHF >= 0 ? "+" : "−"}{formatMoney(Math.abs(impact.netCHF))}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 12px" }}>
                  net {impact.netCHF >= 0 ? "benefit" : "cost"} to {client.name} from following this advice.
                </p>
                {impact.components.map((c, i) => {
                  const pos = c.amountCHF >= 0;
                  const mag = Math.max(...impact.components.map((x) => Math.abs(x.amountCHF)));
                  return (
                    <div className="impact-comp" key={i}>
                      <div className="ic-top">
                        <span>{c.label}</span>
                        <span className={"amt " + (pos ? "pos" : "neg")}>{pos ? "+" : "−"}{formatMoney(Math.abs(c.amountCHF))}</span>
                      </div>
                      <div className="ic-bar" style={{ width: `${mag ? Math.max(6, (Math.abs(c.amountCHF) / mag) * 100) : 0}%`, background: pos ? "var(--green)" : "var(--red)" }} />
                      <div className="ic-note">{c.note}</div>
                    </div>
                  );
                })}
                <p className="impact-assump">
                  An estimate, not a guarantee — each figure is the real position value × a stated assumption (severity→drawdown, 0.20% transaction cost, 1.5% CIO-BUY premium), so it's fully traceable rather than a black-box forecast.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No quantified monetary exposure to model for this advice on {client.name}.</p>
            )}
          </div>

          <div className="ro-block" style={{ marginTop: 12 }}>
            <div className="lbl" style={{ marginBottom: 4 }}>Likely objections</div>
            {reaction.objections.map((o, i) => <p key={i} style={{ margin: "2px 0" }}>• {o}</p>)}
          </div>
          <div className="ro-block" style={{ marginTop: 12 }}>
            <div className="lbl" style={{ marginBottom: 4 }}>Best framing</div>
            <p style={{ margin: 0 }}>{reaction.bestFraming}</p>
          </div>
          <div className="ro-block" style={{ marginTop: 12 }}>
            <div className="lbl" style={{ marginBottom: 4 }}>Suggested next step</div>
            <p className="strong" style={{ margin: 0 }}>{reaction.nextStep}</p>
          </div>
        </div>

        <div className="bs-side">
          <div className="lbl" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-faint)", marginBottom: 12, fontWeight: 600 }}>
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

