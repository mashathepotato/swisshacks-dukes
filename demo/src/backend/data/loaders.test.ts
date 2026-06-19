import { test, expect } from "vitest";
import { loadPortfolio, loadCioList, loadStrategies, loadCrm } from "./loaders";

test("loadPortfolio(Balanced) returns holdings with numeric CHF and Roche present", () => {
  const holdings = loadPortfolio("Balanced");
  expect(holdings.length).toBeGreaterThan(10);
  const roche = holdings.find((h) => h.isin === "CH0012032048");
  expect(roche).toBeDefined();
  expect(roche!.industryGroup).toBe("Health Care");
  expect(roche!.currentCHF).toBeGreaterThan(0);
  expect(Number.isFinite(roche!.targetCHF)).toBe(true);
});

test("loadCioList includes Roche as BUY and Biogen as HOLD", () => {
  const cio = loadCioList();
  const roche = cio.find((c) => c.isin === "CH0012032048");
  const biogen = cio.find((c) => c.isin === "US09062X1037");
  expect(roche!.rating).toBe("BUY");
  expect(biogen!.rating).toBe("HOLD");
});

test("loadStrategies returns Balanced % for Domestic (CHF) equities", () => {
  const s = loadStrategies();
  const dom = s.find((t) => t.subAssetClass === "Domestic (CHF)");
  expect(dom!.balancedPct).toBeCloseTo(10, 5);
});

test("loadCrm parses quoted notes with embedded commas", () => {
  const notes = loadCrm("crm_schneider.csv");
  expect(notes.length).toBeGreaterThan(20);
  const may14 = notes.find((n) => n.date.startsWith("2024-05-14"));
  expect(may14!.note).toContain("neurological research");
});
