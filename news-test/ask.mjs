// LLM-backed "ask about this client" copilot for the client page. Given a
// client's grounding context (DNA, portfolio, behavioral trades, learning,
// conversation notes) and the RM's natural-language question, Claude answers
// from those facts. Degrades to a deterministic keyword router when there is no
// key, the call fails, or the output is empty — so the demo never hard-fails.
// Anthropic key read from demo/.env via env.mjs (imported by the server first).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.ASK_MODEL || "claude-opus-4-8";
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

export async function ask({ client, context, question, history }) {
  const q = String(question || "").trim();
  const heuristic = { answer: heuristicAnswer(context, q), engine: "heuristic", model: "none" };
  if (!q) return { ...heuristic, answer: heuristicAnswer(context, "") };
  if (!ANTHROPIC_READY) return heuristic;
  // Anthropic path lands in Task 2.
  return heuristic;
}
