// Loads the real portfolio holdings from the challenge CSVs and matches news
// articles to specific instruments — so each flagged article can cite the ISIN
// of the equity/bond affected. Matching is DETERMINISTIC (issuer-name against
// the holdings index): the LLM never invents an ISIN.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_DIR = join(__dirname, "..", "data", "portfolio");

// Minimal quote-aware CSV parser.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inq = false; }
      else field += c;
    } else if (c === '"') inq = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Normalize a name for matching: lowercase, strip accents, punctuation and
// common corporate/legal suffixes, collapse whitespace.
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,/&'’"()\-]/g, " ")
    .replace(/\b(s a|ag|inc|plc|co|ltd|llc|holdings?|group|sa|nv|se|corp|corporation|company|the| adr|inhaberaktie|registered|shares)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TYPE_BY_CLASS = {
  Equities: "equity",
  "Fixed Income": "bond",
  "Real Estate": "real-estate",
  Alternatives: "alternative",
};

// Issuer cores too generic to match on safely (governments/agencies/cash).
const STOP = new Set([
  "swiss confederation", "us treasury", "germany bund", "france oat",
  "republic of indonesia", "kingdom of saudi arabia", "kanton zurich",
  "pfandbriefbank", "eurofima", "swiss bank", "usd cash account", "zkb cash account",
]);

// A few issuers whose news-concept name differs from the CSV issuer.
const ALIASES = {
  "muenchener rueckvers": ["munich re"],
  "chocoladefabriken lindt": ["lindt", "lindt spruengli", "lindt sprungli"],
  "industrial comm bank": ["icbc", "industrial and commercial bank"],
};

function loadHoldings() {
  const byIsin = new Map();
  const files = readdirSync(PORTFOLIO_DIR).filter((f) => /^sample_portfolio_/.test(f));
  for (const file of files) {
    const mandate = file.replace(/^sample_portfolio_|\.csv$/g, "");
    const rows = parseCsv(readFileSync(join(PORTFOLIO_DIR, file), "utf8"));
    const head = rows[0];
    const col = (name) => head.indexOf(name);
    const [cClass, cIssuer, cIsin, cIndustry, cTicker] = [
      col("Asset Class"), col("Issuer / Asset"), col("ISIN"), col("Industry Group"), col("Yahoo Ticker"),
    ];
    for (const r of rows.slice(1)) {
      const assetClass = r[cClass];
      const isin = (r[cIsin] || "").trim();
      const issuer = (r[cIssuer] || "").trim();
      if (!isin || !issuer || assetClass === "Total" || isin.startsWith("Cash")) continue;
      const core = normalize(issuer);
      if (core.length < 4 || STOP.has(core)) continue;

      if (!byIsin.has(isin)) {
        byIsin.set(isin, {
          isin,
          issuer,
          core,
          aliases: ALIASES[core] || [],
          type: TYPE_BY_CLASS[assetClass] || "other",
          industryGroup: r[cIndustry] || "",
          ticker: (r[cTicker] || "").trim() || null,
          mandates: new Set(),
        });
      }
      byIsin.get(isin).mandates.add(mandate);
    }
  }
  return [...byIsin.values()];
}

const HOLDINGS = loadHoldings();

export function holdingsInfo() {
  return { count: HOLDINGS.length, mandates: 3 };
}

const reCache = new Map();
function wordRe(term) {
  if (!reCache.has(term)) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    reCache.set(term, new RegExp(`(?:^| )${esc}(?: |$)`));
  }
  return reCache.get(term);
}

// Match one article to the holdings it plausibly affects. `orgs` are the
// Event Registry organization concepts; title is the headline.
export function matchArticle({ title, orgs }) {
  const hay = normalize(`${title || ""} ${(orgs || []).join(" ")}`);
  const hits = [];
  for (const h of HOLDINGS) {
    const names = [h.core, ...h.aliases];
    if (names.some((n) => wordRe(n).test(hay))) {
      hits.push({
        isin: h.isin,
        issuer: h.issuer,
        type: h.type,
        ticker: h.ticker,
        industryGroup: h.industryGroup,
        mandates: [...h.mandates],
      });
    }
  }
  return hits;
}
