// Pluggable financial-relevance assessor.
//
// Engine resolution:
//   - "anthropic" : the Anthropic Messages API — used when ANTHROPIC_API_KEY is
//                   set (the default in that case). Fast small model by default.
//   - "claude"    : the local Claude CLI, headless — uses this machine's auth,
//                   no API key.
//   - "phoeniqs"  : an OpenAI-compatible LLM (the hackathon backend) — used when
//                   PHOENIQS_API_KEY is set. Swap the URL/model for any other
//                   OpenAI-compatible endpoint; this is the pluggable seam.
//   - "heuristic" : deterministic regex fallback (no key needed) so the app
//                   always works; clearly labelled as not-the-LLM.
//
// assessBatch(candidates) takes pre-filtered articles ({id,title,summary}) and
// returns Map<id, {bucket, confidence, reason, affected}>.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { THEME_KEYS, heuristicThemes } from "./classify.mjs";

const execFileAsync = promisify(execFile);

const PHOENIQS_KEY = process.env.PHOENIQS_API_KEY || "";
const PHOENIQS_URL = process.env.PHOENIQS_API_URL || "https://maas.phoeniqs.com/v1";
const PHOENIQS_MODEL = process.env.PHOENIQS_MODEL || "inference-gpt-oss-120b";
const PHOENIQS_READY = Boolean(PHOENIQS_KEY) && !PHOENIQS_KEY.startsWith("your_");

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const CLAUDE_MODEL = process.env.ASSESSOR_CLAUDE_MODEL || "haiku";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
// Fast tagging stage → small/fast model by default; env-overridable.
const ANTHROPIC_MODEL =
  process.env.ASSESSOR_ANTHROPIC_MODEL || process.env.DIGEST_MODEL_SMALL || "claude-haiku-4-5-20251001";

// Engine resolution: explicit ASSESSOR_ENGINE wins; otherwise default to the
// Anthropic API when its key is present, then the local Claude CLI.
const ENGINE =
  process.env.ASSESSOR_ENGINE || (ANTHROPIC_READY ? "anthropic" : "claude"); // anthropic | claude | phoeniqs | heuristic

export function assessorInfo() {
  const model =
    ENGINE === "anthropic" ? ANTHROPIC_MODEL :
    ENGINE === "claude" ? `claude/${CLAUDE_MODEL}` :
    ENGINE === "phoeniqs" ? PHOENIQS_MODEL :
    "regex-keyword";
  return { engine: ENGINE, model, llmReady: ENGINE !== "heuristic" };
}

const SYSTEM =
  "You tag investment news for a wealth-advisory dashboard. For each article, pick the applicable " +
  `CORE-VALUE THEMES from this fixed list: ${THEME_KEYS.join(", ")}. ` +
  "Also set marketMovement=true when it concerns overall market or index moves (e.g. S&P 500, a broad " +
  "sell-off or rally), not a single company. Assign only themes that genuinely apply; use [] if none. " +
  "Respond with ONLY a minified JSON array.";

function buildUser(candidates) {
  const lines = candidates.map(
    (c, i) => `${i}. [${c.id}] ${c.title}${c.summary ? " — " + c.summary.slice(0, 160) : ""}`
  );
  return (
    `Tag these ${candidates.length} articles.\n\n${lines.join("\n")}\n\n` +
    `Return a JSON array, one object per article in the same order, each: ` +
    `{"id":"<id>","themes":[subset of: ${THEME_KEYS.join("|")}],` +
    `"marketMovement":<true|false>,"confidence":<0..1>,"reason":"<=15 words"}`
  );
}

function parseArray(content) {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("no JSON array in LLM output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function assessWithLlm(candidates) {
  const res = await fetch(`${PHOENIQS_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PHOENIQS_KEY}` },
    body: JSON.stringify({
      model: PHOENIQS_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUser(candidates) },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Phoeniqs ${res.status}: ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return toThemeMap(parseArray(content), "phoeniqs");
}

function toThemeMap(arr, engine) {
  const out = new Map();
  for (const v of arr) {
    if (!v?.id) continue;
    const themes = Array.isArray(v.themes) ? v.themes.filter((t) => THEME_KEYS.includes(t)) : [];
    out.set(String(v.id), {
      themes,
      marketMovement: Boolean(v.marketMovement) || themes.includes("market-movement"),
      confidence: typeof v.confidence === "number" ? v.confidence : 0.5,
      reason: String(v.reason || "").slice(0, 160),
      engine,
    });
  }
  return out;
}

// Local Claude CLI, headless. Uses this machine's Claude auth — no API key.
async function assessWithClaude(candidates) {
  const prompt = `${SYSTEM}\n\n${buildUser(candidates)}`;
  const { stdout } = await execFileAsync(
    CLAUDE_BIN,
    ["-p", prompt, "--output-format", "json", "--model", CLAUDE_MODEL, "--allowed-tools", ""],
    { timeout: 120000, maxBuffer: 16 * 1024 * 1024 }
  );
  const obj = JSON.parse(stdout);
  if (obj.is_error) throw new Error(`claude: ${obj.subtype || "error"}`);
  return toThemeMap(parseArray(obj.result || ""), "claude");
}

// Anthropic Messages API, using ANTHROPIC_API_KEY from the environment.
async function assessWithAnthropic(candidates) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: buildUser(candidates) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  const content = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return toThemeMap(parseArray(content), "anthropic");
}

// Deterministic fallback: keyword-based theme tagging (Stage 2 without an LLM).
function assessHeuristic(candidates) {
  const out = new Map();
  for (const c of candidates) {
    const t = heuristicThemes(c);
    out.set(c.id, {
      themes: t.themes,
      marketMovement: t.marketMovement,
      confidence: t.themes.length ? 0.5 : 0.3,
      reason: t.themes.length ? `keyword themes: ${t.themes.slice(0, 3).join(", ")}` : "no theme keywords",
      engine: "heuristic",
    });
  }
  return out;
}

export async function assessBatch(candidates) {
  if (!candidates.length) return new Map();
  if (ENGINE === "heuristic") return assessHeuristic(candidates);
  if (ENGINE === "phoeniqs" && !PHOENIQS_READY) {
    console.warn("[assessor] phoeniqs selected but no key; using heuristic");
    return assessHeuristic(candidates);
  }
  if (ENGINE === "anthropic" && !ANTHROPIC_READY) {
    console.warn("[assessor] anthropic selected but no key; using heuristic");
    return assessHeuristic(candidates);
  }
  try {
    return ENGINE === "anthropic"
      ? await assessWithAnthropic(candidates)
      : ENGINE === "claude"
      ? await assessWithClaude(candidates)
      : await assessWithLlm(candidates);
  } catch (err) {
    // Never break the page on an LLM hiccup — degrade to the heuristic and flag it.
    console.warn(`[assessor] ${ENGINE} failed, falling back to heuristic: ${err.message}`);
    const out = assessHeuristic(candidates);
    for (const v of out.values()) v.engine = "heuristic-fallback";
    return out;
  }
}
