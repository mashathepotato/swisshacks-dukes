import type { Client, Voice } from "../types";
import type { RmProfile } from "./rmProfile";
import { greetingLine, spokenOpen, applyTokens } from "./rmProfile";

export type CommChannel = "email" | "call" | "meeting" | "message";
export type CommLength = "brief" | "standard" | "detailed";
export type CallSlot = "morning" | "lunch" | "afternoon" | "evening";

export interface CommPref { channel: CommChannel; length: CommLength; slots: CallSlot[]; }

export const CHANNEL_META: Record<CommChannel, { label: string; icon: string }> = {
  email: { label: "Email", icon: "" },
  call: { label: "Phone call", icon: "" },
  meeting: { label: "In person", icon: "" },
  message: { label: "Message", icon: "" },
};
export const LENGTH_META: Record<CommLength, { label: string }> = {
  brief: { label: "Brief" },
  standard: { label: "Standard" },
  detailed: { label: "Detailed" },
};
// Best windows to reach the client by phone (local time). Ordered through the day.
export const SLOT_META: Record<CallSlot, { label: string; hours: string }> = {
  morning: { label: "Morning", hours: "8–12" },
  lunch: { label: "Lunch", hours: "12–14" },
  afternoon: { label: "Afternoon", hours: "14–17" },
  evening: { label: "Evening", hours: "17–20" },
};
export const CALL_SLOTS = Object.keys(SLOT_META) as CallSlot[];

// Authored starting preferences per persona (everyone else gets the fallback).
export const COMM_DEFAULTS: Record<string, CommPref> = {
  ammann: { channel: "call", length: "brief", slots: ["morning"] },              // direct, discreet — catch him early
  schneider: { channel: "meeting", length: "detailed", slots: ["afternoon"] },   // personal, emotional
  huber: { channel: "call", length: "standard", slots: ["lunch", "evening"] },   // "call me when…"
  raeber: { channel: "email", length: "detailed", slots: ["morning", "afternoon"] }, // formal, written record
};
export const FALLBACK_PREF: CommPref = { channel: "email", length: "standard", slots: ["morning"] };
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

/**
 * Build a proposed message. The CLIENT owns channel + length (what they want to
 * receive); the RM profile owns the conventions — greeting, tone, and a sign-off
 * per method — so the same content reads in each RM's house style.
 */
export function buildMessage(client: Client, channel: CommChannel, length: CommLength, voice: Voice, rm: RmProfile): BuiltMessage {
  const action = client.recommendations[0]?.action ?? "review your portfolio together at your convenience";
  const reason = client.topReason;
  const rationale = client.recommendations[0]?.rationale ?? "";
  const v = voice === "values-led";
  const lowerAction = action.charAt(0).toLowerCase() + action.slice(1).replace(/\.$/, "");
  const shortReason = reason.split(/[.;]/)[0];
  const sign = (ch: CommChannel) => applyTokens(rm.signoff[ch], rm);

  if (channel === "email") {
    const subject = v ? "A note on your portfolio" : "Action item on your portfolio";
    const lines = [greetingLine(rm.greeting, client.name)];
    if (length !== "brief") lines.push(reason);
    lines.push(v ? `I'd like to propose we ${lowerAction}.` : `Proposed action: ${action}`);
    if (length === "detailed" && rationale) lines.push(rationale);
    lines.push(v
      ? "Nothing changes without your go-ahead — I simply want us to stay ahead of it together."
      : "This keeps your mandate allocation intact; no order is placed without your approval.");
    lines.push(sign("email"));
    const body = lines.join("\n\n");
    return { channel, format: "Email", subject, body, sendHref: mailto(subject, body), sendLabel: `Send email to ${client.name}` };
  }

  if (channel === "message") {
    const open = spokenOpen(rm.greeting, client.name);
    const core = v
      ? `wanted to flag this personally: ${shortReason}. I'd suggest we ${lowerAction}.`
      : `quick heads-up: ${shortReason}. Proposed: ${action} Nothing without your OK.`;
    const body = `${open} ${core} ${sign("message")}`;
    return { channel, format: "Message", body, sendLabel: "Send message" };
  }

  if (channel === "call") {
    const lines = [
      `Opening — "${spokenOpen(rm.greeting, client.name)} have you a couple of minutes? I wanted to reach you directly on this."`,
      `Key point — ${reason}`,
    ];
    if (length === "detailed" && rationale) lines.push(`Context — ${rationale}`);
    lines.push(`The ask — I'd recommend we ${lowerAction}; it's entirely your call.`);
    lines.push(sign("call"));
    return { channel, format: "Call script", body: lines.join("\n"), sendLabel: "Log the call" };
  }

  // meeting
  const bullets = [`• Why now — ${reason}`, `• Proposed action — ${action}`];
  if (length === "detailed" && rationale) bullets.push(`• Rationale — ${rationale}`);
  bullets.push(`• ${sign("meeting")}`);
  const body = (length === "brief" ? [bullets[1], bullets[bullets.length - 1]] : bullets).join("\n");
  return { channel, format: "Meeting talking points", body, sendLabel: "Add to meeting notes" };
}

function mailto(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
