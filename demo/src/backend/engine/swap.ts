import { CioEntry, Holding, RejectedCandidate, SwapResult } from "../../shared/domain";

export function proposeSwap(sellIsin: string, holdings: Holding[], cio: CioEntry[]): SwapResult {
  const sellHolding = holdings.find((h) => h.isin === sellIsin);
  const sellCio = cio.find((c) => c.isin === sellIsin);
  const group = sellHolding?.industryGroup || sellCio?.industryGroup || "";
  const heldIsins = new Set(holdings.map((h) => h.isin));
  const sellIssuer = sellHolding?.issuer || sellCio?.issuer || sellIsin;

  const sameGroup = cio.filter((c) => c.industryGroup === group && c.isin !== sellIsin);

  const rejected: RejectedCandidate[] = [];
  const eligible = sameGroup.filter((c) => {
    if (c.rating !== "BUY") {
      rejected.push({ isin: c.isin, issuer: c.issuer, reason: `not CIO-BUY (${c.rating})` });
      return false;
    }
    if (heldIsins.has(c.isin)) {
      rejected.push({ isin: c.isin, issuer: c.issuer, reason: "already held" });
      return false;
    }
    return true;
  });

  const chosen = eligible[0]
    ? { isin: eligible[0].isin, issuer: eligible[0].issuer, cioView: eligible[0].cioView }
    : null;

  return { sell: { isin: sellIsin, issuer: sellIssuer }, chosen, rejected };
}
