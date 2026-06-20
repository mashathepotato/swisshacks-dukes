import type { Client, Voice } from "../types";

export type CommChannel = "email" | "call" | "meeting" | "message";
export type CommLength = "brief" | "standard" | "detailed";

export interface CommPref { channel: CommChannel; length: CommLength; }

export const CHANNEL_META: Record<CommChannel, { label: string; icon: string }> = {
  email: { label: "Email", icon: "✉️" },
  call: { label: "Phone call", icon: "📞" },
  meeting: { label: "In person", icon: "🤝" },
  message: { label: "Message", icon: "💬" },
};
export const LENGTH_META: Record<CommLength, { label: string }> = {
  brief: { label: "Brief" },
  standard: { label: "Standard" },
  detailed: { label: "Detailed" },
};

// Authored starting preferences per persona (everyone else gets the fallback).
export const COMM_DEFAULTS: Record<string, CommPref> = {
  ammann: { channel: "call", length: "brief" },       // direct, discreet
  schneider: { channel: "meeting", length: "detailed" }, // personal, emotional
  huber: { channel: "call", length: "standard" },     // "call me when…"
  raeber: { channel: "email", length: "detailed" },   // formal, written record
};
export const FALLBACK_PREF: CommPref = { channel: "email", length: "standard" };
export function defaultPref(clientId: string): CommPref {
  return COMM_DEFAULTS[clientId] ?? FALLBACK_PREF;
}

export interface BuiltMessage {
  channel: CommChannel;
  format: string;       // human label e.g. "Email", "Call script"
  subject?: string;     // email only
  body: string;
  sendHref?: string;    // mailto for email
  sendLabel: string;
}

/** Build a channel- and length-appropriate proposed message in the client's tone. */
export function buildMessage(client: Client, channel: CommChannel, length: CommLength, voice: Voice): BuiltMessage {
  const action = client.recommendations[0]?.action ?? "review your portfolio together at your convenience";
  const reason = client.topReason;
  const rationale = client.recommendations[0]?.rationale ?? "";
  const v = voice === "values-led";
  const lowerAction = action.charAt(0).toLowerCase() + action.slice(1).replace(/\.$/, "");
  const shortReason = reason.split(/[.;]/)[0];

  if (channel === "email") {
    // Keep the authored, persona-specific email for the standard length; generate variations.
    if (length === "standard" && client.draftEmail) {
      const subject = client.draftEmail.subject;
      const body = client.draftEmail.body[voice];
      return { channel, format: "Email", subject, body, sendHref: mailto(subject, body), sendLabel: `Send email to ${client.name}` };
    }
    const subject = v ? "A note on your portfolio" : "Action item on your portfolio";
    const lines = [`Dear ${client.name},`];
    if (length !== "brief") lines.push(reason);
    lines.push(v ? `I'd like to propose we ${lowerAction}.` : `Proposed action: ${action}`);
    if (length === "detailed" && rationale) lines.push(rationale);
    lines.push(v
      ? "Nothing changes without your go-ahead — I simply want us to stay ahead of it together."
      : "This keeps your mandate allocation intact; no order is placed without your approval.");
    lines.push(v ? "Warm regards,\nT. Keller" : "Best regards,\nT. Keller");
    const body = lines.join("\n\n");
    return { channel, format: "Email", subject, body, sendHref: mailto(subject, body), sendLabel: `Send email to ${client.name}` };
  }

  if (channel === "message") {
    const body = v
      ? `Hi ${client.name} — wanted to flag this personally: ${shortReason}. I'd suggest we ${lowerAction}. Happy to talk whenever. — T. Keller`
      : `Hi ${client.name} — quick heads-up: ${shortReason}. Proposed: ${action} Nothing without your OK. — T. Keller`;
    return { channel, format: "Message", body, sendLabel: "Send message" };
  }

  if (channel === "call") {
    const lines = [
      `Opening — "Hi ${client.name}, have you a couple of minutes? I wanted to reach you directly on this."`,
      `Key point — ${reason}`,
    ];
    if (length === "detailed" && rationale) lines.push(`Context — ${rationale}`);
    lines.push(`The ask — I'd recommend we ${lowerAction}; it's entirely your call.`);
    lines.push(`Close — agree the next step; place no order without your go-ahead.`);
    const body = (length === "brief" ? [lines[0], lines[1], lines[lines.length - 2], lines[lines.length - 1]] : lines).join("\n");
    return { channel, format: "Call script", body, sendLabel: "Log the call" };
  }

  // meeting
  const bullets = [`• Why now — ${reason}`, `• Proposed action — ${action}`];
  if (length === "detailed" && rationale) bullets.push(`• Rationale — ${rationale}`);
  bullets.push(`• Decision for ${client.name} — approve, adjust or hold. You execute on their word.`);
  const body = (length === "brief" ? [bullets[1], bullets[bullets.length - 1]] : bullets).join("\n");
  return { channel, format: "Meeting talking points", body, sendLabel: "Add to meeting notes" };
}

function mailto(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
