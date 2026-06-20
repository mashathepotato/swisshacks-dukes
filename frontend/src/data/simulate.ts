import type { Client, SimulationResult, ThemeId } from "../types";

/**
 * Mock client-twin simulator. Heuristically predicts how a client would react
 * to an RM proposal phrased in natural language. Stand-in for the real
 * Forecast Agent (LLM + tools) — same shape of output. Reasons over the client
 * value-axes (us-exposure carries a polarity: +1 = seeks US, -1 = avoids it).
 */
export function simulateProposal(client: Client, proposal: string): SimulationResult {
  const p = proposal.toLowerCase();
  const affinity = (t: ThemeId) => client.affinities.find((a) => a.theme === t)?.weight ?? 0;
  // signed conviction: weight × polarity (e.g. +0.9 US-bull, −0.85 US-averse)
  const signed = (t: ThemeId) => {
    const a = client.affinities.find((x) => x.theme === t);
    return a ? a.weight * (a.polarity ?? 1) : 0;
  };

  // crude intent detection
  const mentions = (...kw: string[]) => kw.some((k) => p.includes(k));
  const isUSTech = mentions("nvidia", "ai", "tech", "us equit", "semiconductor", "microsoft", "apple");
  const isReduce = mentions("reduce", "cut", "trim", "exit", "sell", "divest", "drop", "dump");
  const isIncrease = mentions("increase", "add", "buy", "overweight", "more");
  const isESG = mentions("green", "esg", "sustainab", "deforest", "climate", "environment");
  const isDividend = mentions("dividend", "income", "coupon", "yield");

  let acceptance = 0.5;
  const objections: string[] = [];
  const reasonBits: string[] = [];

  // adding US tech/AI: welcomed by US-seekers, resisted by the US-averse
  if (isUSTech && isIncrease) {
    const usApp = signed("us-exposure");
    acceptance += usApp * 0.7;
    if (usApp < -0.2) {
      objections.push("Sees US tech/AI as speculative; explicitly wants to avoid Silicon Valley hype.");
      reasonBits.push("the proposal pushes into US tech the client distrusts");
    } else if (usApp > 0.3) {
      reasonBits.push("the client is already bullish on US tech");
    }
  }

  // cutting US tech: the US-averse welcome it; a US-bull resists
  if (isUSTech && isReduce) {
    const usApp = signed("us-exposure");
    acceptance += -usApp * 0.5;
    if (usApp > 0.6) objections.push("Reluctant to cut a conviction position while momentum is strong.");
  }

  if (isESG) {
    acceptance += affinity("environmental") * 0.6;
    if (affinity("environmental") > 0.6) reasonBits.push("it aligns tightly with the client's environmental mission");
  }

  if (isDividend) {
    // home-anchored, conservative clients value predictable income
    acceptance += affinity("geographic-anchoring") * 0.4;
    if (affinity("geographic-anchoring") > 0.6) reasonBits.push("it preserves the predictable, home-anchored income the client relies on");
  }

  // reputation-/ethics-sensitive clients welcome exiting tainted names
  if (isReduce && (affinity("reputation-sensitivity") > 0.6 || affinity("social-ethics") > 0.6)) {
    acceptance += 0.25;
    reasonBits.push("the client treats reputational risk as financial risk and welcomes distancing");
  }

  acceptance = Math.max(0.05, Math.min(0.95, acceptance));

  // best framing by what the client values
  const VALUE_LED: ThemeId[] = ["environmental", "personal-cause", "philanthropy", "social-ethics", "reputation-sensitivity"];
  const valuesLed = client.affinities.some((a) => VALUE_LED.includes(a.theme) && a.weight > 0.6);
  const bestFraming = valuesLed
    ? "Lead with values and personal narrative; tie the move to what the client cares about, then show the numbers."
    : "Lead with hard numbers — risk, yield, downside protection — and keep the tone calm and non-promotional.";

  const predictedReaction =
    acceptance > 0.66
      ? `Likely receptive — ${reasonBits[0] ?? "the move fits their profile"}.`
      : acceptance > 0.4
      ? "Cautiously open, but will want reassurance before committing."
      : `Likely to push back — ${reasonBits[0] ?? "the move cuts against their stated preferences"}.`;

  const nextStep =
    acceptance > 0.66
      ? "Send a short personalised note proposing the change; offer a 15-min call to confirm."
      : acceptance > 0.4
      ? "Open with a question, not a pitch — surface the trigger event and ask how they'd like to respond."
      : "Do not push this version. Prepare an alternative that respects their constraint and re-test it here first.";

  if (objections.length === 0)
    objections.push("Wants to understand why now, and what it changes about their long-term plan.");

  // trajectory: trust & alignment over the next 3 quarters under this proposal
  const base = 60 + Math.round(affinity("geographic-anchoring") * 10);
  const dir = acceptance > 0.5 ? 1 : -1;
  const mag = Math.round((Math.abs(acceptance - 0.5) * 2) * 18);
  const trajectory = [
    { label: "Now", trust: base, alignment: base - 5 },
    { label: "Q1", trust: clamp(base + dir * mag * 0.5), alignment: clamp(base - 5 + dir * mag * 0.7) },
    { label: "Q2", trust: clamp(base + dir * mag * 0.8), alignment: clamp(base - 5 + dir * mag) },
    { label: "Q3", trust: clamp(base + dir * mag), alignment: clamp(base - 5 + dir * mag * 1.1) },
  ];

  return {
    acceptanceProbability: acceptance,
    predictedReaction,
    objections,
    bestFraming,
    nextStep,
    trajectory,
  };
}

const clamp = (n: number) => Math.max(2, Math.min(98, Math.round(n)));
