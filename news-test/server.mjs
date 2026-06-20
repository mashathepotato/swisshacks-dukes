// Zero-dependency Event Registry viewer with a HYBRID relevance pipeline:
//   1. fetch + dedup articles from eventregistry.org (key stays server-side)
//   2. cheap regex NOISE pre-filter drops obvious junk (sports/lifestyle/…)
//   3. an LLM agent assesses the survivors for market relevance + affected tags
//      (Phoeniqs when PHOENIQS_API_KEY is set; deterministic heuristic otherwise)
//
//   node news-test/server.mjs   →   http://localhost:4000

import "./env.mjs"; // must be first: populates process.env from demo/.env
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { investmentRelevance, orgsOf, centralOrgsOf, THEME_KEYS } from "./classify.mjs";
import { assessBatch, assessorInfo } from "./assessor.mjs";
import { distill, distillInfo } from "./distill.mjs";
import { buildBody, batchKey } from "./query.mjs";
import { matchArticle, holdingsInfo } from "./holdings.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const ER_URL = "https://eventregistry.org/api/v1/article/getArticles";
const API_KEY = process.env.NEWSAPI_KEY || "";
// Offline (fixture) is the DEFAULT while developing — no API spend. Opt into
// live calls explicitly with NEWS_LIVE=1.
const OFFLINE = process.env.NEWS_LIVE !== "1";

if (!OFFLINE && !API_KEY) console.warn("⚠  No NEWSAPI_KEY. Set it or add it to demo/.env");

// Source of articles: a saved fixture (offline, no API spend) or a live call.
let fixtureCache = null;
async function loadFixture() {
  if (!fixtureCache) {
    try {
      const raw = await readFile(join(__dirname, "fixtures", "news.json"), "utf8");
      fixtureCache = JSON.parse(raw);
    } catch {
      throw new Error(
        "No fixture found. Run `node news-test/fetch-fixture.mjs` once, or start with NEWS_LIVE=1 to call the API."
      );
    }
  }
  return fixtureCache;
}

async function getResults({ q, mode, count }) {
  if (OFFLINE) {
    const fx = await loadFixture();
    const key = batchKey({ q, mode });
    const batch = fx.batches[key] || Object.values(fx.batches)[0];
    return batch?.results || [];
  }
  const er = await fetch(ER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildBody(API_KEY, { q, mode, count })),
  });
  const data = await er.json();
  if (data?.error) throw new Error(data.error);
  return data?.articles?.results || [];
}

async function handleNews(url, res) {
  if (!OFFLINE && !API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "No NEWSAPI_KEY configured on server." }));
  }

  let results;
  try {
    results = await getResults({
      q: url.searchParams.get("q"),
      mode: url.searchParams.get("mode"),
      count: url.searchParams.get("count"),
    });
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: String(err.message || err) }));
  }

  // 1. dedup by title
  const seen = new Set();
  const raw = results.filter((a) => {
    const key = (a.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const articles = raw.map((a) => ({
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

  // STAGE 1 — investment relevance (fast, deterministic). Keeps company/business/
  // market articles; drops the obviously irrelevant. No LLM.
  const candidates = [];
  for (const a of articles) {
    a.orgs = orgsOf(a); // prominent orgs (score >= threshold) — Stage 1 relevance
    // Instruments only match on CENTRAL orgs (top concept) or a headline mention,
    // so a stock is identified only when the article is genuinely about it.
    a.holdings = matchArticle({ title: a.title, orgs: centralOrgsOf(a) });
    a.stage1 = investmentRelevance(a);
    if (a.stage1.relevant) candidates.push(a);
  }

  // STAGE 2 — core-value theme + market-movement classification (the LLM stage).
  const verdicts = await assessBatch(
    candidates.map((c) => ({ id: c.id, title: c.title, summary: c.summary, body: c.body, categories: c.categories, concepts: c.concepts }))
  );

  // STAGE 3 — specific instruments (ISINs) for articles that pass stages 1+2.
  const out = articles.map((a) => {
    const meta = { title: a.title, source: a.source, date: a.date, url: a.url, sentiment: a.sentiment, summary: a.summary };
    if (!a.stage1.relevant) {
      return { ...meta, stage1: a.stage1, stage2: null, selected: false, affectedHoldings: [] };
    }
    const v = verdicts.get(a.id) || { themes: [], marketMovement: false, confidence: 0, reason: "no verdict", engine: "none" };
    const selected = v.themes.length > 0 || v.marketMovement;
    return {
      ...meta,
      stage1: a.stage1,
      stage2: v,
      selected,
      affectedHoldings: selected ? a.holdings : [],
    };
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      engine: assessorInfo(),
      offline: OFFLINE,
      themes: THEME_KEYS,
      count: out.length,
      stage1Dropped: articles.length - candidates.length,
      assessed: candidates.length,
      flagged: out.filter((a) => a.selected).length,
      articles: out,
    })
  );
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => { buf += c; if (buf.length > 1e6) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

async function handleDistill(req, res) {
  const body = await readJson(req);
  const { clientId, transcript, rmName, clientContact, date } = body;
  if (!clientId || !transcript) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "clientId and transcript are required" }));
  }
  const result = await distill({
    clientId,
    transcript,
    rmName: rmName || "RM",
    clientContact: clientContact || "Client",
    date: date || new Date().toISOString().slice(0, 10),
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ engine: distillInfo(), ...result }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/api/transcript/distill" && req.method === "POST")
      return await handleDistill(req, res);
    if (url.pathname === "/api/news") return await handleNews(url, res);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = await readFile(join(__dirname, "public", "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
});

server.listen(PORT, () => {
  const info = assessorInfo();
  console.log(`📰 News viewer on http://localhost:${PORT}`);
  console.log(`   Source:   ${OFFLINE ? "OFFLINE fixture (no API spend)" : "live Event Registry"}`);
  console.log(`   News key: ${API_KEY ? API_KEY.slice(0, 8) + "…" : "(none)"}`);
  console.log(`   Assessor: ${info.engine} (${info.model})`);
  console.log(`   Holdings: ${holdingsInfo().count} instruments indexed for ISIN matching`);
});
