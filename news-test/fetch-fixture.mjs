// One-off capture: call Event Registry for a few queries and save the RAW
// article results to fixtures/news.json. Run this occasionally to refresh; then
// test against the fixture (NEWS_OFFLINE=1) without spending API calls.
//
//   node news-test/fetch-fixture.mjs
//   NEWS_OFFLINE=1 node news-test/server.mjs   # serves from the fixture

import "./env.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBody, batchKey } from "./query.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ER_URL = "https://eventregistry.org/api/v1/article/getArticles";
const API_KEY = process.env.NEWSAPI_KEY || "";

// The batches worth caching for testing — add more queries here if needed.
// Holding-targeted queries make the ISIN matcher light up (the fixture must
// actually mention portfolio issuers for instrument-level matches to appear).
const QUERIES = [
  { mode: "keyword", q: "oil" },
  { mode: "keyword", q: "markets" },
  { mode: "business" },
  { mode: "keyword", q: "Nestlé" },
  { mode: "keyword", q: "Roche" },
  { mode: "keyword", q: "Novartis" },
  { mode: "keyword", q: "Tesla" },
  { mode: "keyword", q: "Nvidia" },
];

if (!API_KEY) {
  console.error("No NEWSAPI_KEY — set it or add it to demo/.env");
  process.exit(1);
}

const batches = {};
for (const query of QUERIES) {
  const key = batchKey(query);
  try {
    const res = await fetch(ER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(API_KEY, { ...query, count: 40 })),
    });
    const data = await res.json();
    if (data?.error) {
      console.error(`✗ ${key}: ${data.error}`);
      continue;
    }
    const results = data?.articles?.results || [];
    batches[key] = { results };
    console.log(`✓ ${key}: ${results.length} articles`);
  } catch (err) {
    console.error(`✗ ${key}: ${err.message}`);
  }
}

const fixture = { savedAt: new Date().toISOString(), batches };
await mkdir(join(__dirname, "fixtures"), { recursive: true });
const out = join(__dirname, "fixtures", "news.json");
await writeFile(out, JSON.stringify(fixture, null, 2));
console.log(`\nSaved ${Object.keys(batches).length} batches → ${out}`);
