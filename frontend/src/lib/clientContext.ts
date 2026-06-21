import type { Client, PreferenceModel } from "../types";
import { PORTFOLIOS } from "../data/portfolio";
import { behavioralForClient } from "./behavioral";
import { formatMoney } from "./format";

interface ContextOpts {
  model?: PreferenceModel;
  notes?: { text: string; date: string }[];
}

/** Assembles a plain-text grounding block describing everything on file for a
 *  client, for the /api/ask copilot. Pure: portfolio/behavioral come from data
 *  modules; learning + notes are passed in from React stores by the caller. */
export function buildClientContext(client: Client, opts: ContextOpts): string {
  const lines: string[] = [];

  const aff = (client.affinities || [])
    .map((a) => `${a.theme}=${(a.weight * (a.polarity ?? 1)).toFixed(2)}`)
    .join(", ");
  lines.push(
    `DNA — Name: ${client.name} · Archetype: ${client.archetype} · Mandate: ${client.mandate} · Risk: ${client.riskProfile} · Tenure: ${client.tenureYears}y · Priority: ${client.priorityScore}`
  );
  if (client.commStyle) lines.push(`Comm style: ${client.commStyle}`);
  if (client.values?.length) lines.push(`Values: ${client.values.join("; ")}`);
  if (client.dislikes?.length) lines.push(`Dislikes: ${client.dislikes.join("; ")}`);
  if (aff) lines.push(`Signed value affinities (−1..+1; negative = actively avoids): ${aff}`);
  if (client.topReason) lines.push(`Current situation: ${client.topReason}`);
  if (client.lastMessageAt) lines.push(`LAST CONTACT: ${client.lastMessageAt}`);

  const holdings = PORTFOLIOS[client.mandate] || [];
  if (holdings.length) {
    const total = holdings.reduce((s, h) => s + h.currentCHF, 0);
    const top = [...holdings].sort((a, b) => b.currentCHF - a.currentCHF).slice(0, 8);
    lines.push(
      `PORTFOLIO (total ${formatMoney(total)}): ` +
        top.map((h) => `${h.issuer} (${h.industryGroup}) ${formatMoney(h.currentCHF)}`).join("; ")
    );
  }

  if (client.signals?.length) {
    lines.push("SIGNALS: " + client.signals.map((s) => `${s.headline} — ${s.summary} (sev ${s.severity})`).join(" | "));
  }
  if (client.recommendations?.length) {
    lines.push("RECOMMENDATIONS: " + client.recommendations.map((r) => `${r.action} — ${r.rationale}`).join(" | "));
  }

  const traits = behavioralForClient(client.id);
  if (traits.length) {
    lines.push("BEHAVIORAL (from real trades): " + traits.map((t) => `${t.label} — ${t.detail}`).join(" | "));
  }

  if (opts.model && opts.model.sampleSize > 0) {
    const m = opts.model;
    lines.push(
      `LEARNING: ${Math.round(m.acceptanceRate * 100)}% acceptance over ${m.sampleSize} decisions` +
        (m.preferredVoice ? ` · prefers ${m.preferredVoice} tone` : "")
    );
  }

  if (opts.notes?.length) {
    lines.push("CONVERSATION NOTES: " + opts.notes.slice(0, 5).map((n) => `(${n.date}) ${n.text}`).join(" | "));
  }

  return lines.join("\n");
}
