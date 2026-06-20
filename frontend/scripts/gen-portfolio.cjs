const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const DATA = path.resolve(__dirname, "../data");
const read = (p) => parse(fs.readFileSync(path.join(DATA, p), "utf8"), { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
const num = (v) => { const n = parseFloat(String(v||"").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

const files = { Defensive: "portfolio/sample_portfolio_defensive.csv", Balanced: "portfolio/sample_portfolio_balanced.csv", Growth: "portfolio/sample_portfolio_growth.csv" };
const PORTFOLIOS = {};
for (const [m, f] of Object.entries(files)) {
  PORTFOLIOS[m] = read(f).filter(r => r["ISIN"]).map(r => ({
    isin: r["ISIN"], issuer: r["Issuer / Asset"], industryGroup: (r["Industry Group"]||"").trim(),
    subAssetClass: (r["Sub-Asset Class"]||"").trim(), currentCHF: Math.round(num(r["Current (CHF)"]) * 100) / 100,
  }));
}
const CIO = read("portfolio/cio_recommendation_list.csv").filter(r => r["ISIN"]).map(r => ({
  isin: r["ISIN"], issuer: r["Issuer / Asset"], rating: r["Rating"] || "HOLD",
  industryGroup: (r["Industry Group"]||"").trim(), subAssetClass: (r["Sub-Asset Class"]||"").trim(),
  cioView: r["CIO View"] || "", ratingSince: (r["Rating Since"]||"").split(" ")[0],
}));
const STRATEGIES = read("portfolio/portfolio_strategies.csv").filter(r => r["Sub-Asset Class"] && r["Asset Class"] !== "TOTAL").map(r => ({
  subAssetClass: (r["Sub-Asset Class"]||"").trim(), defPct: num(r["Def %"]), balancedPct: num(r["Balanced %"]), growthPct: num(r["Growth %"]),
}));

const out = `// AUTO-GENERATED from data/*.csv by scripts/gen-portfolio.cjs — do not edit by hand.
import type { PHolding, PCio, PStrategy, PMandate } from "../lib/portfolio";

export const PORTFOLIOS: Record<PMandate, PHolding[]> = ${JSON.stringify(PORTFOLIOS, null, 2)};

export const CIO: PCio[] = ${JSON.stringify(CIO, null, 2)};

export const STRATEGIES: PStrategy[] = ${JSON.stringify(STRATEGIES, null, 2)};
`;
const dest = path.resolve(__dirname, "../frontend/src/data/portfolio.ts");
fs.writeFileSync(dest, out);
console.log("wrote", dest);
console.log("holdings:", Object.fromEntries(Object.entries(PORTFOLIOS).map(([k,v])=>[k,v.length])), "| CIO:", CIO.length, "| strategies:", STRATEGIES.length);
