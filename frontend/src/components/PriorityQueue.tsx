import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { scoreColor, SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
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
        <span className="score-pill" style={{ background: scoreColor(c.priorityScore) + "22", color: scoreColor(c.priorityScore) }}>
          <span className="n">{c.priorityScore}</span>
        </span>
        <div className="who">
          <div className="nm">{c.name}</div>
          <div className="at">{c.archetype} · {c.mandate}</div>
          <div className="qmeta">
            {meta && <span className="cause" style={{ color: meta.color }}>{meta.label}</span>}
            {c.amountAtStake != null && <span className="stake">{formatMoney(c.amountAtStake)} at stake</span>}
            {trigger && <span className="ago">{trigger.label} {relativeTime(trigger.at)}</span>}
          </div>
        </div>
        <div className="reason">
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
      <p className="lead">
        {active.length} need{active.length === 1 ? "s" : ""} attention · ranked by news severity, portfolio exposure, value conflict and relationship sensitivity. Mark a client complete once you've actioned it.
      </p>

      {active.length > 0 ? active.map((c) => row(c, false)) : (
        <p className="empty" style={{ padding: "32px 0" }}>✓ All caught up — every flagged client has been actioned.</p>
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
