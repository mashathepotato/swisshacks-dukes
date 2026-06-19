import { InboxRow, Mandate, Severity, Trace } from "../../shared/domain";

// Severity dominates the ranking; value-at-stake breaks ties within a severity.
const sevWeight: Record<Severity, number> = { act: 3, watch: 2, info: 1 };

export function summarizeClient(id: string, name: string, mandate: Mandate, traces: Trace[]): InboxRow {
  const top = traces[0] ?? null; // buildAlerts already sorts act -> watch -> info
  const score = top ? sevWeight[top.severity] * 1_000_000 + (top.valueAtStakeCHF ?? 0) : 0;
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
