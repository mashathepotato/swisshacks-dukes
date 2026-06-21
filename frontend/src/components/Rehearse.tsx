import { useEffect, useMemo, useRef, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client, SimulationResult } from "../types";
import { ADVICE, adviceFit } from "../data/bookSim";
import { simulateProposal } from "../data/simulate";
import { PORTFOLIOS, CIO, STRATEGIES } from "../data/portfolio";
import { PERSONA_PLAY, proposeSwap, simulateSwap, estimateImpact } from "../lib/portfolio";
import type { MonetaryImpact, SimResult } from "../lib/portfolio";
import { formatMoney } from "../lib/format";

type AdviceKind = "swap" | "rec" | "preset";
interface RAdvice {
  key: string;
  kind: AdviceKind;
  label: string;
  detail: string;
  fit?: number;
  trade?: { sellIsin: string; buyIsin: string };
}

function adviceFor(client: Client): RAdvice[] {
  const list: RAdvice[] = [];
  const play = PERSONA_PLAY[client.id];
  if (play?.resolvesConflict) {
    const rec = proposeSwap(play.sellIsin, PORTFOLIOS[play.mandate], CIO);
    if (rec.chosen)
      list.push({ key: "swap", kind: "swap", label: `Swap ${rec.sell.issuer} → ${rec.chosen.issuer}`, detail: `Exit ${rec.sell.issuer} and rotate into ${rec.chosen.issuer}, a CIO-BUY in the same sector.`, trade: { sellIsin: play.sellIsin, buyIsin: rec.chosen.isin } });
  }
  if (play?.aversionTerms?.length) {
    const held = new Set(PORTFOLIOS[play.mandate].map((h) => h.isin));
    const pushed = CIO.find((c) => c.rating === "BUY" && play.aversionTerms!.some((t) => c.industryGroup.toLowerCase().includes(t)) && !held.has(c.isin));
    const sell = PORTFOLIOS[play.mandate].find((h) => h.isin === play.sellIsin);
    if (pushed && sell)
      list.push({ key: "cio-rotation", kind: "swap", label: `Follow CIO: ${sell.issuer} → ${pushed.issuer}`, detail: `Trim ${sell.issuer} and rotate into ${pushed.issuer} per the CIO tactical-allocation signal.`, trade: { sellIsin: play.sellIsin, buyIsin: pushed.isin } });
  }
  client.recommendations.forEach((r) => list.push({ key: `rec:${r.id}`, kind: "rec", label: r.action, detail: r.rationale }));
  ADVICE.forEach((a) => list.push({ key: `preset:${a.id}`, kind: "preset", label: a.label, detail: a.detail, fit: adviceFit(client, a) }));
  return list;
}

/** Reaction + monetary impact + compliance for an advice OR a free-text proposal. */
function computeOutcome(client: Client, advice: RAdvice | null, text: string | null): { compliance: SimResult | null; impact: MonetaryImpact } {
  const play = PERSONA_PLAY[client.id];
  const severity = client.signals[0]?.severity ?? 55;

  let trade = advice?.trade;
  if (!trade && text && play) {
    const p = text.toLowerCase();
    const mentions = (...kw: string[]) => kw.some((k) => p.includes(k));
    const isReduce = mentions("reduce", "cut", "trim", "exit", "sell", "divest", "drop", "dump", "get out", "rotate out");
    const isTechAdd = mentions("nvidia", "ai", "tech", "semiconductor", "microsoft", "apple", "us equit", "us ai") && mentions("increase", "add", "buy", "overweight", "more", "allocate", "capture", "momentum");
    const followCio = mentions("follow cio", "rotation", "rotate into", "mega-cap", "tactical");
    const averse = (play.aversionTerms?.length ?? 0) > 0;
    if (averse && (isTechAdd || followCio)) {
      const held = new Set(PORTFOLIOS[play.mandate].map((h) => h.isin));
      const pushed = CIO.find((c) => c.rating === "BUY" && play.aversionTerms!.some((t) => c.industryGroup.toLowerCase().includes(t)) && !held.has(c.isin));
      if (pushed) trade = { sellIsin: play.sellIsin, buyIsin: pushed.isin };
    } else if (isReduce || play.resolvesConflict) {
      const chosen = proposeSwap(play.sellIsin, PORTFOLIOS[play.mandate], CIO).chosen;
      if (chosen) trade = { sellIsin: play.sellIsin, buyIsin: chosen.isin };
    }
  }

  const compliance = trade && play
    ? simulateSwap({ holdings: PORTFOLIOS[play.mandate], strategies: STRATEGIES, cio: CIO, mandate: play.mandate, sellIsin: trade.sellIsin, buyIsin: trade.buyIsin, aversionTerms: play.aversionTerms, sellResolvesConflict: play.resolvesConflict })
    : null;

  let exposure: number;
  let mode: "protect" | "risk-on" | "neutral";
  let hasTrade = false;
  if (compliance) {
    exposure = compliance.amountCHF;
    hasTrade = true;
    mode = compliance.dna.verdict === "conflicts" ? "risk-on" : "protect";
  } else if (advice?.kind === "preset") {
    exposure = client.amountAtStake ?? 0;
    mode = (advice.fit ?? 0) > 0.15 ? "protect" : (advice.fit ?? 0) < -0.15 ? "risk-on" : "neutral";
  } else if (advice?.kind === "rec") {
    exposure = client.amountAtStake ?? 0;
    mode = "protect";
  } else {
    exposure = client.amountAtStake ?? 0;
    const p = (text ?? "").toLowerCase();
    mode = ["reduce", "cut", "trim", "exit", "sell", "divest", "drop", "dump"].some((k) => p.includes(k)) ? "protect" : "neutral";
  }

  return { compliance, impact: estimateImpact({ exposureCHF: exposure, mode, severity, hasTrade }) };
}

