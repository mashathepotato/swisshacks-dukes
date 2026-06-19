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

const alignDna: DnaProfile = {
  clientId: "huber", name: "Marius Huber", mandate: "Defensive", style: "values-led",
  traits: [{
    id: "reforestation", label: "Reforestation mission",
    detail: "rewards companies that protect ecosystems", confidence: 0.88,
    evidence: [{ kind: "crm", sourceId: "crm:2026-01-15", date: "2026-01-15", quote: "call me when a company I own actually does something magnificent for the planet" }],
  }],
};
const unilever: Holding = {
  isin: "GB00B10RZP78", issuer: "Unilever PLC", assetClass: "Equities", subAssetClass: "Foreign (Dev. Markets)",
  region: "Europa", industryGroup: "Consumer Staples", targetCHF: 80000, currentCHF: 80491.1, valor: "", mic: "", yahoo: "",
};

test("opportunity event on a held aligned ISIN produces an INFO dna-opportunity trace", () => {
  const ev: NewsEvent = {
    id: "op1", kind: "opportunity", triggerTraitId: "reforestation",
    headline: "Unilever cuts off palm-oil deforestation suppliers, funds reforestation",
    summary: "", affectedIsins: ["GB00B10RZP78"], publishedAt: "2026-05-20",
  };
  const traces = buildAlerts({ dna: alignDna, holdings: [unilever], news: [ev], cio: [], drift: [] });
  const opp = traces.find((t) => t.type === "dna-opportunity")!;
  expect(opp.severity).toBe("info");
  expect(opp.confidence).toBeCloseTo(0.88, 5);
  expect(opp.valueAtStakeCHF).toBeCloseTo(80491.1, 2);
  expect(opp.evidence.some((e) => e.kind === "crm")).toBe(true);
  expect(opp.evidence.some((e) => e.kind === "news")).toBe(true);
});

const aversionDna: DnaProfile = {
  clientId: "raeber", name: "Eugen Räber", mandate: "Defensive", style: "data-driven",
  traits: [{
    id: "us-tech-aversion", label: "Aversion to speculative US tech",
    detail: "no Silicon Valley cloud bubbles", confidence: 0.9,
    evidence: [{ kind: "crm", sourceId: "crm:2024-11-06", date: "2024-11-06", quote: "abstract software and AI firms are valued on pure hype" }],
  }],
};

test("cio-directive event produces an ACT cio-dna-conflict trace, no held-ISIN required", () => {
  const ev: NewsEvent = {
    id: "cio1", kind: "cio-directive", triggerTraitId: "us-tech-aversion",
    headline: "CIO TAA: rotate defensive value into US mega-cap tech",
    summary: "", affectedIsins: ["US67066G1040"], publishedAt: "2026-05-20",
  };
  const traces = buildAlerts({ dna: aversionDna, holdings: [], news: [ev], cio: [], drift: [] });
  const tension = traces.find((t) => t.type === "cio-dna-conflict")!;
  expect(tension.severity).toBe("act");
  expect(tension.evidence.some((e) => e.kind === "crm")).toBe(true);
  expect(tension.evidence.some((e) => e.kind === "news")).toBe(true);
});
