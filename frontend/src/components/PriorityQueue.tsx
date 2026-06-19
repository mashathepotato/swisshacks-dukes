import { useMemo } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { scoreColor, SIGNAL_META } from "../lib/format";

interface Props {
  selectedId: string | null;
  onSelect: (client: Client) => void;
}

export function PriorityQueue({ selectedId, onSelect }: Props) {
  const ranked = useMemo(
    () => [...CLIENTS].sort((a, b) => b.priorityScore - a.priorityScore),
    []
  );

  return (
    <div className="queue">
      <h1>Your book — by priority</h1>
      <p className="lead">
        {ranked.length} clients · ranked by news severity, portfolio exposure, value conflict and relationship sensitivity. Click a client for the full evidence chain.
      </p>

      {ranked.map((c) => {
        const sig = c.signals[0];
        const meta = sig ? SIGNAL_META[sig.type] : null;
        const rec = c.recommendations[0];
        return (
          <div
            key={c.id}
            className={"qrow" + (selectedId === c.id ? " selected" : "")}
            onClick={() => onSelect(c)}
          >
            <span
              className="score-pill"
              style={{ background: scoreColor(c.priorityScore) + "22", color: scoreColor(c.priorityScore) }}
            >
              <span className="n">{c.priorityScore}</span>
            </span>
            <div className="who">
              <div className="nm">{c.name}</div>
              <div className="at">{c.archetype} · {c.mandate}</div>
            </div>
            <div className="reason">
              {meta && (
                <span className="badge" style={{ background: meta.color + "22", color: meta.color }}>
                  {meta.label}
                </span>
              )}
              <div>{c.topReason}</div>
              {rec && (
                <div className="recs-inline">
                  <span className="r">{rec.action}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
