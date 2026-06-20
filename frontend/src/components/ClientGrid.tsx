import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { SIGNAL_META, formatMoney } from "../lib/format";

interface Props {
  onOpen: (client: Client) => void;
}

/** All clients in a grid (no priority ranking) — click a card for the full profile. */
export function ClientGrid({ onOpen }: Props) {
  // personas first, then synthetic twins; alphabetical within each group
  const clients = [...CLIENTS].sort(
    (a, b) => Number(b.isPersona) - Number(a.isPersona) || a.name.localeCompare(b.name)
  );

  return (
    <div className="clients">
      <h1>All clients</h1>
      <p className="lead">{clients.length} clients across the book. Click any card to open the full profile.</p>

      <div className="client-grid">
        {clients.map((c) => {
          const sig = c.signals[0];
          const meta = sig ? SIGNAL_META[sig.type] : null;
          return (
            <div
              key={c.id}
              className="client-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(c)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c); } }}
            >
              <div className="cc-top">
                <div className="cc-name">{c.name}</div>
                {c.isPersona && <span className="cc-tag">persona</span>}
              </div>
              <div className="cc-arch">{c.archetype} · {c.mandate}</div>
              {meta && (
                <span className="cause-pill" style={{ background: meta.color + "22", color: meta.color }}>
                  {meta.label}
                </span>
              )}
              <p className="cc-reason">{c.topReason}</p>
              <div className="cc-foot">
                {c.amountAtStake != null
                  ? <span className="cc-stake">{formatMoney(c.amountAtStake)} at stake</span>
                  : <span />}
                <span className="cc-open">Open →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
