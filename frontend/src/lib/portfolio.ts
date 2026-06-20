// Deterministic portfolio engines ported from the Phase A–C backend, as pure
// browser-friendly functions over the real CSV-derived data (src/data/portfolio.ts).
// These ground the copilot's recommendations in the actual CIO list + mandate
// drift maths, instead of authored numbers.

export type PMandate = "Defensive" | "Balanced" | "Growth";

export interface PHolding {
  isin: string;
  issuer: string;
  assetClass: string;
  industryGroup: string;
  subAssetClass: string;
  region: string;
  currentCHF: number;
  targetCHF: number;
}

/** A single executed trade from the 3-year blotter (data/portfolio/transactions_*.csv). */
export interface PTransaction {
  id: string;
  date: string;            // YYYY-MM-DD
  isin: string;
  issuer: string;
  side: "BUY" | "SELL";
  amountCHF: number;
  rationale: string;       // free-text desk note, e.g. "Trim on rally · realising gains"
}

/** A cash movement: deposit, withdrawal, coupon or fee (data/portfolio/cash_flows.csv). */
export interface PCashFlow {
  id: string;
  date: string;            // YYYY-MM-DD
  side: "DEPOSIT" | "WITHDRAWAL" | "COUPON" | "FEE";
  amountCHF: number;       // signed as stored (withdrawals/fees negative)
  rationale: string;
}
export interface PCio {
  isin: string;
  issuer: string;
  rating: "BUY" | "HOLD" | "SELL";
  industryGroup: string;
  subAssetClass: string;
  cioView: string;
  ratingSince: string;
}
export interface PStrategy {
  subAssetClass: string;
  defPct: number;
  balancedPct: number;
  growthPct: number;
}

export interface DriftBreach {
  subAssetClass: string;
  targetPct: number;
  currentPct: number;
  deltaPct: number;
  breached: boolean;
}

export interface SwapCandidate {
  isin: string;
  issuer: string;
  cioView: string;
  reason: string;
}
export interface RejectedCandidate {
  isin: string;
  issuer: string;
  reason: string;
}
export interface SwapResult {
  sell: { isin: string; issuer: string };
  chosen: SwapCandidate | null;
  alternatives: SwapCandidate[];
  rejected: RejectedCandidate[];
}

export interface SimResult {
  sell: { isin: string; issuer: string; currentCHF: number };
  buy: { isin: string; issuer: string; rating: "BUY" | "HOLD" | "SELL" | null; industryGroup: string };
  amountCHF: number;
  sameSector: boolean;
  buyRatingOk: boolean;
  driftBefore: DriftBreach[];
  driftAfter: DriftBreach[];
  newBreaches: string[];
  compliant: boolean;
  dna: { verdict: "honors" | "conflicts" | "neutral"; reason: string };
}

// ---- drift ----------------------------------------------------------------

export function subAssetWeights(holdings: PHolding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + h.currentCHF, 0);
  const by: Record<string, number> = {};
  for (const h of holdings) by[h.subAssetClass] = (by[h.subAssetClass] || 0) + h.currentCHF;
  const w: Record<string, number> = {};
  for (const k of Object.keys(by)) w[k] = total === 0 ? 0 : (by[k] / total) * 100;
  return w;
}

const targetFor = (t: PStrategy, m: PMandate) =>
  m === "Defensive" ? t.defPct : m === "Growth" ? t.growthPct : t.balancedPct;

export function computeDrift(holdings: PHolding[], strategies: PStrategy[], mandate: PMandate): DriftBreach[] {
  const weights = subAssetWeights(holdings);
  return strategies
    .filter((t) => weights[t.subAssetClass] !== undefined || targetFor(t, mandate) > 0)
    .map((t) => {
      const currentPct = weights[t.subAssetClass] || 0;
      const targetPct = targetFor(t, mandate);
      const deltaPct = currentPct - targetPct;
      return { subAssetClass: t.subAssetClass, targetPct, currentPct, deltaPct, breached: Math.abs(deltaPct) > 2.0 };
    });
}

// ---- swap (CIO-constrained, explainable ranking) --------------------------

