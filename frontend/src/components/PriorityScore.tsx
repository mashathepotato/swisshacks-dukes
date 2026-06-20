import { CLIENTS } from "../data/clients";
import { priorityFor, PRIORITY_WEIGHTS } from "../lib/priority";
import type { Client } from "../types";

export function PriorityScore({ client }: { client: Client }) {
  const pr = priorityFor(client, CLIENTS);
  return (
    <>
      <div className="section-title">Priority score</div>
      <div className="pscore">
        <span className="pscore-big">{Math.round(pr.combined * 100)}</span>
        <div className="pscore-break">
          <div><span>Event severity</span><span><b>{Math.round(pr.severity * 100)}</b> × {PRIORITY_WEIGHTS.severity}</span></div>
          <div><span>Portfolio exposure</span><span><b>{Math.round(pr.exposure * 100)}</b> × {PRIORITY_WEIGHTS.exposure}</span></div>
          <div><span>Conflict</span><span><b>{Math.round(pr.conflict * 100)}</b> × {PRIORITY_WEIGHTS.conflict}</span></div>
          <div><span>Recency</span><span><b>{Math.round(pr.recency * 100)}</b> × {PRIORITY_WEIGHTS.recency}</span></div>
        </div>
      </div>
      <p className="pscore-cap">Weighted blend (out of 100). Justification: docs/priority-metric.md.</p>
    </>
  );
}
