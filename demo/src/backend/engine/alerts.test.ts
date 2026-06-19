import { test, expect } from "vitest";
import { buildAlerts } from "./alerts";
import { CioEntry, DnaProfile, DriftBreach, Holding, NewsEvent } from "../../shared/domain";

const dna: DnaProfile = {
  clientId: "schneider", name: "Hubertus Schneider", mandate: "Balanced", style: "values-led",
  traits: [{
    id: "neuro-mission", label: "Neuroscience research mission",
    detail: "divest if abandons Parkinson's", confidence: 0.9,
    evidence: [{ kind: "crm", sourceId: "crm:2026-03-05", date: "2026-03-05", quote: "Flag them immediately for divestment." }],
  }],
};
const roche: Holding = {
  isin: "CH0012032048", issuer: "Roche Holding AG", assetClass: "Equities", subAssetClass: "Domestic (CHF)",
  region: "Schweiz", industryGroup: "Health Care", targetCHF: 110000, currentCHF: 112461.84, valor: "", mic: "", yahoo: "",
};
const news: NewsEvent[] = [{
  id: "n1", headline: "Roche winds down Parkinson's research", summary: "", affectedIsins: ["CH0012032048"], publishedAt: "2026-06-12",
}];

test("produces an ACT dna-conflict trace citing trait evidence + news, with value at stake", () => {
  const traces = buildAlerts({ dna, holdings: [roche], news, cio: [], drift: [] });
  const conflict = traces.find((t) => t.type === "dna-conflict")!;
  expect(conflict.severity).toBe("act");
  expect(conflict.confidence).toBeCloseTo(0.9, 5);
  expect(conflict.valueAtStakeCHF).toBeCloseTo(112461.84, 2);
  expect(conflict.evidence.some((e) => e.kind === "crm")).toBe(true);
  expect(conflict.evidence.some((e) => e.kind === "news")).toBe(true);
});

test("ACT sorts before WATCH drift breaches", () => {
  const drift: DriftBreach[] = [{ subAssetClass: "Foreign (Dev. Markets)", targetPct: 34.5, currentPct: 37, deltaPct: 2.5, breached: true }];
  const traces = buildAlerts({ dna, holdings: [roche], news, cio: [], drift });
  expect(traces[0].severity).toBe("act");
  expect(traces.some((t) => t.type === "drift-breach")).toBe(true);
});

test("no news hit on held ISIN => no dna-conflict", () => {
  const traces = buildAlerts({ dna, holdings: [roche], news: [], cio: [], drift: [] });
  expect(traces.some((t) => t.type === "dna-conflict")).toBe(false);
});