export function proposeSwap(sellIsin: string, holdings: PHolding[], cio: PCio[]): SwapResult {
  const sellHolding = holdings.find((h) => h.isin === sellIsin);
  const sellCio = cio.find((c) => c.isin === sellIsin);
  const group = sellHolding?.industryGroup || sellCio?.industryGroup || "";
  const sellSub = sellHolding?.subAssetClass || sellCio?.subAssetClass || "";
  const heldIsins = new Set(holdings.map((h) => h.isin));
  const sellIssuer = sellHolding?.issuer || sellCio?.issuer || sellIsin;

  const sameGroup = cio.filter((c) => c.industryGroup === group && c.isin !== sellIsin);
  const rejected: RejectedCandidate[] = [];
  const eligible: PCio[] = [];
  for (const c of sameGroup) {
    if (c.rating !== "BUY") rejected.push({ isin: c.isin, issuer: c.issuer, reason: `not CIO-BUY (${c.rating})` });
    else if (heldIsins.has(c.isin)) rejected.push({ isin: c.isin, issuer: c.issuer, reason: "already held" });
    else eligible.push(c);
  }

  // Prefer the same sub-asset class so the swap doesn't shift sleeve weights.
  const sameSub = (c: PCio) => Boolean(sellSub) && c.subAssetClass === sellSub;
  eligible.sort((a, b) => (sameSub(b) ? 1 : 0) - (sameSub(a) ? 1 : 0));

  const toCandidate = (c: PCio, top: boolean): SwapCandidate => ({
    isin: c.isin,
    issuer: c.issuer,
    cioView: c.cioView,
    reason: top
      ? sameSub(c)
        ? `Top pick: CIO-BUY in the same sector AND the same sub-asset class (${sellSub}) as ${sellIssuer}, so it preserves your sleeve weights.`
        : `Top pick: the closest CIO-BUY in the same sector — note it sits in a different sub-asset class (${c.subAssetClass}) than ${sellIssuer}, so it shifts that sleeve.`
      : sameSub(c)
        ? `Same-sector, same-sleeve CIO-BUY — a clean alternative.`
        : `Same-sector CIO-BUY, but a different sub-asset class (${c.subAssetClass}) than ${sellIssuer}.`,
  });

  return {
    sell: { isin: sellIsin, issuer: sellIssuer },
    chosen: eligible[0] ? toCandidate(eligible[0], true) : null,
    alternatives: eligible.slice(1).map((c) => toCandidate(c, false)),
    rejected,
  };
}

// ---- what-if simulator (compliance + DNA verdict) -------------------------

export interface SimInput {
  holdings: PHolding[];
  strategies: PStrategy[];
  cio: PCio[];
  mandate: PMandate;
  sellIsin: string;
  buyIsin: string;
  amountCHF?: number;
  aversionTerms?: string[];      // industry-group terms the client is averse to
  sellResolvesConflict?: boolean;
}

export function simulateSwap(input: SimInput): SimResult {
  const { holdings, strategies, cio, mandate, sellIsin, buyIsin } = input;
  const sell = holdings.find((h) => h.isin === sellIsin);
  const buyCio = cio.find((c) => c.isin === buyIsin);
  const amountCHF = input.amountCHF ?? (sell ? sell.currentCHF : 0);

  const after = holdings.map((h) => ({ ...h }));
  const s = after.find((h) => h.isin === sellIsin);
  if (s) s.currentCHF = Math.max(0, s.currentCHF - amountCHF);
  const existing = after.find((h) => h.isin === buyIsin);
  if (existing) existing.currentCHF += amountCHF;
  else if (buyCio) after.push({ isin: buyIsin, issuer: buyCio.issuer, assetClass: "", industryGroup: buyCio.industryGroup, subAssetClass: buyCio.subAssetClass, region: "", currentCHF: amountCHF, targetCHF: amountCHF });

  const driftBefore = computeDrift(holdings, strategies, mandate);
  const driftAfter = computeDrift(after, strategies, mandate);
  const breachedBefore = new Set(driftBefore.filter((d) => d.breached).map((d) => d.subAssetClass));
  const newBreaches = driftAfter.filter((d) => d.breached && !breachedBefore.has(d.subAssetClass)).map((d) => d.subAssetClass);

  const sameSector = !!(sell && buyCio && sell.industryGroup === buyCio.industryGroup);
  const buyRatingOk = buyCio?.rating === "BUY";
  const buy = { isin: buyIsin, issuer: buyCio?.issuer || buyIsin, rating: buyCio?.rating ?? null, industryGroup: buyCio?.industryGroup || "" };

  const ig = buy.industryGroup.toLowerCase();
  const conflicts = (input.aversionTerms ?? []).some((t) => ig.includes(t.toLowerCase()));
  const dna = conflicts
    ? { verdict: "conflicts" as const, reason: `Buying ${buy.issuer} (${buy.industryGroup}) conflicts with the client's stated aversion.` }
    : input.sellResolvesConflict
      ? { verdict: "honors" as const, reason: "Selling this holding resolves the client's flagged values conflict." }
      : { verdict: "neutral" as const, reason: "No new values conflict detected for this swap." };

  return {
    sell: { isin: sellIsin, issuer: sell?.issuer || sellIsin, currentCHF: sell?.currentCHF || 0 },
    buy,
    amountCHF,
    sameSector,
    buyRatingOk,
    driftBefore,
    driftAfter,
    newBreaches,
    compliant: sameSector && buyRatingOk && newBreaches.length === 0,
    dna,
  };
}

