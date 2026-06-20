import type { Voice } from "../types";
import type { CommChannel } from "./commPrefs";

export type Greeting = "formal" | "warm" | "byName";

export interface RmProfile {
  name: string;
  initials: string;
  defaultVoice: Voice;
  greeting: Greeting;
  /** The RM's sign-off / closing convention, per communication method. */
  signoff: Record<CommChannel, string>;
}

export const DEFAULT_RM: RmProfile = {
  name: "T. Keller",
  initials: "TK",
  defaultVoice: "values-led",
  greeting: "formal",
  signoff: {
    email: "Warm regards,\n{name}",
    message: "— {initials}",
    call: "Close — agree the next step; place no order without their go-ahead.",
    meeting: "Decision is the client's — you execute on their word.",
  },
};

export const GREETING_META: Record<Greeting, { label: string; sample: string }> = {
  formal: { label: "Formal", sample: "Dear {name}," },
  warm: { label: "Warm", sample: "Hi {name}," },
  byName: { label: "By name", sample: "Good morning {name}," },
};

/** Written greeting (email). */
export function greetingLine(g: Greeting, name: string): string {
  if (g === "warm") return `Hi ${name},`;
  if (g === "byName") return `Good morning ${name},`;
  return `Dear ${name},`;
}

/** Spoken opener (call / message). */
export function spokenOpen(g: Greeting, name: string): string {
  if (g === "warm") return `Hi ${name},`;
  if (g === "byName") return `Good morning ${name},`;
  return `Good day ${name},`;
}

export function applyTokens(tmpl: string, rm: RmProfile): string {
  return tmpl.replace(/\{name\}/g, rm.name).replace(/\{initials\}/g, rm.initials);
}
