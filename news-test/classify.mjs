// Shared classification primitives: the cheap regex layer + the noise
// pre-filter. Used by the server (pipeline) and the assessor (fallback engine).

// ── Market-relevance lexicons ────────────────────────────────────────────────
const DIRECT_TERMS = [
  "stock", "shares", "equities", "equity market", "bond", "yield", "treasury",
  "interest rate", "rate cut", "rate hike", "central bank", "federal reserve",
  "the fed", "fed", "ecb", "snb", "inflation", "cpi", "gdp", "earnings",
  "profit warning", "guidance", "dividend", "ipo", "merger", "acquisition",
  "takeover", "buyback", "index", "s&p 500", "nasdaq", "dow jones", "smi",
  "ftse", "dax", "nikkei", "forex", "exchange rate", "commodity", "oil price",
  "gold price", "crude", "barrels of oil", "valuation", "market cap",
  "sell-off", "selloff", "rally", "bear market", "bull market", "recession",
  "default", "downgrade", "upgrade", "credit rating", "share price",
  "stock price", "quarterly results", "revenue", "bankruptcy", "bitcoin", "crypto",
  // stock-movement language (headline-level moves)
  "plunge", "plummet", "tumble", "slump", "sell off", "sell-off", "short seller",
  "earnings beat", "earnings miss", "profit", "price target", "analyst rating",
  "shares fall", "shares rise", "shares jump", "shares slump", "shares soar",
  "stock surge", "stock plunge", "all-time high", "record high", "52-week",
];
const INDIRECT_TERMS = [
  "regulation", "regulator", "antitrust", "lawsuit", "litigation", "settlement",
  "fine", "sanction", "tariff", "trade war", "embargo", "strike", "layoffs",
  "job cuts", "recall", "scandal", "fraud", "investigation", "probe",
  "data breach", "cyberattack", "ceo resigns", "ceo steps down", "resignation",
  "boycott", "deforestation", "palm oil", "emissions", "pollution",
  "supply chain", "shortage", "disruption", "conflict", "war", "coup",
  "election", "geopolitical", "earthquake", "hurricane", "outbreak", "labour",
  "exploitation", "protest", "strait of hormuz", "ceasefire", "blockade",
];
const FINANCE_CAT =
  /financ|invest|\bbanking\b|securities|\bstock|\bmoney\b|\beconom|capital market|trading/i;
// Categories that mark an article as obvious non-market noise.
const NOISE_CAT =
  /arts and entertainment|sports|recreation|\bfood\b|cooking|\btravel\b|lifestyle|gaming|celebrit|music|fashion|horse racing/i;

const boundary = (t) =>
  new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i");
const compile = (terms) => terms.map((t) => ({ t, re: boundary(t) }));

const DIRECT_RE = compile(DIRECT_TERMS);
const INDIRECT_RE = compile(INDIRECT_TERMS);

function findTerms(text, compiled) {
  const hits = [];
  for (const { t, re } of compiled) if (re.test(text)) hits.push(t);
  return hits;
}

// Event Registry scores each article-concept 1..5 by how central it is to the
// article. Keep only prominent organizations (default >=4) so passing mentions
// don't trigger holding matches or rescue noise from the pre-filter.
const CONCEPT_SCORE_MIN = Number(process.env.CONCEPT_SCORE_MIN ?? 4);

export function orgsOf(a) {
  return (a.concepts || [])
    .filter((c) => c.type === "org" && (c.score ?? 0) >= CONCEPT_SCORE_MIN)
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .map((c) => (typeof c.label === "object" ? c.label?.eng : c.label))
    .filter(Boolean)
    .slice(0, 5);
}

// Deterministic keyword classifier (the cheap engine + the LLM fallback).
export function regexClassify(a) {
  const title = (a.title || "").toLowerCase();
  const body = (a.body || a.summary || "").toLowerCase();
  const tDirect = findTerms(title, DIRECT_RE);
  const bDirect = findTerms(body, DIRECT_RE);
  const tIndirect = findTerms(title, INDIRECT_RE);
  const bIndirect = findTerms(body, INDIRECT_RE);

  const cats = (a.categories || []).map((c) => c.label || c.uri || "");
  const catHit = cats.find((c) => FINANCE_CAT.test(c));
  const orgs = orgsOf(a);

  let bucket = "none";
  let evidence = [];
  if (tDirect.length >= 1) {
    bucket = "direct";
    evidence = [...tDirect, ...bDirect];
  } else if (tIndirect.length >= 1 || bDirect.length >= 2 || (bIndirect.length >= 1 && orgs.length)) {
    bucket = "indirect";
    evidence = [...tIndirect, ...bDirect, ...bIndirect];
  }
  if (bucket !== "none" && catHit) evidence.push(`category: ${catHit.replace(/^dmoz\//, "")}`);

  return { bucket, evidence: [...new Set(evidence)].slice(0, 6), orgs };
}

