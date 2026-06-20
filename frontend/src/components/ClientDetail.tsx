import type { Client } from "../types";
import { scoreColor, formatMoney, relativeTime } from "../lib/format";
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

  return (
    <div className="drawer">
      <h2>{client.name}</h2>
      <div className="archetype">{client.archetype}</div>

      <span
        className="score-pill"
        style={{ background: scoreColor(client.priorityScore) + "22", color: scoreColor(client.priorityScore) }}
      >
        <span className="n">{client.priorityScore}</span>
        <span className="d">/100 priority</span>
      </span>

      {(client.amountAtStake != null || trigger) && (
        <div className="stake-line">
          {client.amountAtStake != null && <><b>{formatMoney(client.amountAtStake)}</b> at stake</>}
          {client.amountAtStake != null && trigger && " · "}
          {trigger && <span className="ago">{trigger.label} {relativeTime(trigger.at)}</span>}
        </div>
      )}

      <div className="section-title">Top reason</div>
      <p className="news-text">{client.topReason}</p>

      {rec && (
        <>
          <div className="section-title">Recommended next step</div>
          <div className="card">
            <h4>{rec.action}</h4>
          </div>
        </>
      )}

      <button className="cp-open" onClick={() => onOpenFull?.(client)}>
        View full profile →
      </button>

      <div>
        <button className={"markdone" + (dealt ? " on" : "")} onClick={() => (dealt ? reopen(client.id) : markDone(client.id))}>
          {dealt ? "✓ Completed — reopen" : "✓ Mark as complete"}
        </button>
      </div>
    </div>
  );
}
