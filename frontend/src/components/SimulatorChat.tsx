import { useEffect, useRef, useState } from "react";
import { CLIENTS } from "../data/clients";
import { simulateProposal } from "../data/simulate";
import type { ChatMessage, Client, SimulationResult } from "../types";
import { TrajectoryChart } from "./TrajectoryChart";

const SUGGESTIONS = [
  "Reduce Nvidia exposure by 5% and rotate into Swiss staples",
  "Increase US AI allocation to capture momentum",
  "Exit the holding tied to the labour scandal",
  "Add a green bond sleeve to the portfolio",
];

interface Props { focusClientId: string | null; }

export function SimulatorChat({ focusClientId }: Props) {
  const personas = CLIENTS.filter((c) => c.isPersona);
  const [clientId, setClientId] = useState<string>(focusClientId ?? personas[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  const client: Client = CLIENTS.find((c) => c.id === clientId)!;

  useEffect(() => {
    if (focusClientId) {
      setClientId(focusClientId);
      setMessages([]);
      setResult(null);
    }
  }, [focusClientId]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

              <div className="metric">
                <div className="lbl">Predicted trajectory</div>
                <TrajectoryChart points={result.trajectory} />
                <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 12, marginTop: 2 }}>
                  <span style={{ color: "#4f8ff7" }}>— Trust</span>
                  <span style={{ color: "#805ad5" }}>-- Values alignment</span>
                </div>
              </div>

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
