import { DnaProfile, SwapResult, Trace, Voice } from "../../shared/domain";

export interface MessageArgs {
  dna: DnaProfile;
  alert: Trace;
  swap: SwapResult | null;
  voice: Voice;
  cacheKey: string;
}

export interface MessageDeps {
  chat: (system: string, user: string) => Promise<string>;
  cache: Record<string, string>;
  live: boolean;
}

export function buildMessagePrompt(args: Omit<MessageArgs, "cacheKey">): { system: string; user: string } {
  const { dna, alert, swap, voice } = args;
  const voiceInstruction =
    voice === "values-led"
      ? "Write in a warm, values-led, inspiring register that speaks to the client's personal mission."
      : "Write in a precise, data-driven register with concrete figures and minimal emotion.";
  const swapLine = swap?.chosen
    ? `Proposed same-sector swap: SELL ${swap.sell.issuer} -> BUY ${swap.chosen.issuer} (CIO view: ${swap.chosen.cioView}).`
    : `No compliant swap was found; recommend flagging for RM review rather than inventing one.`;
  const system =
    "You are an assistant drafting a relationship manager's advisory note to a private-banking client. " +
    "You never instruct the client to trade; you propose and await the RM's approval. Output only the message body.";
  const user =
    `Client: ${dna.name} (${dna.mandate} mandate).\n` +
    `Situation: ${alert.claim}.\n` +
    `${swapLine}\n` +
    `Constraint: the investment strategy does not change; personalisation is at the asset level only.\n` +
    `${voiceInstruction}\n` +
    `Keep it under 160 words. Sign as "Sarah" (the RM).`;
  return { system, user };
}

export async function draftMessage(args: MessageArgs, deps: MessageDeps): Promise<{ text: string; source: "live" | "cache" }> {
  const cached = deps.cache[args.cacheKey];
  if (!deps.live) {
    return { text: cached ?? "(no cached draft available)", source: "cache" };
  }
  try {
    const { system, user } = buildMessagePrompt(args);
    const text = await deps.chat(system, user);
    if (!text || !text.trim()) throw new Error("empty draft");
    return { text, source: "live" };
  } catch {
    return { text: cached ?? "(draft unavailable)", source: "cache" };
  }
}
