import { CLIENTS } from "../data/clients";
import { priorityFor, PRIORITY_WEIGHTS } from "../lib/priority";
import { gradeColor } from "../lib/format";
import type { Client } from "../types";

export function PriorityScore({ client }: { client: Client }) {
  const pr = priorityFor(client, CLIENTS);
  const score = Math.round(pr.combined * 100);
  const w = PRIORITY_WEIGHTS[client.mandate];
  return (
    <>
      <div className="section-title">Priority score <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>· {client.mandate} strategy</span></div>
      <div className="pscore">
        <span className="pscore-big" style={{ color: gradeColor(score) }}>{score}</span>
        <div className="pscore-break">
          <div><span>Event severity</span><span><b>{Math.round(pr.severity * 100)}</b> × {w.severity}</span></div>
          <div><span>Portfolio exposure</span><span><b>{Math.round(pr.exposure * 100)}</b> × {w.exposure}</span></div>
          <div><span>Conflict</span><span><b>{Math.round(pr.conflict * 100)}</b> × {w.conflict}</span></div>
          <div><span>Recency</span><span><b>{Math.round(pr.recency * 100)}</b> × {w.recency}</span></div>
          <div><span>Market anomaly</span><span><b>{Math.round(pr.anomaly * 100)}</b> × {w.anomaly}</span></div>
        </div>
      </div>
      <p className="pscore-cap">Weighted blend (out of 100), weights tuned to the {client.mandate} mandate.</p>
    </>
  );
}
