import type { Client, NewsSignal, SignalType } from "../types";

// Transparent priority score for the queue: a weighted blend of four signals,
// each normalised to [0,1]. Weights sum to 1 → score stays in [0,1] (shown /100).
// Justification: docs/priority-metric.md
export const PRIORITY_WEIGHTS = { severity: 0.35, exposure: 0.25, conflict: 0.2, recency: 0.2 } as const;
const HALF_LIFE_DAYS = 7;
const DAY_MS = 86_400_000;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// How adversarial each event type is — a risk demands proactive contact more
// than a positive opportunity (which is "nice to mention", not "must defuse").
export const CONFLICT_WEIGHT: Record<SignalType, number> = {
  reputational: 1.0,
  value_conflict: 1.0,
  // A sharp, vol-scaled price move is a risk that demands proactive contact —
  // urgent, but a values conflict or reputational hit still outranks it.
  market_anomaly: 0.85,
  mandate_drift: 0.7,
  exposure: 0.7,
  opportunity: 0.3,
};

/** The signal that drives a client's priority: the most severe, not array order. */
function activeSignal(c: Client): NewsSignal | undefined {
  return c.signals.reduce<NewsSignal | undefined>(
    (best, s) => (best && best.severity >= s.severity ? best : s),
    undefined,
  );
}

export interface PriorityBreakdown {
  severity: number;   // 0..1 magnitude of the active event
  exposure: number;   // 0..1 CHF at stake, vs the book's largest
  conflict: number;   // 0..1 how adversarial the event is (risk vs opportunity)
  recency: number;    // 0..1 freshness of the trigger
  combined: number;   // 0..1 weighted blend — the ranking score
}

function triggerDate(c: Client): string | null {
  return c.lastMessageAt ?? activeSignal(c)?.publishedAt ?? null;
}

function priorityOf(client: Client, bookMax: number, nowMs: number): PriorityBreakdown {
  const sig = activeSignal(client);
  const severity = sig ? clamp01(sig.severity / 100) : 0;
  const exposure = bookMax > 0 ? clamp01((client.amountAtStake ?? 0) / bookMax) : 0;
  const conflict = sig ? CONFLICT_WEIGHT[sig.type] ?? 0 : 0;

  let recency = 0;
  const d = triggerDate(client);
  if (d) {
    const t = Date.parse(d);
    if (!Number.isNaN(t)) recency = clamp01(Math.pow(0.5, Math.max(0, (nowMs - t) / DAY_MS) / HALF_LIFE_DAYS));
  }

  const combined =
    PRIORITY_WEIGHTS.severity * severity +
    PRIORITY_WEIGHTS.exposure * exposure +
    PRIORITY_WEIGHTS.conflict * conflict +
    PRIORITY_WEIGHTS.recency * recency;

  return { severity, exposure, conflict, recency, combined };
}

function contextOf(book: Client[]): { bookMax: number; nowMs: number } {
  const bookMax = Math.max(1, ...book.map((c) => c.amountAtStake ?? 0));
  const dates = book.map(triggerDate).filter(Boolean).map((d) => Date.parse(d!)).filter((n) => !Number.isNaN(n));
  const nowMs = dates.length ? Math.max(...dates) : Date.now();
  return { bookMax, nowMs };
}

/** The book ranked by combined priority (desc), each with its breakdown. */
export function rankBook(book: Client[]): { client: Client; pr: PriorityBreakdown }[] {
  const { bookMax, nowMs } = contextOf(book);
  return book
    .map((client) => ({ client, pr: priorityOf(client, bookMax, nowMs) }))
    .sort((a, b) => b.pr.combined - a.pr.combined);
}

/** Priority breakdown for one client, in the context of the whole book. */
export function priorityFor(client: Client, book: Client[]): PriorityBreakdown {
  const { bookMax, nowMs } = contextOf(book);
  return priorityOf(client, bookMax, nowMs);
}
