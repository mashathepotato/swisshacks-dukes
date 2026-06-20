// DNA-extraction seam for conversation transcripts. Mirrors assessor.mjs:
//   phoeniqs (OpenAI-compatible LLM) | heuristic (deterministic fallback).
// Always degrades to the heuristic so the demo never hard-fails.

const PHOENIQS_KEY = process.env.PHOENIQS_API_KEY || "";
const PHOENIQS_URL = process.env.PHOENIQS_API_URL || "https://maas.phoeniqs.com/v1";
const PHOENIQS_MODEL = process.env.PHOENIQS_MODEL || "inference-gpt-oss-120b";
const PHOENIQS_READY = Boolean(PHOENIQS_KEY) && !PHOENIQS_KEY.startsWith("your_");
const ENGINE = process.env.DISTILL_ENGINE || (PHOENIQS_READY ? "phoeniqs" : "heuristic");

// The fixed frontend ThemeId universe (must match frontend/src/types.ts ThemeId).
export const THEME_IDS = [
  "environmental", "us_tech_bullish", "defensive", "income", "reputation", "healthcare",
];

// Deterministic keyword → DNA mapping.
const KEYWORDS = [
  { theme: "reputation",     re: /reputation|exploitation|scandal|labour|press/i,
    value: "Reputation = financial risk", dislike: "Labour exploitation" },
  { theme: "environmental",  re: /environment|reforest|climate|sustainab|palm.?oil|deforest/i,
    value: "Environmental impact", dislike: null },
  { theme: "healthcare",     re: /health|pharma|research|disease|illness|foundation/i,
    value: "Funds medical research", dislike: null },
  { theme: "us_tech_bullish",re: /\bus tech\b|silicon valley|nvidia|ai stock|tech hype/i,
    value: "Open to US tech", dislike: "US tech hype" },
  { theme: "defensive",      re: /conservative|defensive|capital preservation|low risk|cautious/i,
    value: "Capital preservation", dislike: null },
  { theme: "income",         re: /income|dividend|yield|coupon|cash flow/i,
    value: "Income focus", dislike: null },
];

export function distillInfo() {
  return { engine: ENGINE, model: ENGINE === "phoeniqs" ? PHOENIQS_MODEL : "keyword", llmReady: ENGINE !== "heuristic" };
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function distillHeuristic({ clientId, transcript, rmName, clientContact, date }) {
  const sents = sentences(transcript);
  const affinities = [];
  const values = new Set();
  const dislikes = new Set();
  const receipts = [];
  for (const k of KEYWORDS) {
    const hit = sents.find((s) => k.re.test(s));
    if (!hit) continue;
    affinities.push({ theme: k.theme, fromWeight: 0, toWeight: 0.7 });
    if (k.value) values.add(k.value);
    // Add dislike only if: whole-phrase matches (case-insensitive) AND sentence contains negation cue
    if (k.dislike && new RegExp(k.dislike, "i").test(hit) && /\b(not|no|never|unacceptable|avoid|against|averse|don't|won't)\b/i.test(hit)) {
      dislikes.add(k.dislike);
    }
    receipts.push({
      kind: "crm",
      sourceId: `transcript:${clientId}:${date}`,
      quote: hit,
      date,
    });
  }
  const text =
    `Conversation with ${clientContact} on ${date}. ` +
    (sents.slice(0, 2).join(" ") || transcript.slice(0, 200));
  return {
    note: { date, medium: "In-person (conversation)", rmName, clientContact, text },
    dnaDeltas: { values: [...values], dislikes: [...dislikes], affinities },
    receipts,
  };
}

export function parseLlmDistill(content, { clientId, transcript, rmName, clientContact, date }) {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in LLM output");
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  const affinities = (Array.isArray(obj.affinities) ? obj.affinities : [])
    .filter((a) => THEME_IDS.includes(a?.theme))
    .map((a) => ({ theme: a.theme, fromWeight: 0, toWeight: clamp01(a.weight) }));
  const receipts = (Array.isArray(obj.receipts) ? obj.receipts : [])
    .filter((q) => typeof q === "string" && transcript.includes(q))
    .map((q) => ({ kind: "crm", sourceId: `transcript:${clientId}:${date}`, quote: q, date }));
  return {
    note: {
      date, medium: "In-person (conversation)", rmName, clientContact,
      text: String(obj.note_text || "").trim() || `Conversation with ${clientContact} on ${date}.`,
    },
    dnaDeltas: {
      values: (Array.isArray(obj.values) ? obj.values : []).map(String),
      dislikes: (Array.isArray(obj.dislikes) ? obj.dislikes : []).map(String),
      affinities,
    },
    receipts,
  };
}

function clamp01(n) {
  const v = typeof n === "number" ? n : 0.5;
  return Math.max(0, Math.min(1, v));
}

const SYSTEM =
  "You distill a wealth-management client conversation into structured Client DNA. " +
  `Pick affinity themes ONLY from this fixed list: ${THEME_IDS.join(", ")}. ` +
  "Respond with ONLY a minified JSON object: " +
  `{"note_text":"<=60 word CRM note","values":[...],"dislikes":[...],` +
  `"affinities":[{"theme":<one of the list>,"weight":0..1}],` +
  `"receipts":["<verbatim sentence copied EXACTLY from the transcript>"]}.`;

async function distillWithLlm(args) {
  const res = await fetch(`${PHOENIQS_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PHOENIQS_KEY}` },
    body: JSON.stringify({
      model: PHOENIQS_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Transcript:\n${args.transcript}` },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`Phoeniqs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  return parseLlmDistill(data?.choices?.[0]?.message?.content || "", args);
}

export async function distill(args) {
  if (ENGINE === "heuristic") return distillHeuristic(args);
  if (ENGINE === "phoeniqs" && !PHOENIQS_READY) {
    console.warn("[distill] phoeniqs selected but no key; using heuristic");
    return distillHeuristic(args);
  }
  try {
    return await distillWithLlm(args);
  } catch (err) {
    console.warn(`[distill] ${ENGINE} failed, falling back to heuristic: ${err.message}`);
    return distillHeuristic(args);
  }
}
