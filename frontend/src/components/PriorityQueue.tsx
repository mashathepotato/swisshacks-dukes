import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
import { useDone } from "../lib/doneStore";

interface Props {
  selectedId: string | null;
  onSelect: (client: Client) => void;
}

export function PriorityQueue({ selectedId, onSelect }: Props) {
  const { done, markDone, reopen } = useDone();
  const [showDone, setShowDone] = useState(true);

  const ranked = useMemo(() => [...CLIENTS].sort((a, b) => b.priorityScore - a.priorityScore), []);
  const active = ranked.filter((c) => !done.has(c.id));
  const dealt = ranked.filter((c) => done.has(c.id));

  function row(c: Client, isDone: boolean) {
    const sig = c.signals[0];
    const meta = sig ? SIGNAL_META[sig.type] : null;
    const rec = c.recommendations[0];
    const trigger = c.lastMessageAt
      ? { label: "messaged", at: c.lastMessageAt }
      : sig
      ? { label: "news", at: sig.publishedAt }
      : null;
    return (
      <div
        key={c.id}
        className={"qrow" + (selectedId === c.id ? " selected" : "") + (isDone ? " done" : "")}
        onClick={() => onSelect(c)}
      >
        <div className="who">
          <div className="nm">{c.name}</div>
          <div className="at">{c.archetype} · {c.mandate}</div>
          <div className="qmeta">
            {c.amountAtStake != null && <span className="stake">{formatMoney(c.amountAtStake)} at stake</span>}
            {trigger && <span className="ago">{trigger.label} {relativeTime(trigger.at)}</span>}
          </div>
        </div>
        <div className="reason">
          {meta && (
            <span className="badge" style={{ background: meta.color + "22", color: meta.color }}>
              {meta.label}{sig ? ` · severity ${sig.severity}` : ""}
            </span>
          )}
          <div>{c.topReason}</div>
          {rec && (
            <div className="recs-inline">
              <span className="r">{rec.action}</span>
            </div>
          )}
        </div>
        {isDone ? (
          <button className="done-btn" onClick={(e) => { e.stopPropagation(); reopen(c.id); }}>↩ Reopen</button>
        ) : (
          <button className="done-btn" onClick={(e) => { e.stopPropagation(); markDone(c.id); }}>✓ Mark complete</button>
        )}
      </div>
    );
  }

  return (
    <div className="queue">
      <h1>Your book — by priority</h1>
      <p className="lead">{active.length} client{active.length === 1 ? "" : "s"} need attention.</p>

      {active.length > 0 ? active.map((c) => row(c, false)) : (
        <p className="empty" style={{ padding: "32px 0" }}>All caught up.</p>
      )}

      {dealt.length > 0 && (
        <>
          <div className="queue-section" onClick={() => setShowDone((v) => !v)}>
            <span>{showDone ? "▾" : "▸"} Completed · {dealt.length}</span>
            <span className="ln" />
          </div>
          {showDone && dealt.map((c) => row(c, true))}
        </>
      )}
    </div>
  );
}
