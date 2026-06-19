import { test, expect } from "vitest";
import { simulateSwap } from "./simulate";
import { CioEntry, DnaProfile, Holding, StrategyTarget } from "../../shared/domain";
import { loadPortfolio, loadCioList, loadStrategies } from "../data/loaders";

const H = (isin: string, ig: string, sub: string, cur: number): Holding =>
  ({ isin, issuer: isin, assetClass: "Equities", subAssetClass: sub, region: "", industryGroup: ig, targetCHF: cur, currentCHF: cur, valor: "", mic: "", yahoo: "" });
const C = (isin: string, ig: string, sub: string, rating: "BUY" | "HOLD" | "SELL"): CioEntry =>
  ({ isin, issuer: isin, rating, ratingSince: "", industryGroup: ig, subAssetClass: sub, cioView: "view" });
const strat = (sub: string, pct: number): StrategyTarget => ({ subAssetClass: sub, defPct: pct, balancedPct: pct, growthPct: pct });
const dna: DnaProfile = { clientId: "x", name: "X", mandate: "Balanced", style: "data-driven", traits: [] };

test("same-sector CIO-BUY swap with no weight shift is compliant", () => {
  const holdings = [H("SELL", "Health Care", "A", 100), H("OTH", "Financials", "B", 100)];
  const cio = [C("SELL", "Health Care", "A", "BUY"), C("GOOD", "Health Care", "A", "BUY")];
  const r = simulateSwap({ holdings, strategies: [strat("A", 50), strat("B", 50)], cio, dna, mandate: "Balanced", sellIsin: "SELL", buyIsin: "GOOD" });
  expect(r.sameSector).toBe(true);
  expect(r.buyRatingOk).toBe(true);
  expect(r.amountCHF).toBe(100);
  expect(r.newBreaches).toEqual([]);
  expect(r.compliant).toBe(true);
});

test("buying a non-BUY name is not compliant", () => {
  const holdings = [H("SELL", "Health Care", "A", 100)];
  const cio = [C("SELL", "Health Care", "A", "BUY"), C("HOLDY", "Health Care", "A", "HOLD")];
  const r = simulateSwap({ holdings, strategies: [strat("A", 100)], cio, dna, mandate: "Balanced", sellIsin: "SELL", buyIsin: "HOLDY" });
  expect(r.buyRatingOk).toBe(false);
  expect(r.compliant).toBe(false);
});

test("a cross-sector swap is flagged as not same-sector", () => {
  const holdings = [H("SELL", "Health Care", "A", 100)];
  const cio = [C("SELL", "Health Care", "A", "BUY"), C("FIN", "Financials", "A", "BUY")];
  const r = simulateSwap({ holdings, strategies: [strat("A", 100)], cio, dna, mandate: "Balanced", sellIsin: "SELL", buyIsin: "FIN" });
  expect(r.sameSector).toBe(false);
  expect(r.compliant).toBe(false);
});

test("a swap that shifts sub-asset weights past ±2pp reports a new breach", () => {
  const holdings = [H("SELL", "HC", "Foreign", 100), H("DOM", "HC", "Domestic", 100)];
  const cio = [C("SELL", "HC", "Foreign", "BUY"), C("GOOD", "HC", "Domestic", "BUY")];
  const r = simulateSwap({ holdings, strategies: [strat("Domestic", 50), strat("Foreign", 50)], cio, dna, mandate: "Balanced", sellIsin: "SELL", buyIsin: "GOOD" });
  expect(r.newBreaches).toContain("Domestic");
  expect(r.compliant).toBe(false);
});

test("DNA verdict: buying into an aversion sector conflicts", () => {
  const averse: DnaProfile = { clientId: "r", name: "R", mandate: "Defensive", style: "data-driven", traits: [
    { id: "av", label: "Aversion to speculative US tech", detail: "no Silicon Valley tech/AI bubbles", confidence: 0.9, evidence: [] } ] };
  const holdings = [H("SELL", "Consumer Staples", "A", 100)];
  const cio = [C("SELL", "Consumer Staples", "A", "BUY"), C("NVDA", "Information Technology", "A", "BUY")];
  const r = simulateSwap({ holdings, strategies: [strat("A", 100)], cio, dna: averse, mandate: "Defensive", sellIsin: "SELL", buyIsin: "NVDA" });
  expect(r.dna.verdict).toBe("conflicts");
});

test("DNA verdict: selling a flagged holding honors the client", () => {
  const holdings = [H("SELL", "Health Care", "A", 100)];
  const cio = [C("SELL", "Health Care", "A", "BUY"), C("GOOD", "Health Care", "A", "BUY")];
  const r = simulateSwap({ holdings, strategies: [strat("A", 100)], cio, dna, mandate: "Balanced", sellIsin: "SELL", buyIsin: "GOOD", sellResolvesConflict: true });
  expect(r.dna.verdict).toBe("honors");
});

test("real data: Ammann sell Adidas -> buy Richemont is same-sector and CIO-BUY", () => {
  const holdings = loadPortfolio("Growth");
  const r = simulateSwap({ holdings, strategies: loadStrategies(), cio: loadCioList(), dna, mandate: "Growth", sellIsin: "DE000A1EWWW0", buyIsin: "CH0210483332" });
  expect(r.sameSector).toBe(true);
  expect(r.buyRatingOk).toBe(true);
  expect(r.amountCHF).toBeGreaterThan(90000);
  expect(Array.isArray(r.driftAfter)).toBe(true);
});
