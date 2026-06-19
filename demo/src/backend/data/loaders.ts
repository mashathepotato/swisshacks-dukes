import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { CioEntry, CrmNote, Holding, Mandate, Rating, StrategyTarget } from "../../shared/domain";
import { dataDir } from "./paths";

function readCsv(relPath: string): Record<string, string>[] {
  const full = path.join(dataDir(), relPath);
  const raw = fs.readFileSync(full, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
}

const num = (v: string): number => {
  const n = parseFloat((v || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const portfolioFile: Record<Mandate, string> = {
  Defensive: "portfolio/sample_portfolio_defensive.csv",
  Balanced: "portfolio/sample_portfolio_balanced.csv",
  Growth: "portfolio/sample_portfolio_growth.csv",
};

export function loadPortfolio(mandate: Mandate): Holding[] {
  return readCsv(portfolioFile[mandate])
    .filter((r) => r["ISIN"])
    .map((r) => ({
      isin: r["ISIN"],
      issuer: r["Issuer / Asset"],
      assetClass: r["Asset Class"],
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      region: r["Region"],
      industryGroup: (r["Industry Group"] || "").trim(),
      targetCHF: num(r["Target (CHF)"]),
      currentCHF: num(r["Current (CHF)"]),
      valor: r["Valor"] || "",
      mic: r["MIC"] || "",
      yahoo: r["Yahoo Ticker"] || "",
    }));
}

export function loadCioList(): CioEntry[] {
  return readCsv("portfolio/cio_recommendation_list.csv")
    .filter((r) => r["ISIN"])
    .map((r) => ({
      isin: r["ISIN"],
      issuer: r["Issuer / Asset"],
      rating: (r["Rating"] as Rating) || "HOLD",
      ratingSince: r["Rating Since"] || "",
      industryGroup: (r["Industry Group"] || "").trim(),
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      cioView: r["CIO View"] || "",
    }));
}

export function loadStrategies(): StrategyTarget[] {
  return readCsv("portfolio/portfolio_strategies.csv")
    .filter((r) => r["Sub-Asset Class"] && r["Asset Class"] !== "TOTAL")
    .map((r) => ({
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      defPct: num(r["Def %"]),
      balancedPct: num(r["Balanced %"]),
      growthPct: num(r["Growth %"]),
    }));
}

export function loadCrm(clientFile: string): CrmNote[] {
  return readCsv(`crm/${clientFile}`)
    .filter((r) => r["Date"])
    .map((r) => ({
      date: r["Date"],
      medium: r["Medium"],
      rmName: r["RM Name"],
      contact: r["Client Contact"],
      note: r["Note"],
    }));
}
