import { CioEntry, DnaProfile, DriftBreach, Evidence, Holding, NewsEvent, Severity, Trace } from "../../shared/domain";

const rank: Record<Severity, number> = { act: 0, watch: 1, info: 2 };

// A trait whose evidence mentions divestment/betrayal is treated as a divestment mandate.
function isDivestmentTrait(dna: DnaProfile): DnaProfile["traits"][number] | undefined {
  return dna.traits.find((t) =>
    t.evidence.some((e) => /divest|betrayal|abandon|defund/i.test(e.quote)) || /divest/i.test(t.detail)
  );
}

export function buildAlerts(input: {
  dna: DnaProfile; holdings: Holding[]; news: NewsEvent[]; cio: CioEntry[]; drift: DriftBreach[];
}): Trace[] {
  const { dna, holdings, news, cio, drift } = input;
  const heldByIsin = new Map(holdings.map((h) => [h.isin, h]));
  const traces: Trace[] = [];
  const divTrait = isDivestmentTrait(dna);

  // (a) dna-conflict: news hits a held ISIN and the client has a divestment trait
  for (const ev of news) {
    for (const isin of ev.affectedIsins) {
      const holding = heldByIsin.get(isin);
      if (!holding || !divTrait) continue;
      const evidence: Evidence[] = [
        ...divTrait.evidence,
        { kind: "news", sourceId: ev.id, date: ev.publishedAt, quote: ev.headline, ref: ev.url },
      ];
      traces.push({
        id: `dna-conflict:${isin}`,
        claim: `${holding.issuer} now conflicts with the client's "${divTrait.label}"`,
        type: "dna-conflict",
        confidence: divTrait.confidence,
        severity: "act",
        evidence,
        valueAtStakeCHF: holding.currentCHF,
      });
    }
  }

  // (b) cio-sell: held ISIN rated SELL
  for (const c of cio) {
    if (c.rating !== "SELL") continue;
    const holding = heldByIsin.get(c.isin);
    if (!holding) continue;
    traces.push({
      id: `cio-sell:${c.isin}`,
      claim: `${holding.issuer} is CIO-rated SELL but still held`,
      type: "cio-sell",
      confidence: 0.8,
      severity: "watch",
      evidence: [{ kind: "cio", sourceId: c.isin, date: c.ratingSince, quote: c.cioView, ref: c.isin }],
      valueAtStakeCHF: holding.currentCHF,
    });
  }

  // (c) drift-breach
  for (const d of drift) {
    if (!d.breached) continue;
    traces.push({
      id: `drift:${d.subAssetClass}`,
      claim: `${d.subAssetClass} is ${d.deltaPct > 0 ? "over" : "under"} target by ${Math.abs(d.deltaPct).toFixed(1)}pp`,
      type: "drift-breach",
      confidence: 1,
      severity: "watch",
      evidence: [{ kind: "market", sourceId: d.subAssetClass, date: "", quote: `target ${d.targetPct}% vs current ${d.currentPct.toFixed(1)}%` }],
    });
  }

  return traces.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
