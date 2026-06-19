// Heuristic classifier for inbound client messages. Deterministic (no LLM) so
// the demo is reproducible: any message signalling an intent to sell/exit or
// distress is flagged as high-priority for the RM. The AI never replies to the
// client — it only logs and flags.
const SELL_OR_DISTRESS =
  /\b(sell|dump|exit|withdraw|liquidat\w*|pull (?:out|my money)|get me out|get out|cash out|redeem|offload|worried|worry|nervous|scared|anxious|concerned|panic|scandal|angry|furious)\b/i;

export function classifySignal(text: string): { flagged: boolean; reason: string } {
  const match = text.match(SELL_OR_DISTRESS);
  if (match) {
    return {
      flagged: true,
      reason: `Mentions "${match[0]}" — possible intent to trade or client distress; routed to the RM.`,
    };
  }
  return { flagged: false, reason: "Informational — logged to the client's context, no action flagged." };
}
