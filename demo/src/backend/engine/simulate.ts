import { CioEntry, DnaProfile, Holding, Mandate, SimResult, StrategyTarget } from "../../shared/domain";
import { computeDrift } from "./drift";

export interface SimInput {
  holdings: Holding[];
  strategies: StrategyTarget[];
  cio: CioEntry[];
  dna: DnaProfile;
  mandate: Mandate;
  sellIsin: string;
  buyIsin: string;
  amountCHF?: number;          // defaults to the full sell position
  sellResolvesConflict?: boolean; // true if selling this holding clears a flagged DNA conflict
}

const AVERSION_RE = /avers|avoid|speculat|bubble|hype/i;
const TECH_SYNS = ["tech", " ai", "software", "silicon"];

function dnaVerdict(
  dna: DnaProfile,
  buy: { issuer: string; industryGroup: string },
  sellResolvesConflict?: boolean
): SimResult["dna"] {
  const aversion = dna.traits.find((t) =>
    AVERSION_RE.test(`${t.label} ${t.detail} ${t.evidence.map((e) => e.quote).join(" ")}`)
  );
  if (aversion) {
    const hay = `${aversion.label} ${aversion.detail} ${aversion.evidence.map((e) => e.quote).join(" ")}`.toLowerCase();
    const ig = (buy.industryGroup || "").toLowerCase();
    const tokens = ig.split(/[^a-z]+/).filter((w) => w.length > 3);
    const techMatch = /tech/.test(ig) && TECH_SYNS.some((s) => hay.includes(s));
    if (techMatch || tokens.some((tok) => hay.includes(tok))) {
      return {
        verdict: "conflicts",
        reason: `Buying ${buy.issuer} (${buy.industryGroup}) conflicts with the client's "${aversion.label}".`,
        traitId: aversion.id,
      };
    }
  }
  if (sellResolvesConflict) {
    return { verdict: "honors", reason: "Selling this holding resolves the client's flagged values conflict." };
  }
  return { verdict: "neutral", reason: "No new values conflict detected for this swap." };
}

export function simulateSwap(input: SimInput): SimResult {
  const { holdings, strategies, cio, dna, mandate, sellIsin, buyIsin } = input;
  const sell = holdings.find((h) => h.isin === sellIsin);
  const buyCio = cio.find((c) => c.isin === buyIsin);
  const amountCHF = input.amountCHF ?? (sell ? sell.currentCHF : 0);

  // Apply the hypothetical trade to a copy of the holdings.
  const after = holdings.map((h) => ({ ...h }));
  const s = after.find((h) => h.isin === sellIsin);
  if (s) s.currentCHF = Math.max(0, s.currentCHF - amountCHF);
  const existingBuy = after.find((h) => h.isin === buyIsin);
  if (existingBuy) existingBuy.currentCHF += amountCHF;
  else if (buyCio) {
    after.push({
      isin: buyIsin, issuer: buyCio.issuer, assetClass: sell?.assetClass || "Equities",
      subAssetClass: buyCio.subAssetClass, region: "", industryGroup: buyCio.industryGroup,
      targetCHF: 0, currentCHF: amountCHF, valor: "", mic: "", yahoo: "",
    });
  }

  const driftBefore = computeDrift(holdings, strategies, mandate);
  const driftAfter = computeDrift(after, strategies, mandate);
  const breachedBefore = new Set(driftBefore.filter((d) => d.breached).map((d) => d.subAssetClass));
  const newBreaches = driftAfter.filter((d) => d.breached && !breachedBefore.has(d.subAssetClass)).map((d) => d.subAssetClass);

  const sameSector = !!(sell && buyCio && sell.industryGroup === buyCio.industryGroup);
  const buyRatingOk = buyCio?.rating === "BUY";
  const buy = { isin: buyIsin, issuer: buyCio?.issuer || buyIsin, rating: buyCio?.rating ?? null, industryGroup: buyCio?.industryGroup || "" };

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
    dna: dnaVerdict(dna, buy, input.sellResolvesConflict),
  };
}
