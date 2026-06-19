import { InboxRow, Mandate, Severity, Trace } from "../../shared/domain";

// Severity dominates the ranking; value-at-stake breaks ties within a severity.
const sevWeight: Record<Severity, number> = { act: 3, watch: 2, info: 1 };

// A live, unaddressed client message outranks any system-detected alert: the
// client has actively reached out and is waiting on the RM.
const CLIENT_SIGNAL_BOOST = 10_000_000;

export function summarizeClient(id: string, name: string, mandate: Mandate, traces: Trace[]): InboxRow {
  // A flagged client message is always the most urgent item — pick it explicitly
  // rather than trusting position [0], so a future re-sort can't silently demote it.
  const top = traces.find((t) => t.type === "client-signal") ?? traces[0] ?? null;
  const boost = top?.type === "client-signal" ? CLIENT_SIGNAL_BOOST : 0;
  const score = top ? boost + sevWeight[top.severity] * 1_000_000 + (top.valueAtStakeCHF ?? 0) : 0;
  return {
    id,
    name,
    mandate,
    top: top
      ? { type: top.type, severity: top.severity, claim: top.claim, valueAtStakeCHF: top.valueAtStakeCHF }
      : null,
    score,
  };
}

export function rankInbox(rows: InboxRow[]): InboxRow[] {
  return [...rows].sort((a, b) => b.score - a.score);
}
