import { CLIENTS } from "../data/clients";
import { priorityFor, PRIORITY_WEIGHTS } from "../lib/priority";
import type { Client } from "../types";
import { FormulaTip } from "./Formula";

const F = {
  combined: String.raw`\text{priority}=0.35\,\text{sev}+0.25\,\text{exp}+0.20\,\text{con}+0.20\,\text{rec}`,
  severity: String.raw`\text{sev}=\dfrac{\text{event severity }(0\text{–}100)}{100}`,
  exposure: String.raw`\text{exp}=\dfrac{\text{CHF at stake}}{\max_{\text{book}}\text{ CHF at stake}}`,
  conflict: String.raw`\text{con}=w(\text{type}),\ \ w_{\text{rep}}{=}1,\ w_{\text{drift}}{=}0.7,\ w_{\text{opp}}{=}0.3`,
  recency: String.raw`\text{rec}=0.5^{\,\Delta t_{\text{days}}/7}`,
};

export function PriorityScore({ client }: { client: Client }) {
  const pr = priorityFor(client, CLIENTS);
  return (
    <>
      <div className="section-title">Priority score</div>
      <div className="pscore">
        <FormulaTip formula={F.combined}><span className="pscore-big">{Math.round(pr.combined * 100)}</span></FormulaTip>
        <div className="pscore-break">
          <div><FormulaTip formula={F.severity}><span>Event severity</span></FormulaTip><span><b>{Math.round(pr.severity * 100)}</b> × {PRIORITY_WEIGHTS.severity}</span></div>
          <div><FormulaTip formula={F.exposure}><span>Portfolio exposure</span></FormulaTip><span><b>{Math.round(pr.exposure * 100)}</b> × {PRIORITY_WEIGHTS.exposure}</span></div>
          <div><FormulaTip formula={F.conflict}><span>Conflict</span></FormulaTip><span><b>{Math.round(pr.conflict * 100)}</b> × {PRIORITY_WEIGHTS.conflict}</span></div>
          <div><FormulaTip formula={F.recency}><span>Recency</span></FormulaTip><span><b>{Math.round(pr.recency * 100)}</b> × {PRIORITY_WEIGHTS.recency}</span></div>
        </div>
      </div>
      <p className="pscore-cap">Weighted blend (out of 100) · hover a row for its formula. Justification: docs/priority-metric.md.</p>
    </>
  );
}