// Cheap noise pre-filter. Returns {drop, reason}. We only drop when an article
// is in an obvious non-market category AND the keyword layer found no finance
// signal — keeping recall high so meaning-based signals still reach the LLM.
export function noisePrefilter(a) {
  const cats = (a.categories || []).map((c) => c.label || c.uri || "");
  const noiseCat = cats.find((c) => NOISE_CAT.test(c));
  if (noiseCat && regexClassify(a).bucket === "none") {
    return { drop: true, reason: noiseCat.replace(/^dmoz\//, "") };
  }
  return { drop: false, reason: null };
}

// ── STAGE 1: investment relevance (fast, deterministic) ──────────────────────
// Keeps anything plausibly investment-relevant — including business moves by
// companies (e.g. "Nestlé launches a green venture") — and drops the obviously
// irrelevant (e.g. "top 10 dog toys"). No LLM: category + company + keyword.
const BIZ_MOVE_TERMS = [
  "venture", "acquire", "acquisition", "merger", "takeover", "expansion",
  "expands", "launch", "launches", "invest", "investment", "factory", "plant",
  "partnership", "joint venture", "stake", "funding", "raises", "ipo", "listing",
  "revenue", "profit", "earnings", "dividend", "contract", "deal", "supplier",
  "production", "output", "ceo", "buyout", "spin-off", "restructuring", "layoffs",
];
const BIZ_MOVE_RE = compile(BIZ_MOVE_TERMS);

export function investmentRelevance(a) {
  const orgs = orgsOf(a); // prominent companies (score-thresholded)
  if (orgs.length) return { relevant: true, reason: `company: ${orgs[0]}` };

  const cats = (a.categories || []).map((c) => c.label || c.uri || "");
  if (cats.some((c) => FINANCE_CAT.test(c))) return { relevant: true, reason: "finance category" };

  const r = regexClassify(a);
  if (r.bucket !== "none") return { relevant: true, reason: `signal: ${r.evidence[0] || r.bucket}` };

  const text = `${a.title || ""} ${a.body || a.summary || ""}`.toLowerCase();
  const moves = findTerms(text, BIZ_MOVE_RE);
  if (moves.length >= 2) return { relevant: true, reason: `business activity: ${moves[0]}` };

  const noiseCat = cats.find((c) => NOISE_CAT.test(c));
  return { relevant: false, reason: noiseCat ? noiseCat.replace(/^dmoz\//, "") : "no investment signal" };
}

// ── STAGE 2 vocabulary: core-value themes + market movement ───────────────────
// Controlled list so the LLM and the heuristic agree, and themes map onto the
// persona DNA (environment, tech, healthcare, …).
export const THEME_VOCAB = {
  environment: ["climate", "sustainability", "sustainable", "renewable", "emissions", "carbon", "deforestation", "palm oil", "esg", "recycling", "clean energy", "solar", "wind power", "biodiversity", "net zero"],
  "tech-innovation": ["artificial intelligence", "ai", "semiconductor", "semiconductors", "chipmaker", "cloud computing", "data center", "machine learning", "quantum", "nvidia", "chatbot", "chips"],
  healthcare: ["pharma", "pharmaceutical", "biotech", "clinical trial", "medical", "healthcare", "vaccine", "diabetes", "oncology", "drugmaker", "fda approval"],
  consumer: ["retailer", "consumer goods", "consumer staples", "beverage", "grocery", "apparel", "e-commerce", "fast food", "packaged food"],
  energy: ["crude oil", "oil price", "opec", "natural gas", "barrel", "pipeline", "petroleum", "refinery", "oil supply"],
  financials: ["interest rate", "rate cut", "rate hike", "central bank", "federal reserve", "the fed", "ecb", "mortgage rate", "bond yield", "lending"],
  "market-movement": ["s&p 500", "nasdaq", "dow jones", "stock index", "stock market", "equities", "sell-off", "selloff", "bull market", "bear market", "benchmark index", "wall street", "ftse", "dax"],
  geopolitics: ["sanctions", "tariff", "tariffs", "trade war", "geopolitical", "embargo", "strait of hormuz", "ceasefire"],
  governance: ["scandal", "lawsuit", "antitrust", "labour exploitation", "labor exploitation", "fraud", "boycott", "product recall", "corporate governance"],
};
export const THEME_KEYS = Object.keys(THEME_VOCAB);
const THEME_RE = Object.fromEntries(Object.entries(THEME_VOCAB).map(([k, kws]) => [k, compile(kws)]));

// Deterministic theme tagging (heuristic Stage 2 + LLM fallback). Word-boundary
// matches on TITLE + SUMMARY only — so a theme word buried in a long body
// doesn't mis-tag an article that isn't really about it.
export function heuristicThemes(a) {
  const text = `${a.title || ""} ${a.summary || ""}`.toLowerCase();
  const themes = [];
  for (const [theme, re] of Object.entries(THEME_RE)) {
    if (findTerms(text, re).length) themes.push(theme);
  }
  const marketMovement = themes.includes("market-movement");
  return { themes, marketMovement };
}

// Organizations CENTRAL to the article: those tied for the top concept score
// (and that top score is at least prominent). Used for instrument matching so a
// stock is only identified when the article is genuinely about it.
const CENTRAL_MIN = Number(process.env.CENTRAL_SCORE_MIN ?? 4);
export function centralOrgsOf(a) {
  const orgs = (a.concepts || []).filter((c) => c.type === "org" && typeof c.score === "number");
  if (!orgs.length) return [];
  const max = Math.max(...orgs.map((c) => c.score));
  if (max < CENTRAL_MIN) return [];
  return orgs
    .filter((c) => c.score === max)
    .map((c) => (typeof c.label === "object" ? c.label?.eng : c.label))
    .filter(Boolean)
    .slice(0, 4);
}
