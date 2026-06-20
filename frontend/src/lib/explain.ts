import type { Client, DraftEmail, EvidenceKind, ReasonKind, ReasonStep } from "../types";
import { SIGNAL_META } from "./format";

/** Presentation for each reasoning-chain step kind. */
export const REASON_META: Record<ReasonKind, { label: string; icon: string; color: string }> = {
  dna:          { label: "Client DNA",   icon: "", color: "#5a4b86" },
  holding:      { label: "Portfolio",    icon: "", color: "#3a5a8c" },
  news:         { label: "Signal",       icon: "", color: "#a85a1c" },
  conflict:     { label: "Assessment",   icon: "", color: "#c0271a" },
  relationship: { label: "Relationship", icon: "", color: "#1f7a4d" },
  score:        { label: "Priority",     icon: "", color: "#94680a" },
};

/** Presentation for each evidence "source receipt" kind. */
export const EVIDENCE_META: Record<EvidenceKind, { label: string; icon: string; color: string }> = {
  crm:    { label: "CRM note",      icon: "", color: "#3a5a8c" },
  email:  { label: "Client email",  icon: "", color: "#1f7a4d" },
  client: { label: "Client message", icon: "", color: "#1f7a4d" },
  news:   { label: "News",          icon: "", color: "#a85a1c" },
  cio:    { label: "CIO desk",      icon: "", color: "#5a4b86" },
  market: { label: "Market data",   icon: "", color: "#6a6e77" },
};

/**
 * Return the authored Glass-Thread chain, or synthesise a lightweight one for
 * clients without authored detail (synthetic twins) so the explainability
 * section is never empty.
 */
export function buildReasoningChain(client: Client): ReasonStep[] {
  if (client.reasoningChain?.length) return client.reasoningChain;

  const steps: ReasonStep[] = [];
  const sig = client.signals[0];
  if (sig) {
    const meta = SIGNAL_META[sig.type];
    steps.push({
      kind: "news",
      label: sig.headline,
      detail: sig.summary,
      source: `${sig.source} · ${sig.publishedAt}`,
    });
    steps.push({
      kind: "conflict",
      label: meta?.label ?? "Flagged signal",
      detail: client.topReason,
    });
  } else {
    steps.push({ kind: "conflict", label: "Routine review", detail: client.topReason });
  }
  steps.push({
    kind: "score",
    label: `Priority ${client.priorityScore} / 100`,
    detail: "Composite of news severity, portfolio exposure, value conflict and relationship sensitivity.",
  });
  return steps;
}

/**
 * Return the authored draft, or synthesise a generic two-voice draft so the
 * "next step" action is always available.
 */
export function buildDraftEmail(client: Client): DraftEmail {
  if (client.draftEmail) return client.draftEmail;

  const rec = client.recommendations[0];
  const action = rec?.action ?? "review your portfolio together at your convenience";
  return {
    subject: `A quick note on your portfolio`,
    body: {
      "values-led":
        `Dear ${client.name},\n\nI was reviewing your portfolio with your priorities in mind and wanted to reach out personally. ${client.topReason}\n\nI'd suggest we ${action.charAt(0).toLowerCase() + action.slice(1)} Nothing changes without your go-ahead — I simply want to make sure we stay ahead of it together.\n\nWarm regards,\nT. Keller`,
      "data-driven":
        `Dear ${client.name},\n\nFlagging a development relevant to your holdings: ${client.topReason}\n\nProposed action: ${action} This keeps your mandate allocation intact. Happy to walk through the detail whenever suits you.\n\nBest regards,\nT. Keller`,
    },
  };
}
