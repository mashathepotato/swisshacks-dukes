// LLM-backed "ask about this client" copilot for the client page. Given a
// client's grounding context (DNA, portfolio, behavioral trades, learning,
// conversation notes) and the RM's natural-language question, Claude answers
// from those facts. Degrades to a deterministic keyword router when there is no
// key, the call fails, or the output is empty — so the demo never hard-fails.
// Anthropic key read from demo/.env via env.mjs (imported by the server first).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.ASK_MODEL || "claude-sonnet-4-6";
const EFFORT = process.env.ASK_EFFORT || "medium"; // low | medium | high | max

export function askInfo() {
  return { engine: ANTHROPIC_READY ? "anthropic" : "heuristic", model: ANTHROPIC_READY ? MODEL : "none" };
}

// Keyword → context-section router. Returns the lines of `context` whose section
// matches the question's intent, lightly framed. Pure + deterministic.
const ROUTES = [
  { keys: ["portfolio", "holding", "position", "allocat", "risk", "mandate", "exposure"], match: /PORTFOLIO|SIGNALS|Mandate|Risk/i },
  { keys: ["value", "dna", "dislike", "care", "ethic", "belief"], match: /Values|DNA|Dislikes/i },
  { keys: ["recommend", "action", "suggest", "lead with", "pitch", "next step"], match: /RECOMMENDATIONS/i },
  { keys: ["signal", "happen", "alert", "flag"], match: /SIGNALS/i },
  { keys: ["last contact", "since", "recent", "touch", "spoke", "talked"], match: /LAST CONTACT|CONVERSATION/i },
  { keys: ["behav", "trade", "history", "pattern"], match: /BEHAVIORAL/i },
  { keys: ["learn", "feedback", "accept", "tone"], match: /LEARNING/i },
];

export function heuristicAnswer(context, question) {
  const ctx = String(context || "");
  const lines = ctx.split("\n").filter(Boolean);
  const q = String(question || "").toLowerCase();
  const name = (ctx.match(/Name:\s*([^·\n]+)/) || [])[1]?.trim() || "this client";

  const hit = ROUTES.find((r) => r.keys.some((k) => q.includes(k)));
  if (hit) {
    const picked = lines.filter((l) => hit.match.test(l));
    if (picked.length) return `Here's what's on file for ${name}:\n\n${picked.join("\n")}`;
  }
  // No match (or matched section empty): a short overview from the lead lines.
  const overview = lines.slice(0, 3).join("\n");
  return `Here's a quick overview of ${name}:\n\n${overview}\n\n(Ask about their portfolio, values, signals, recommendations, or last contact for a sharper answer.)`;
}

const SYSTEM =
  "You are a relationship manager's copilot inside a Swiss private bank. Answer the RM's question " +
  "about THIS client using ONLY the grounding facts provided below. Be concise and specific; prefer " +
  "the client's own values, holdings and history over generalities. You equip the RM — you never " +
  "address or advise the client directly, and the RM keeps the final say. If a fact isn't in the " +
  "grounding context, say so plainly rather than inventing it. Answer in plain prose (no JSON, no preamble).";

// rm → user, copilot → assistant. The Anthropic API requires the first message
// to be a user turn and roles to alternate; history here is always RM-first.
function historyMessages(history) {
  return (Array.isArray(history) ? history : [])
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ role: t.role === "copilot" ? "assistant" : "user", text: t.text.trim() }));
}

function textOf(data) {
  return (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function anthropicAsk({ context, question, history }) {
  const msgs = historyMessages(history).map((m) => ({ role: m.role, content: m.text }));
  msgs.push({ role: "user", content: `GROUNDING CONTEXT\n${context || "(none provided)"}\n\nRM QUESTION\n${question}` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      messages: msgs,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const answer = textOf(await res.json());
  if (!answer) throw new Error("empty model output");
  return { answer, engine: "anthropic", model: MODEL };
}

export async function ask({ client, context, question, history }) {
  const q = String(question || "").trim();
  const fallback = { answer: heuristicAnswer(context, q), engine: "heuristic", model: "none" };
  if (!q) return fallback;
  if (!ANTHROPIC_READY) return fallback;
  try {
    return await anthropicAsk({ context, question: q, history });
  } catch (err) {
    console.warn(`[ask] ${MODEL} failed, falling back to heuristic: ${err.message}`);
    return fallback;
  }
}
