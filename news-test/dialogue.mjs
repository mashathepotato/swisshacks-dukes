// Splits a single conversation transcript into an RM/Client dialogue using
// Claude (Haiku). Heuristic fallback returns one "Conversation" turn so the
// demo never hard-fails. Anthropic key read from demo/.env via env.mjs.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL = process.env.DIALOGUE_MODEL || process.env.DIGEST_MODEL_SMALL || "claude-haiku-4-5-20251001";

export function dialogueInfo() {
  return { engine: ANTHROPIC_READY ? "anthropic" : "heuristic", model: ANTHROPIC_READY ? MODEL : "none" };
}

export function heuristicDialogue(transcript) {
  return { model: "heuristic", turns: [{ speaker: "Conversation", text: String(transcript || "").trim() }] };
}

const VALID = new Set(["RM", "Client"]);

export function toLabeledTranscript(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return "";
  if (turns.length === 1 && turns[0]?.speaker === "Conversation") return String(turns[0].text || "").trim();
  return turns.map((t) => `${VALID.has(t.speaker) ? t.speaker : "RM"}: ${String(t.text || "").trim()}`).join("\n");
}

const SYSTEM =
  "You are given a raw single-stream transcript of a wealth-management meeting between a " +
  "relationship manager (RM) and a client, captured on one microphone with no speaker labels. " +
  "Split it into turns and attribute each to RM or Client using content cues (the RM asks " +
  "questions, advises, and references the portfolio; the client states personal views, " +
  "preferences and circumstances). Respond with ONLY a minified JSON object: " +
  '{"turns":[{"speaker":"RM"|"Client","text":"<the words for this turn, verbatim>"}]}.';

function parseObj(content) {
  const s = content.indexOf("{"); const e = content.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no JSON object in model output");
  return JSON.parse(content.slice(s, e + 1));
}

async function anthropicDialogue(transcript) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content: `Transcript:\n${transcript}` }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const obj = parseObj(text);
  const turns = (Array.isArray(obj.turns) ? obj.turns : [])
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ speaker: VALID.has(t.speaker) ? t.speaker : "Client", text: t.text.trim() }));
  if (!turns.length) throw new Error("no turns parsed");
  return { model: MODEL, turns };
}

export async function dialogue({ transcript }) {
  if (!transcript || !transcript.trim()) return heuristicDialogue(transcript || "");
  if (!ANTHROPIC_READY) return heuristicDialogue(transcript);
  try {
    return await anthropicDialogue(transcript);
  } catch (err) {
    console.warn(`[dialogue] ${MODEL} failed, falling back to heuristic: ${err.message}`);
    return heuristicDialogue(transcript);
  }
}
