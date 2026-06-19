import { CioEntry, Holding, RejectedCandidate, SwapCandidate, SwapResult } from "../../shared/domain";

export function proposeSwap(sellIsin: string, holdings: Holding[], cio: CioEntry[]): SwapResult {
  const sellHolding = holdings.find((h) => h.isin === sellIsin);
  const sellCio = cio.find((c) => c.isin === sellIsin);
  const group = sellHolding?.industryGroup || sellCio?.industryGroup || "";
  const sellSub = sellHolding?.subAssetClass || sellCio?.subAssetClass || "";
  const heldIsins = new Set(holdings.map((h) => h.isin));
  const sellIssuer = sellHolding?.issuer || sellCio?.issuer || sellIsin;

  const sameGroup = cio.filter((c) => c.industryGroup === group && c.isin !== sellIsin);

  const rejected: RejectedCandidate[] = [];
  const eligible: CioEntry[] = [];
  for (const c of sameGroup) {
    if (c.rating !== "BUY") rejected.push({ isin: c.isin, issuer: c.issuer, reason: `not CIO-BUY (${c.rating})` });
    else if (heldIsins.has(c.isin)) rejected.push({ isin: c.isin, issuer: c.issuer, reason: "already held" });
    else eligible.push(c);
  }

  // Rank eligible BUYs: prefer the same sub-asset class as the sell, so the swap
  // doesn't shift sleeve weights (and risk a mandate-drift breach). Array.sort is
  // stable, so CIO list order is the tie-breaker within each group.
  const sameSub = (c: CioEntry) => Boolean(sellSub) && c.subAssetClass === sellSub;
  eligible.sort((a, b) => (sameSub(b) ? 1 : 0) - (sameSub(a) ? 1 : 0));

  const toCandidate = (c: CioEntry, top: boolean): SwapCandidate => ({
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

  const chosen = eligible[0] ? toCandidate(eligible[0], true) : null;
  const alternatives = eligible.slice(1).map((c) => toCandidate(c, false));

  return { sell: { isin: sellIsin, issuer: sellIssuer }, chosen, alternatives, rejected };
}
