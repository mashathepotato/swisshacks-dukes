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
  const traitById = (id?: string) => (id ? dna.traits.find((t) => t.id === id) : undefined);
  const newsEvidence = (ev: NewsEvent): Evidence => ({
    kind: "news", sourceId: ev.id, date: ev.publishedAt, quote: ev.headline, ref: ev.url,
  });

  for (const ev of news) {
    const kind = ev.kind ?? "threat";

    // (a) threat → dna-conflict: news hits a held ISIN, divestment-style trait applies
    if (kind === "threat") {
      const trait = traitById(ev.triggerTraitId) ?? divTrait;
      if (!trait) continue;
      for (const isin of ev.affectedIsins) {
        const holding = heldByIsin.get(isin);
        if (!holding) continue;
        traces.push({
          id: `dna-conflict:${isin}`,
          claim: `${holding.issuer} now conflicts with the client's "${trait.label}"`,
          type: "dna-conflict",
          confidence: trait.confidence,
          severity: "act",
          evidence: [...trait.evidence, newsEvidence(ev)],
          valueAtStakeCHF: holding.currentCHF,
        });
      }
      continue;
    }

    // (b) opportunity → dna-opportunity: positive news aligned with a client value
    if (kind === "opportunity") {
      const trait = traitById(ev.triggerTraitId) ?? dna.traits[0];
      if (!trait) continue;
      for (const isin of ev.affectedIsins) {
        const holding = heldByIsin.get(isin);
        const name = holding ? holding.issuer : isin;
        traces.push({
          id: `dna-opportunity:${isin}`,
          claim: `${name} aligns with the client's "${trait.label}" — consider increasing exposure`,
          type: "dna-opportunity",
          confidence: trait.confidence,
          severity: "info",
          evidence: [...trait.evidence, newsEvidence(ev)],
          valueAtStakeCHF: holding ? holding.currentCHF : undefined,
        });
      }
      continue;
    }

    // (c) cio-directive → cio-dna-conflict: a CIO push that conflicts with client DNA
    if (kind === "cio-directive") {
      const trait = traitById(ev.triggerTraitId) ?? dna.traits[0];
      if (!trait) continue;
      traces.push({
        id: `cio-dna-conflict:${ev.id}`,
        claim: `CIO directive conflicts with the client's "${trait.label}" — escalate to RM before applying`,
        type: "cio-dna-conflict",
        confidence: trait.confidence,
        severity: "act",
        evidence: [...trait.evidence, newsEvidence(ev)],
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
