import { test, expect } from "vitest";
import { proposeSwap } from "./swap";
import { CioEntry, Holding } from "../../shared/domain";
import { loadPortfolio, loadCioList } from "../data/loaders";

const holding = (isin: string, industryGroup: string): Holding => ({
  isin, issuer: isin, assetClass: "Equities", subAssetClass: "x", region: "",
  industryGroup, targetCHF: 1, currentCHF: 1, valor: "", mic: "", yahoo: "",
});
const cio = (isin: string, rating: "BUY" | "HOLD" | "SELL", industryGroup: string): CioEntry => ({
  isin, issuer: isin, rating, ratingSince: "", industryGroup, subAssetClass: "x", cioView: "view " + isin,
});

test("chooses a same-group BUY that is not held; explains rejections", () => {
  const holdings = [holding("SELLME", "Health Care"), holding("HELD_BUY", "Health Care")];
  const list = [
    cio("SELLME", "BUY", "Health Care"),
    cio("HELD_BUY", "BUY", "Health Care"),   // rejected: already held
    cio("HOLDY", "HOLD", "Health Care"),     // rejected: not BUY
    cio("OTHER", "BUY", "Financials"),       // rejected: different group
    cio("GOOD", "BUY", "Health Care"),       // chosen
  ];
  const res = proposeSwap("SELLME", holdings, list);
  expect(res.chosen!.isin).toBe("GOOD");
  expect(res.rejected.find((r) => r.isin === "HELD_BUY")!.reason).toMatch(/held/i);
  expect(res.rejected.find((r) => r.isin === "HOLDY")!.reason).toMatch(/BUY/i);
  expect(res.rejected.some((r) => r.isin === "OTHER")).toBe(false); // different group not even considered
});

test("returns chosen=null when no compliant candidate exists", () => {
  const holdings = [holding("SELLME", "Health Care")];
  const list = [cio("SELLME", "BUY", "Health Care"), cio("HOLDY", "HOLD", "Health Care")];
  const res = proposeSwap("SELLME", holdings, list);
  expect(res.chosen).toBeNull();
});

test("real data: selling Roche yields Health-Care BUY candidates not held", () => {
  const holdings = loadPortfolio("Balanced");
  const res = proposeSwap("CH0012032048", holdings, loadCioList()); // Roche
  expect(res.chosen).not.toBeNull();
  const heldIsins = new Set(holdings.map((h) => h.isin));
  expect(heldIsins.has(res.chosen!.isin)).toBe(false);
});

test("ranks a same-sub-asset BUY above a different-sleeve BUY, and returns the rest as alternatives with reasons", () => {
  const sub = (isin: string, sub: string, industryGroup: string, rating: "BUY" | "HOLD"): CioEntry =>
    ({ isin, issuer: isin, rating, ratingSince: "", industryGroup, subAssetClass: sub, cioView: "v" });
  const sell: Holding = { isin: "SELL", issuer: "SELL", assetClass: "Equities", subAssetClass: "Foreign", region: "", industryGroup: "Cons", targetCHF: 1, currentCHF: 1, valor: "", mic: "", yahoo: "" };
  const list = [
    sub("SELL", "Foreign", "Cons", "BUY"),
    sub("DOMESTIC_BUY", "Domestic", "Cons", "BUY"), // same sector, different sleeve
    sub("FOREIGN_BUY", "Foreign", "Cons", "BUY"),   // same sector AND same sleeve -> should win
  ];
  const res = proposeSwap("SELL", [sell], list);
  expect(res.chosen!.isin).toBe("FOREIGN_BUY");
  expect(res.chosen!.reason).toMatch(/same sub-asset class/i);
  expect(res.alternatives.map((a) => a.isin)).toContain("DOMESTIC_BUY");
  expect(res.alternatives[0].reason).toBeTruthy();
});

test("real data: selling Adidas prefers a same-sleeve (Foreign Dev) Consumer Discretionary BUY and lists alternatives", () => {
  const holdings = loadPortfolio("Growth");
  const res = proposeSwap("DE000A1EWWW0", holdings, loadCioList()); // Adidas (Foreign Dev. Markets)
  expect(res.chosen).not.toBeNull();
  expect(res.chosen!.reason).toMatch(/same sub-asset class/i);
  expect(res.alternatives.length).toBeGreaterThan(0);
});
