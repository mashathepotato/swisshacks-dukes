import { useEffect, useMemo, useRef, useState } from "react";
import { CLIENTS } from "../data/clients";
import { simulateProposal } from "../data/simulate";
import type { ChatMessage, Client, SimulationResult } from "../types";
import { PORTFOLIOS, CIO, STRATEGIES } from "../data/portfolio";
import { PERSONA_PLAY, proposeSwap, simulateSwap, estimateImpact } from "../lib/portfolio";
import type { MonetaryImpact } from "../lib/portfolio";
import { formatMoney } from "../lib/format";

const SUGGESTIONS = [
  "Reduce Nvidia exposure by 5% and rotate into Swiss staples",
  "Increase US AI allocation to capture momentum",
  "Exit the holding tied to the labour scandal",
  "Add a green bond sleeve to the portfolio",
];

interface Props { focusClientId: string | null; }

/** Derive impact inputs from the free-text proposal + client persona context. */
function deriveImpact(client: Client, proposal: string): MonetaryImpact {
  const p = proposal.toLowerCase();
  const mentions = (...kw: string[]) => kw.some((k) => p.includes(k));

  const isReduce = mentions("reduce", "cut", "trim", "exit", "sell", "divest", "drop", "dump");
  const isUSTechAdd = mentions("nvidia", "ai", "tech", "us equit", "semiconductor", "microsoft", "apple")
    && mentions("increase", "add", "buy", "overweight", "more");
  const followCio = mentions("follow cio", "rotation", "rotate into", "mega-cap", "tactical");

  const play = PERSONA_PLAY[client.id];
  const severity = client.signals[0]?.severity ?? 55;

  if (play) {
    const holdings = PORTFOLIOS[play.mandate];
    const flaggedPos = holdings.find((h) => h.isin === play.sellIsin);
    const exposure = flaggedPos?.currentCHF ?? client.amountAtStake ?? 0;
    const averse = (play.aversionTerms?.length ?? 0) > 0;

    // Pushing an averse client into the sector they distrust → risk-on, with a real compliance check.
    if (averse && (isUSTechAdd || followCio)) {
      const held = new Set(holdings.map((h) => h.isin));
      const pushed = CIO.find(
        (c) => c.rating === "BUY" && play.aversionTerms!.some((t) => c.industryGroup.toLowerCase().includes(t)) && !held.has(c.isin)
      );
      const compliance = pushed
        ? simulateSwap({
            holdings, strategies: STRATEGIES, cio: CIO, mandate: play.mandate,
            sellIsin: play.sellIsin, buyIsin: pushed.isin, aversionTerms: play.aversionTerms, sellResolvesConflict: false,
          })
        : null;
      return estimateImpact({ exposureCHF: compliance?.amountCHF ?? exposure, mode: "risk-on", severity, hasTrade: !!compliance });
    }

    // Otherwise, frame the monetary stakes of acting on the client's flagged position.
    const chosen = proposeSwap(play.sellIsin, holdings, CIO).chosen;
    return estimateImpact({ exposureCHF: exposure, mode: "protect", severity, hasTrade: !!chosen });
  }

  // Non-persona fallback.
  const exposure = client.amountAtStake ?? 0;
  return estimateImpact({ exposureCHF: exposure, mode: isReduce ? "protect" : "neutral", severity, hasTrade: false });
}

