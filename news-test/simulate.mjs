// LLM-backed client-reaction simulator for "Rehearse a proposal". Given a
// client's DNA (values, mandate, communication style, signed value-affinities)
// and an RM's proposed action, Claude predicts how THIS client would react and
// how the RM should frame it. The frontend computes a deterministic baseline
// first; this seam refines it with a slightly-higher-reasoning model (adaptive
// thinking + medium effort). Degrades to the baseline when there is no key, the
// call fails, or the output is malformed — so the demo never hard-fails.
// Anthropic key read from demo/.env via env.mjs.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.SIMULATE_MODEL || "claude-opus-4-8";
const EFFORT = process.env.SIMULATE_EFFORT || "medium"; // low | medium | high | max

export function simulateInfo() {
  return { engine: ANTHROPIC_READY ? "anthropic" : "heuristic", model: ANTHROPIC_READY ? MODEL : "none" };
}

// Trust/alignment trajectory derived from acceptance — kept in step with the
// frontend's heuristic so the chart re-bases off the LLM's acceptance estimate.
const clamp = (n) => Math.max(2, Math.min(98, Math.round(n)));
function trajectoryFrom(acceptance, baseNow) {
  const base = Number.isFinite(baseNow) ? baseNow : 60;
  const dir = acceptance > 0.5 ? 1 : -1;
  const mag = Math.round(Math.abs(acceptance - 0.5) * 2 * 18);
  return [
    { label: "Now", trust: base, alignment: base - 5 },
    { label: "Q1", trust: clamp(base + dir * mag * 0.5), alignment: clamp(base - 5 + dir * mag * 0.7) },
    { label: "Q2", trust: clamp(base + dir * mag * 0.8), alignment: clamp(base - 5 + dir * mag) },
    { label: "Q3", trust: clamp(base + dir * mag), alignment: clamp(base - 5 + dir * mag * 1.1) },
  ];
}

function profileOf(client) {
  const aff = (client.affinities || [])
    .map((a) => `${a.theme}=${(a.weight * (a.polarity ?? 1)).toFixed(2)}`)
    .join(", ");
  return [
    `Name: ${client.name}`,
    client.archetype && `Archetype: ${client.archetype}`,
    `Mandate: ${client.mandate} · Risk profile: ${client.riskProfile}`,
    client.commStyle && `Communication style: ${client.commStyle}`,
    client.values?.length && `Core values: ${client.values.join("; ")}`,
    client.dislikes?.length && `Dislikes: ${client.dislikes.join("; ")}`,
    aff && `Value affinities (signed −1..+1; a negative value means the client actively AVOIDS that theme): ${aff}`,
    client.topHoldings?.length && `Notable holdings: ${client.topHoldings.join(", ")}`,
    client.topReason && `Current situation: ${client.topReason}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM =
  "You are a private-banking client-reaction simulator. Given a wealth-management client's profile " +
  "(values, risk mandate, communication style, and signed value-affinities) and a relationship manager's " +
  "proposed action, predict how THIS specific client would react and how the RM should approach it. " +
  "You equip the RM — you never advise the client directly, and the RM keeps the final say. " +
  "Ground every judgement in the client's stated values and affinities: a negative signed affinity means the " +
  "client actively avoids that theme, so a proposal pushing into it should lower acceptance. A deterministic " +
  "baseline estimate is provided; correct it where the profile warrants and keep what is already right. " +
  "Respond with ONLY a minified JSON object: " +
  '{"acceptanceProbability":<number 0..1>,"predictedReaction":"1-2 sentences, specific to this client",' +
  '"objections":["likely objection", "..."],"bestFraming":"how the RM should frame this proposal",' +
  '"nextStep":"the concrete next action for the RM"}.';

function parseObj(content) {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no JSON object in model output");
  return JSON.parse(content.slice(s, e + 1));
}

async function anthropicSimulate(client, proposal, baseline) {
  const user =
    `CLIENT PROFILE\n${profileOf(client)}\n\n` +
    `RM PROPOSAL\n"${proposal}"\n\n` +
    `DETERMINISTIC BASELINE (refine or correct this):\n` +
    JSON.stringify({
      acceptanceProbability: baseline.acceptanceProbability,
      predictedReaction: baseline.predictedReaction,
      objections: baseline.objections,
      bestFraming: baseline.bestFraming,
      nextStep: baseline.nextStep,
    });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const obj = parseObj(text);

  let acc = Number(obj.acceptanceProbability);
  if (!Number.isFinite(acc)) throw new Error("no acceptanceProbability in model output");
  acc = Math.max(0.02, Math.min(0.98, acc));

  const objections = Array.isArray(obj.objections)
    ? obj.objections.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
    : [];

  return {
    acceptanceProbability: acc,
    predictedReaction: String(obj.predictedReaction || "").trim() || baseline.predictedReaction,
    objections: objections.length ? objections : baseline.objections,
    bestFraming: String(obj.bestFraming || "").trim() || baseline.bestFraming,
    nextStep: String(obj.nextStep || "").trim() || baseline.nextStep,
    trajectory: trajectoryFrom(acc, baseline?.trajectory?.[0]?.trust),
    engine: "anthropic",
    model: MODEL,
  };
}

export async function simulate({ client, proposal, baseline }) {
  const fallback = { ...(baseline || {}), engine: "heuristic", model: "none" };
  if (!client || !proposal || !String(proposal).trim() || !baseline) return fallback;
  if (!ANTHROPIC_READY) return fallback;
  try {
    return await anthropicSimulate(client, String(proposal), baseline);
  } catch (err) {
    console.warn(`[simulate] ${MODEL} failed, falling back to heuristic: ${err.message}`);
    return fallback;
  }
}
