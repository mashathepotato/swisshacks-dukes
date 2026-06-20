// bake.mjs — run the relevance pipeline over the offline fixture ONCE and write
// a processed feed that the React app imports directly (the "baked" integration).
// The live sidecar (server.mjs) produces the same article shape, so a teammate's
// live source can drop in behind the same UI later.
//
//   node news-test/bake.mjs                       # default engine (claude)
//   ASSESSOR_ENGINE=heuristic node news-test/bake.mjs   # deterministic, no LLM
//   BAKE_BATCHES=business,keyword:nvidia node news-test/bake.mjs

import "./env.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { investmentRelevance, orgsOf, centralOrgsOf, THEME_KEYS } from "./classify.mjs";
import { assessBatch, assessorInfo } from "./assessor.mjs";
import { matchArticle } from "./holdings.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "frontend", "src", "data", "newsFeed.json");

const BATCHES = (process.env.BAKE_BATCHES ||
  "business,keyword:markets,keyword:oil,keyword:nvidia,keyword:nestlé,keyword:roche,keyword:novartis,keyword:tesla")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CAP = Number(process.env.BAKE_CAP || 140);
const CHUNK = Number(process.env.BAKE_CHUNK || 20);

async function main() {
  const fx = JSON.parse(await readFile(join(__dirname, "fixtures", "news.json"), "utf8"));

  // combine the chosen batches, dedup by title
  const seen = new Set();
  const raw = [];
  for (const key of BATCHES) {
    const batch = fx.batches[key];
    if (!batch) { console.warn(`  (no fixture batch: ${key})`); continue; }
    for (const a of batch.results || []) {
      const k = (a.title || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      raw.push(a);
    }
  }
  const limited = raw.slice(0, CAP);
  console.log(`Combined ${BATCHES.length} batches → ${raw.length} unique articles (capped to ${limited.length})`);

  const articles = limited.map((a) => ({
    id: String(a.uri ?? a.url ?? a.title),
    title: a.title || "(untitled)",
    source: a.source?.title || "Unknown",
    date: a.dateTimePub || a.dateTime || null,
    url: a.url || "#",
    sentiment: typeof a.sentiment === "number" ? a.sentiment : null,
    summary: (a.body || "").slice(0, 220).trim(),
    body: a.body || "",
    categories: a.categories || [],
    concepts: a.concepts || [],
  }));

  // STAGE 1 — investment relevance + instrument index
  const candidates = [];
  for (const a of articles) {
    a.orgs = orgsOf(a);
    a.holdings = matchArticle({ title: a.title, orgs: centralOrgsOf(a) });
    a.stage1 = investmentRelevance(a);
    if (a.stage1.relevant) candidates.push(a);
  }
  console.log(`Stage 1: ${candidates.length} relevant, ${articles.length - candidates.length} dropped`);

  // STAGE 2 — theme tagging (chunked so prompts stay sane)
  const verdicts = new Map();
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK).map((c) =>
      ({ id: c.id, title: c.title, summary: c.summary, body: c.body, categories: c.categories, concepts: c.concepts }));
    const m = await assessBatch(chunk);
    for (const [k, v] of m) verdicts.set(k, v);
    console.log(`  stage 2: ${Math.min(i + CHUNK, candidates.length)}/${candidates.length}`);
  }

  // STAGE 3 — instruments, and assemble the lean output
  const out = articles.map((a) => {
    const meta = { id: a.id, title: a.title, source: a.source, date: a.date, url: a.url, sentiment: a.sentiment, summary: a.summary };
    if (!a.stage1.relevant) return { ...meta, stage1: a.stage1, stage2: null, selected: false, affectedHoldings: [] };
    const v = verdicts.get(a.id) || { themes: [], marketMovement: false, confidence: 0, reason: "no verdict", engine: "none" };
    const selected = v.themes.length > 0 || v.marketMovement;
    return { ...meta, stage1: a.stage1, stage2: v, selected, affectedHoldings: selected ? a.holdings : [] };
  });

  const feed = {
    generatedAt: new Date().toISOString(),
    engine: assessorInfo(),
    themes: THEME_KEYS,
    batches: BATCHES,
    total: out.length,
    stage1Dropped: articles.length - candidates.length,
    assessed: candidates.length,
    flagged: out.filter((a) => a.selected).length,
    articles: out,
  };
  await writeFile(OUT, JSON.stringify(feed, null, 2));
  console.log(`\n✓ wrote ${OUT}`);
  console.log(`  ${feed.total} articles · ${feed.assessed} assessed · ${feed.flagged} selected · engine ${feed.engine.engine}/${feed.engine.model}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