export function SimulatorChat({ focusClientId }: Props) {
  const personas = CLIENTS.filter((c) => c.isPersona);
  const [clientId, setClientId] = useState<string>(focusClientId ?? personas[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [lastProposal, setLastProposal] = useState<string>("");
  const msgsRef = useRef<HTMLDivElement>(null);

  const client: Client = CLIENTS.find((c) => c.id === clientId)!;

  useEffect(() => {
    if (focusClientId) {
      // Intentional: reset the chat when the parent focuses a different client.
      /* eslint-disable react-hooks/set-state-in-effect */
      setClientId(focusClientId);
      setMessages([]);
      setResult(null);
      setLastProposal("");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [focusClientId]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const impact = useMemo(
    () => (lastProposal ? deriveImpact(client, lastProposal) : null),
    [client, lastProposal]
  );

  function send(text: string) {
    const proposal = text.trim();
    if (!proposal) return;
    const sim = simulateProposal(client, proposal);
    const pct = Math.round(sim.acceptanceProbability * 100);
    const reply =
      `Simulating ${client.name}'s likely trajectory…\n\n` +
      `${sim.predictedReaction}\n\n` +
      `Estimated acceptance: ${pct}%. ${sim.objections[0]}\n\n` +
      `Best framing: ${sim.bestFraming}\n\nSuggested next step: ${sim.nextStep}`;
    setMessages((m) => [...m, { role: "rm", text: proposal }, { role: "copilot", text: reply }]);
    setResult(sim);
    setLastProposal(proposal);
    setInput("");
  }

  return (
    <div className="sim">
      <div className="sim-head">
        <h1>Rehearse a proposal — client twin simulator</h1>
        <div className="who-sel">
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              className={"pick" + (c.id === clientId ? " on" : "")}
              onClick={() => { setClientId(c.id); setMessages([]); setResult(null); }}
            >
              {c.name}{c.isPersona ? "" : " ·"}
            </button>
          ))}
        </div>
      </div>

      <div className="sim-body">
        <div className="chat">
          <div className="msgs" ref={msgsRef}>
            {messages.length === 0 && (
              <p className="empty">
                Propose an idea in plain language — e.g. "trim Nvidia and add Swiss staples".<br />
                The copilot simulates how <b>{client.name}</b> would likely react before you contact them.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"msg " + m.role}>
                <div className="who-label">{m.role === "rm" ? "You (RM)" : "Copilot"}</div>
                <div className="bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
          </div>

          {messages.length === 0 && (
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder={`Propose an action for ${client.name}…`}
            />
            <button onClick={() => send(input)} disabled={!input.trim()}>Simulate</button>
          </div>
        </div>

        <div className="sim-side">
          {!result ? (
            <p className="empty" style={{ padding: "20px 0" }}>Forecast appears here.</p>
          ) : (
            <>
              <div className="metric">
                <div className="lbl">Acceptance probability</div>
                <div className="big" style={{ color: result.acceptanceProbability > 0.6 ? "var(--green)" : result.acceptanceProbability > 0.4 ? "var(--amber)" : "var(--red)" }}>
                  {Math.round(result.acceptanceProbability * 100)}%
                </div>
                <div className="bar">
                  <div style={{ width: `${result.acceptanceProbability * 100}%`, background: result.acceptanceProbability > 0.6 ? "var(--green)" : result.acceptanceProbability > 0.4 ? "var(--amber)" : "var(--red)" }} />
                </div>
              </div>

              {impact && (
                <div className="metric">
                  <div className="lbl">Estimated monetary impact · next {impact.horizonMonths} months</div>
                  {impact.components.length > 0 ? (
                    <>
                      <div
                        className="impact-net"
                        style={{ color: impact.netCHF >= 0 ? "var(--green)" : "var(--red)" }}
                      >
                        {impact.netCHF >= 0 ? "+" : "−"}{formatMoney(Math.abs(impact.netCHF))}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 10px" }}>
                        net {impact.netCHF >= 0 ? "benefit" : "cost"} to {client.name} from this proposal.
                      </p>
                      {impact.components.map((comp, i) => {
                        const pos = comp.amountCHF >= 0;
                        const mag = Math.max(...impact.components.map((x) => Math.abs(x.amountCHF)));
                        return (
                          <div className="impact-comp" key={i}>
                            <div className="ic-top">
                              <span>{comp.label}</span>
                              <span className={"amt " + (pos ? "pos" : "neg")}>
                                {pos ? "+" : "−"}{formatMoney(Math.abs(comp.amountCHF))}
                              </span>
                            </div>
                            <div
                              className="ic-bar"
                              style={{
                                width: `${mag ? Math.max(6, (Math.abs(comp.amountCHF) / mag) * 100) : 0}%`,
                                background: pos ? "var(--green)" : "var(--red)",
                              }}
                            />
                            <div className="ic-note">{comp.note}</div>
                          </div>
                        );
                      })}
                      <p className="impact-assump">
                        An estimate, not a guarantee — each figure is the real position value × a stated assumption (severity→drawdown, 0.20% transaction cost, 1.5% CIO-BUY premium), so it's fully traceable rather than a black-box forecast.
                      </p>
                    </>
                  ) : (
                    <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                      Limited direct monetary effect — this proposal doesn't change {client.name}'s at-risk exposure.
                    </p>
                  )}
                </div>
              )}

              <div className="metric">
                <div className="lbl">Likely objections</div>
                {result.objections.map((o, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0", lineHeight: 1.45 }}>• {o}</p>
                ))}
              </div>

              <div className="metric">
                <div className="lbl">Best framing</div>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0", lineHeight: 1.45 }}>{result.bestFraming}</p>
              </div>

              <div className="metric">
                <div className="lbl">Suggested next step</div>
                <p style={{ fontSize: 12.5, color: "var(--text)", margin: "4px 0", lineHeight: 1.45 }}>{result.nextStep}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
