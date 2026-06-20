// Dynamic transcript digest. Live pass = Claude Haiku (no history); finalize
// pass = complexity-routed Haiku/Sonnet with the client's CRM history as
// context. Always degrades to a deterministic heuristic so the demo never
// hard-fails. Anthropic key is read from demo/.env via news-test/env.mjs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_READY = Boolean(ANTHROPIC_KEY) && !ANTHROPIC_KEY.startsWith("your_");
const MODEL_SMALL = process.env.DIGEST_MODEL_SMALL || "claude-haiku-4-5-20251001";
const MODEL_LARGE = process.env.DIGEST_MODEL_LARGE || "claude-sonnet-4-6";
const FINALIZE_WORDS = Number(process.env.FINALIZE_WORDS || 350);
const FINALIZE_TOPICS = Number(process.env.FINALIZE_TOPICS || 3);

// Topic detection mirrors the theme keywords used in distill.mjs.
const TOPIC_RES = [
  ["reputation", /reputation|exploitation|scandal|labour|press/i],
  ["environmental", /environment|reforest|climate|sustainab|palm.?oil|deforest/i],
  ["healthcare", /health|pharma|research|disease|illness|foundation/i],
  ["us_tech_bullish", /\bus tech\b|silicon valley|nvidia|ai stock|tech hype/i],
  ["defensive", /conservative|defensive|capital preservation|low risk|cautious/i],
  ["income", /income|dividend|yield|coupon|cash flow/i],
];

function detectTopics(transcript) {
  return TOPIC_RES.filter(([, re]) => re.test(transcript)).map(([t]) => t);
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function chooseModel(transcript) {
  const words = wordCount(transcript);
  const topics = detectTopics(transcript).length;
  const large = words >= FINALIZE_WORDS || topics >= FINALIZE_TOPICS;
  return { model: large ? MODEL_LARGE : MODEL_SMALL, tier: large ? "large" : "small" };
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function heuristicDigest(transcript, mode = "live") {
  const sents = sentences(transcript || "");
  const topics = detectTopics(transcript || "");
  const summary = sents.slice(0, 2).join(" ") || (transcript || "").slice(0, 160);
  return { model: "heuristic", mode, summary, bullets: sents.slice(0, 4), topics };
}

// Minimal quote-aware CSV parser (CRM notes contain commas).
function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function loadHistory(clientId, max = 8) {
  try {
    const file = join(__dirname, "..", "data", "crm", `crm_${clientId}.csv`);
    const rows = parseCsv(readFileSync(file, "utf8"));
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const di = header.indexOf("date");
    const ni = header.indexOf("note");
    if (ni === -1) return [];
    const notes = rows.slice(1)
      .filter((r) => r.length > ni && r[ni] && r[ni].trim())
      .map((r) => ({ date: (r[di] || "").trim(), note: (r[ni] || "").trim() }));
    return notes.slice(-max);
  } catch {
    return [];
  }
}

const SYSTEM_LIVE =
  "You summarize a live wealth-management client conversation for the relationship manager. " +
  'Respond with ONLY a minified JSON object: {"summary":"1-2 sentences","bullets":["key point"],"topics":["short topic"]}.';
const SYSTEM_FINAL =
  SYSTEM_LIVE +
  ' Additionally include "historyLinks":["how this conversation connects to a past CRM note or known client preference"], using the provided client history.';

function parseObj(content) {
  const s = content.indexOf("{"); const e = content.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no JSON object in model output");
  return JSON.parse(content.slice(s, e + 1));
}

async function anthropicDigest(transcript, model, mode, context) {
  const system = mode === "final" ? SYSTEM_FINAL : SYSTEM_LIVE;
  const parts = [`Transcript so far:\n${transcript}`];
  if (mode === "final") {
    if (context?.dnaContext) parts.push(`\nClient DNA: ${context.dnaContext}`);
    if (context?.history?.length)
      parts.push(`\nRecent CRM notes:\n${context.history.map((h) => `- ${h.date}: ${h.note}`).join("\n")}`);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: "user", content: parts.join("\n") }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const obj = parseObj(text);
  const out = {
    model, mode,
    summary: String(obj.summary || "").trim(),
    bullets: Array.isArray(obj.bullets) ? obj.bullets.map(String) : [],
    topics: Array.isArray(obj.topics) ? obj.topics.map(String) : [],
  };
  if (mode === "final" && Array.isArray(obj.historyLinks)) out.historyLinks = obj.historyLinks.map(String);
  return out;
}

export async function digest({ clientId, transcript, mode = "live", dnaContext }) {
  if (!transcript || !transcript.trim()) return heuristicDigest(transcript || "", mode);
  if (!ANTHROPIC_READY) return heuristicDigest(transcript, mode);
  const model = mode === "final" ? chooseModel(transcript).model : MODEL_SMALL;
  const context = mode === "final" ? { dnaContext, history: loadHistory(clientId) } : null;
  try {
    return await anthropicDigest(transcript, model, mode, context);
  } catch (err) {
    console.warn(`[digest] ${model} failed, falling back to heuristic: ${err.message}`);
    return heuristicDigest(transcript, mode);
  }
}

export function digestInfo() {
  return { ready: ANTHROPIC_READY, small: MODEL_SMALL, large: MODEL_LARGE };
}
