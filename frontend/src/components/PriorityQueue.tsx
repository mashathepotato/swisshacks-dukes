import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import type { Client } from "../types";
import { SIGNAL_META, formatMoney, relativeTime, gradeColor } from "../lib/format";
import { rankBook } from "../lib/priority";
import { useDone } from "../lib/doneStore";

interface Props {
  selectedId: string | null;
  onSelect: (client: Client) => void;
}

export function PriorityQueue({ selectedId, onSelect }: Props) {
  const { done, markDone, reopen } = useDone();
  const [showDone, setShowDone] = useState(true);

  // transparent priority: combined of severity, exposure, conflict, recency (see lib/priority.ts)
  const ranked = useMemo(() => rankBook(CLIENTS), []);
  const scoreById = useMemo(() => new Map(ranked.map((r) => [r.client.id, Math.round(r.pr.combined * 100)])), [ranked]);
  const active = ranked.map((r) => r.client).filter((c) => !done.has(c.id));
  const dealt = ranked.map((r) => r.client).filter((c) => done.has(c.id));

  function row(c: Client, isDone: boolean) {
    const sig = c.signals[0];
    const meta = sig ? SIGNAL_META[sig.type] : null;
    const rec = c.recommendations[0];
    const score = scoreById.get(c.id) ?? 0;
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
        <span className="qscore" title="Priority score (out of 100)" style={{ color: gradeColor(score), background: gradeColor(score) + "14", borderColor: gradeColor(score) + "59" }}>{score}</span>
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
      <h1>Your book, by priority</h1>
      <p className="lead">
        {active.length} need{active.length === 1 ? "s" : ""} attention · ranked by a transparent priority score (out of 100): event severity, portfolio exposure, conflict and recency. Mark a client complete once you've actioned it.
      </p>

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