interface Props { focusClientId: string | null; }

export function Rehearse({ focusClientId }: Props) {
  const personas = CLIENTS.filter((c) => c.isPersona);
  const [clientId, setClientId] = useState(focusClientId ?? personas[0].id);
  const client = CLIENTS.find((c) => c.id === clientId)!;

  const advice = useMemo(() => adviceFor(client), [client]);
  const [adviceKey, setAdviceKey] = useState<string | null>(advice[0]?.key ?? null);
  const [text, setText] = useState("");   // submitted free-text proposal
  const [input, setInput] = useState(""); // composer field

  useEffect(() => {
    // the client is chosen from the nav dropdown now — sync and reset the proposal
    if (!focusClientId) return;
    const next = adviceFor(CLIENTS.find((c) => c.id === focusClientId)!);
    /* eslint-disable react-hooks/set-state-in-effect */
    setClientId(focusClientId);
    setAdviceKey(next[0]?.key ?? null);
    setText("");
    setInput("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [focusClientId]);

  const usingText = adviceKey === null;
  const sel = usingText ? null : advice.find((a) => a.key === adviceKey) ?? advice[0] ?? null;
  const proposalText = usingText ? text : (sel?.detail ?? "");

  // Instant deterministic baseline (shown immediately), then refined by the LLM
  // simulate seam server-side. The seam degrades to this same baseline if the
  // model is unavailable, so the panel always has a valid reaction to show.
  const local = useMemo(() => (proposalText ? simulateProposal(client, proposalText) : null), [client, proposalText]);
  const [llm, setLlm] = useState<SimulationResult | null>(null);
  const [refining, setRefining] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLlm(null);
    if (!local) { setRefining(false); return; }
    const seq = ++seqRef.current;
    const ctrl = new AbortController();
    setRefining(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client, proposal: proposalText, baseline: local }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SimulationResult | null) => { if (d && seq === seqRef.current) setLlm(d); })
      .catch(() => {})
      .finally(() => { if (seq === seqRef.current) setRefining(false); });
    return () => ctrl.abort();
  }, [client, proposalText, local]);

  const reaction = llm ?? local;
  const aiRefined = reaction === llm && llm?.engine === "anthropic";

  // Cycle "thinking" phrases while the model refines, so the wait reads as the
  // copilot reasoning about this specific client rather than a generic spinner.
  const phases = useMemo(() => [
    `Reading ${client.name}'s values & mandate`,
    "Weighing the proposal against their DNA",
    `Predicting how ${client.name} would react`,
  ], [client.name]);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!refining) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setPhase(0);
    const id = setInterval(() => setPhase((p) => (p + 1) % phases.length), 1100);
    return () => clearInterval(id);
  }, [refining, phases.length]);
  const { compliance, impact } = useMemo(() => computeOutcome(client, sel, usingText ? text : null), [client, sel, usingText, text]);

  function pickAdvice(key: string) { setAdviceKey(key); setText(""); }
  function submitText() { const t = input.trim(); if (!t) return; setText(t); setAdviceKey(null); }

  const acc = reaction ? Math.round(reaction.acceptanceProbability * 100) : 0;
  const accColor = reaction && reaction.acceptanceProbability > 0.6 ? "var(--green)" : reaction && reaction.acceptanceProbability > 0.4 ? "var(--amber)" : "var(--red)";

  return (
    <div className="booksim">
      <div className="bs-head" style={{ paddingBottom: 14 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>Rehearse a proposal · {client.name}</h1>
        <p className="lead" style={{ margin: 0 }}>Pick a strategy <b>or</b> describe your own. See how {client.name} would likely react, the CHF impact, and whether it keeps their mandate.</p>
      </div>

      <div className="bs-advice">
        {advice.slice(0, 3).map((a) => (
          <button key={a.key} className={"adv" + (!usingText && a.key === adviceKey ? " on" : "")} onClick={() => pickAdvice(a.key)} title={a.detail}>
            <span className="k">Proposal</span>{a.label}
          </button>
        ))}
      </div>

      <div className="rehearse-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitText()}
          placeholder={`Or describe a proposal for ${client.name}, e.g. "trim Nvidia and add Swiss staples"`}
        />
        <button onClick={submitText} disabled={!input.trim()}>Rehearse</button>
      </div>
      {usingText && text && <div className="rehearse-subject">Rehearsing your proposal: “{text}”</div>}

      <div className="ro-wrap">
        {refining ? (
          <div className="sim-thinking" role="status" aria-live="polite">
            <div className="sim-dots" aria-hidden="true"><span /><span /><span /></div>
            <p className="sim-thinking-label" key={phase}>{phases[phase]}…</p>
          </div>
        ) : !reaction ? (
          <p className="empty" style={{ padding: "28px 0" }}>Pick a proposal above or type your own to rehearse.</p>
        ) : (
          <>
            <div className="ro-top">
              <div className="ro-accept" style={{ marginBottom: 6 }}>
                <span className="pct" style={{ color: accColor }}>{acc}%</span>
                <span className="lbl" style={{ marginLeft: 8 }}>likely acceptance · {client.name}</span>
                {aiRefined ? (
                  <span className="lbl" style={{ marginLeft: 8, opacity: 0.7 }} title={`Refined by ${reaction?.model}`}>✦ AI-refined</span>
                ) : null}
              </div>
              <div className="bar" style={{ maxWidth: 320, marginBottom: 10 }}>
                <div style={{ width: `${acc}%`, background: accColor }} />
              </div>
              <p className="ro-react" style={{ margin: 0, maxWidth: 820 }}>{reaction.predictedReaction}</p>
            </div>

            <div className="ro-grid">
              <div className="ro-block">
                <div className="lbl" style={{ marginBottom: 6 }}>Estimated monetary impact · next {impact.horizonMonths} months</div>
                {impact.components.length ? (
                  <>
                    <div className="impact-net" style={{ color: impact.netCHF >= 0 ? "var(--green)" : "var(--red)" }}>
                      {impact.netCHF >= 0 ? "+" : "−"}{formatMoney(Math.abs(impact.netCHF))}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 12px" }}>
                      net {impact.netCHF >= 0 ? "benefit" : "cost"} to {client.name} from this proposal.
                    </p>
                    {impact.components.map((c, i) => {
                      const pos = c.amountCHF >= 0;
                      const mag = Math.max(...impact.components.map((x) => Math.abs(x.amountCHF)));
                      return (
                        <div className="impact-comp" key={i}>
                          <div className="ic-top"><span>{c.label}</span><span className={"amt " + (pos ? "pos" : "neg")}>{pos ? "+" : "−"}{formatMoney(Math.abs(c.amountCHF))}</span></div>
                          <div className="ic-bar" style={{ width: `${mag ? Math.max(6, (Math.abs(c.amountCHF) / mag) * 100) : 0}%`, background: pos ? "var(--green)" : "var(--red)" }} />
                          <div className="ic-note">{c.note}</div>
                        </div>
                      );
                    })}
                    <p className="impact-assump">Estimates, not guarantees. Each figure is a position value × a stated assumption, fully traceable.</p>
                  </>
                ) : (
                  <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Limited direct monetary effect. This proposal doesn't change {client.name}'s at-risk exposure.</p>
                )}
              </div>

              <div className="ro-block">
                <div className="lbl">Portfolio &amp; compliance</div>
                {compliance ? (
                  <>
                    <div className={"verdict " + (compliance.compliant ? "ok" : "no")}>{compliance.compliant ? "✓ Mandate-compliant" : "✗ Not mandate-compliant"}</div>
                    <div className="stamp"><span className={"mk " + (compliance.sameSector ? "y" : "n")}>{compliance.sameSector ? "✓" : "✗"}</span> Same sector{compliance.buy.industryGroup ? ` (${compliance.buy.industryGroup})` : ""}</div>
                    <div className="stamp"><span className={"mk " + (compliance.buyRatingOk ? "y" : "n")}>{compliance.buyRatingOk ? "✓" : "✗"}</span> Buy is CIO-rated BUY</div>
                    <div className="stamp"><span className={"mk " + (compliance.newBreaches.length === 0 ? "y" : "n")}>{compliance.newBreaches.length === 0 ? "✓" : "✗"}</span> No new ±2.0pp drift breach</div>
                    <div className="cdesk-moved"><b>{formatMoney(compliance.amountCHF)}</b> moves from {compliance.sell.issuer} to {compliance.buy.issuer}.</div>
                    <div className={"dverdict " + compliance.dna.verdict}><b>Client values: {compliance.dna.verdict}</b> — {compliance.dna.reason}</div>
                  </>
                ) : sel?.kind === "preset" && sel.fit != null ? (
                  <div className={"dverdict " + (sel.fit > 0.15 ? "honors" : sel.fit < -0.15 ? "conflicts" : "neutral")}>
                    <b>Value fit: {sel.fit > 0.15 ? "strong" : sel.fit < -0.15 ? "misfit" : "neutral"}</b> — {sel.fit > 0.15 ? "this broadcast strategy aligns with the client's values." : sel.fit < -0.15 ? "this broadcast strategy cuts against the client's stated values." : "this strategy is roughly value-neutral for the client."}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5 }}>No single-instrument trade to check for this proposal. Pick a proposal with a trade (or name a holding) to see the full mandate &amp; CIO check.</p>
                )}
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
          </>
        )}
      </div>
    </div>
  );
}
