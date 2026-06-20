import type { Client } from "../types";
import { SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
import { CLIENTS } from "../data/clients";
import { priorityFor, PRIORITY_WEIGHTS } from "../lib/priority";
import { useDone } from "../lib/doneStore";

interface Props {
  client: Client | null;
  onOpenFull?: (client: Client) => void;
}

export function ClientDetail({ client, onOpenFull }: Props) {
  const { isDone, markDone, reopen } = useDone();
  if (!client) {
    return (
      <div className="drawer">
        <p className="empty">Select a client to preview their priority, the top reason it surfaced and the headline next step. Open the full profile for the reasoning chain, value DNA, compliance desk and draft message.</p>
      </div>
    );
  }
  const dealt = isDone(client.id);
  const trigger = client.lastMessageAt
    ? { label: "messaged", at: client.lastMessageAt }
    : client.signals[0]
    ? { label: "news", at: client.signals[0].publishedAt }
    : null;
  const rec = client.recommendations[0];
  const sig = client.signals[0];
  const pr = priorityFor(client, CLIENTS);

  return (
    <div className="drawer">
      <h2>{client.name}</h2>
      <div className="archetype">{client.archetype}</div>

      {sig && (() => {
        const m = SIGNAL_META[sig.type];
        return <span className="cause-pill" style={{ background: m.color + "22", color: m.color }}>{m.label} · severity {sig.severity}</span>;
      })()}

      {(client.amountAtStake != null || trigger) && (
        <div className="stake-line">
          {client.amountAtStake != null && <><b>{formatMoney(client.amountAtStake)}</b> at stake</>}
          {client.amountAtStake != null && trigger && " · "}
          {trigger && <span className="ago">{trigger.label} {relativeTime(trigger.at)}</span>}
        </div>
      )}

      <p className="why-priority"><b>Why now:</b> {client.topReason}</p>
      {sig && <p className="sig-headline">{sig.headline} <span style={{ color: "var(--text-faint)" }}>· {sig.source}</span></p>}

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

      {(client.values.length > 0 || client.dislikes.length > 0) && (
        <>
          <div className="section-title">Value DNA</div>
          <div className="chips">
            {client.values.slice(0, 3).map((v) => <span key={v} className="chip">✓ {v}</span>)}
            {client.dislikes.slice(0, 2).map((v) => <span key={v} className="chip" style={{ color: "var(--red)" }}>✕ {v}</span>)}
          </div>
        </>
      )}

      {rec && (
        <>
          <div className="section-title">Recommended next step</div>
          <div className="card">
            <h4>{rec.action}</h4>
          </div>
        </>
      )}

      <button className="cp-open" onClick={() => onOpenFull?.(client)}>
        View full profile — reasoning chain, value DNA, compliance &amp; draft →
      </button>

      <div>
        <button className={"markdone" + (dealt ? " on" : "")} onClick={() => (dealt ? reopen(client.id) : markDone(client.id))}>
          {dealt ? "✓ Completed — reopen" : "✓ Mark as complete"}
        </button>
      </div>
    </div>
  );
}