// ---- monetary impact (explainable, component-based) -----------------------
// Estimates the CHF benefit/cost to a client of following a piece of advice over
// a 12-month horizon. Every figure traces to the real position value × a stated
// assumption — surfaced in each component's `note`, never a black-box forecast.

export interface ImpactComponent {
  label: string;
  amountCHF: number; // signed: + benefit, − cost
  note: string;      // the formula / assumption behind the figure
}
export interface MonetaryImpact {
  netCHF: number;
  horizonMonths: number;
  exposureCHF: number;
  components: ImpactComponent[];
}

const TX_COST_RATE = 0.002;     // 0.20% round-trip transaction cost
const CIO_PREMIUM = 0.015;      // 1.5% expected 12-month relative outperformance for a CIO-BUY
const MAX_DRAWDOWN = 0.25;      // a maximum-severity event ≈ 25% drawdown on the affected position

const k = (n: number) => Math.round(n).toLocaleString("en-CH");

export function estimateImpact(args: {
  exposureCHF: number;
  mode: "protect" | "risk-on" | "neutral";
  severity: number; // 0..100 event severity (or conviction)
  hasTrade: boolean;
}): MonetaryImpact {
  const { exposureCHF, mode, severity, hasTrade } = args;
  const drawdown = Math.max(0, Math.min(1, severity / 100)) * MAX_DRAWDOWN;
  const comps: ImpactComponent[] = [];

  if (mode === "protect" && exposureCHF > 0) {
    comps.push({
      label: "Downside avoided",
      amountCHF: exposureCHF * drawdown,
      note: `Exiting removes the flagged event risk: severity ${Math.round(severity)} ≈ ${Math.round(drawdown * 100)}% expected drawdown on the CHF ${k(exposureCHF)} position.`,
    });
  } else if (mode === "risk-on" && exposureCHF > 0) {
    comps.push({
      label: "Downside risk added",
      amountCHF: -exposureCHF * drawdown * 0.6,
      note: `Raises exposure to a higher-volatility sleeve the client distrusts: ≈ ${Math.round(drawdown * 60)}% potential drawdown added on CHF ${k(exposureCHF)}.`,
    });
  }

  if (hasTrade && exposureCHF > 0) {
    comps.push({
      label: "Transaction cost",
      amountCHF: -exposureCHF * TX_COST_RATE,
      note: `${(TX_COST_RATE * 100).toFixed(2)}% round-trip cost on the CHF ${k(exposureCHF)} traded.`,
    });
    if (mode !== "risk-on") {
      comps.push({
        label: "CIO conviction premium",
        amountCHF: exposureCHF * CIO_PREMIUM,
        note: `Rotating into a CIO-BUY ≈ ${(CIO_PREMIUM * 100).toFixed(1)}% expected 12-month relative outperformance.`,
      });
    }
  }

  return { netCHF: comps.reduce((s, c) => s + c.amountCHF, 0), horizonMonths: 12, exposureCHF, components: comps };
}

// ---- persona ↔ real-data play --------------------------------------------
// Maps each challenge persona to its real flagged holding + scenario, so the
// compliance desk operates on the actual portfolio rather than the authored
// narrative names.

export interface PersonaPlay {
  mandate: PMandate;
  sellIsin: string;       // the real holding the scenario centres on
  scenario: string;       // one-line framing
  resolvesConflict: boolean; // selling it clears a values conflict
  aversionTerms?: string[];  // sectors the client is averse to (for what-if buys)
}

export const PERSONA_PLAY: Record<string, PersonaPlay> = {
  ammann: {
    mandate: "Growth",
    sellIsin: "DE000A1EWWW0", // Adidas — labour-scandal exposure
    scenario: "A labour-exploitation scandal hits a held consumer brand (Adidas).",
    resolvesConflict: true,
  },
  schneider: {
    mandate: "Balanced",
    sellIsin: "CH0012032048", // Roche — winds down Parkinson's research
    scenario: "A core pharma holding (Roche) winds down the family's disease research.",
    resolvesConflict: true,
  },
  raeber: {
    mandate: "Defensive",
    sellIsin: "CH0038863350", // Nestlé — the staple the CIO wants to trim into US tech
    scenario: "The CIO wants to rotate defensive value into US mega-cap tech the client distrusts.",
    resolvesConflict: false,
    aversionTerms: ["information technology"],
  },
  huber: {
    mandate: "Defensive",
    sellIsin: "GB00B10RZP78", // Unilever — opportunity (already held, aligned)
    scenario: "A held name (Unilever) takes a landmark anti-deforestation stance — an opportunity to lean in.",
    resolvesConflict: false,
  },
  lecun: {
    mandate: "Growth",
    sellIsin: "US30303M1027", // Meta Platforms — anti-Meta AI strategy + US-mega-cap exit
    scenario: "He wants out of Meta over its LLM-first AI strategy and out of US mega-cap tech generally, tilting the book toward Europe.",
    resolvesConflict: true,
  },
};
