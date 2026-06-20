// Behavioral DNA — derives a client's investing temperament from their ACTUAL
// 3-year trade blotter + cash-flow history (data/portfolio/*.csv), not authored
// text. Every trait carries a verbatim receipt (the real row + desk rationale)
// so it reads as evidence, never a black-box label. Pure + deterministic.

import type { Evidence, ThemeId } from "../types";
import type { PMandate, PTransaction, PCashFlow } from "./portfolio";
import { PERSONA_PLAY } from "./portfolio";
import { TRANSACTIONS, CASHFLOWS } from "../data/portfolio";

export type TraitId =
  | "accumulator"
  | "income_harvester"
  | "year_end_liquidity"
  | "disciplined_rebalancer"
  | "held_through";

export interface BehavioralTrait {
  id: TraitId;
  label: string;
  detail: string;          // one line, includes the computed statistic
  receipt: Evidence;       // a verbatim trade/flow row backing the trait
  affinityHint?: ThemeId;  // optional nudge toward a value theme
}

// Full CHF figure with Swiss grouping, for receipt quotes (formatMoney is too coarse).
const chf = (n: number) => `CHF ${Math.round(Math.abs(n)).toLocaleString("en-CH")}`;

const monthOf = (date: string) => Number((date.split("-")[1] ?? "0"));

const txReceipt = (t: PTransaction): Evidence => ({
  kind: "market",
  sourceId: `Trade blotter · ${t.id}`,
  date: t.date,
  quote: `${t.side} ${chf(t.amountCHF)} ${t.issuer} — ${t.rationale}`,
  ref: t.isin,
});

const cfReceipt = (f: PCashFlow): Evidence => ({
  kind: "market",
  sourceId: `Cash flows · ${f.id}`,
  date: f.date,
  quote: `${f.side} ${chf(f.amountCHF)} — ${f.rationale}`,
});

// Detector priority — stable order so the UI shows the highest-signal traits first.
const PRIORITY: TraitId[] = [
  "disciplined_rebalancer",
  "held_through",
  "accumulator",
  "income_harvester",
  "year_end_liquidity",
];

/**
 * Run every detector over one mandate's trade + cash-flow history. When a
 * scenario `sellIsin` is supplied, the rebalance trait prefers a row on that
 * holding so the trait ties to the active scenario (e.g. the Adidas trim).
 */
export function deriveBehavioralDNA(mandate: PMandate, sellIsin?: string): BehavioralTrait[] {
  const txns = TRANSACTIONS[mandate] ?? [];
  const flows = CASHFLOWS[mandate] ?? [];
  const out: BehavioralTrait[] = [];

  // Disciplined rebalancer — trims rallies / lands on target weights.
  const rebal = txns.filter((t) => t.side === "SELL" && /trim on rally|rebalance|land on target/i.test(t.rationale));
  if (rebal.length) {
    const onScenario = sellIsin ? rebal.filter((t) => t.isin === sellIsin) : [];
    const pick = (onScenario.length ? onScenario : rebal).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      id: "disciplined_rebalancer",
      label: "Disciplined rebalancer",
      detail: `Trims rallies and lands on target weights — ${rebal.length} disciplined sells over the mandate.`,
      receipt: txReceipt(pick),
    });
  }

  // Holds through drawdowns — adds on dips rather than panic-selling.
  const dips = txns.filter((t) => t.side === "BUY" && /add on dip|DCA into existing/i.test(t.rationale));
  if (dips.length >= 3) {
    const pick = dips.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      id: "held_through",
      label: "Holds through drawdowns",
      detail: `Adds on weakness instead of selling — ${dips.length} dip / DCA buys, no panic exits.`,
      receipt: txReceipt(pick),
    });
  }

  // Disciplined accumulator — recurring deposits beyond the inception funding.
  const deposits = flows.filter(
    (f) => f.side === "DEPOSIT" && /recurring|top-up|contribution|reinvestment|asset transfer/i.test(f.rationale)
  );
  if (deposits.length >= 3) {
    const pick = deposits.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      id: "accumulator",
      label: "Disciplined accumulator",
      detail: `${deposits.length} recurring top-ups since inception — a steady saver who keeps funding the mandate.`,
      receipt: cfReceipt(pick),
      affinityHint: "income",
    });
  }

  // Income-oriented — collects coupon income across the book.
  const coupons = flows.filter((f) => f.side === "COUPON");
  if (coupons.length >= 5) {
    const total = coupons.reduce((s, f) => s + Math.abs(f.amountCHF), 0);
    const pick = coupons.slice().sort((a, b) => Math.abs(b.amountCHF) - Math.abs(a.amountCHF))[0];
    out.push({
      id: "income_harvester",
      label: "Income-oriented",
      detail: `${coupons.length} coupons totalling ${chf(total)} collected — values a steady income stream.`,
      receipt: cfReceipt(pick),
      affinityHint: "income",
    });
  }

  // Year-end liquidity pattern — withdrawals clustered around Dec / Jan.
  const yearEnd = flows.filter((f) => f.side === "WITHDRAWAL" && (monthOf(f.date) === 12 || monthOf(f.date) === 1));
  if (yearEnd.length) {
    const pick = yearEnd.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      id: "year_end_liquidity",
      label: "Year-end liquidity pattern",
      detail: `Tends to draw liquidity around the turn of the year (${yearEnd.length} Dec/Jan withdrawals) — plan ahead of these dates.`,
      receipt: cfReceipt(pick),
    });
  }

  return out.sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id)).slice(0, 4);
}

/** Traits for a client, mapped via PERSONA_PLAY. Returns [] for synthetic twins. */
export function behavioralForClient(clientId: string): BehavioralTrait[] {
  const play = PERSONA_PLAY[clientId];
  if (!play) return [];
  return deriveBehavioralDNA(play.mandate, play.sellIsin);
}

// ---- transaction receipts (Feature 3) -------------------------------------
// Surface a client's real past trades on a given holding as Evidence receipts,
// reused inside the Glass Thread and the Compliance Desk.

export function tradesForIsin(mandate: PMandate, isin: string): PTransaction[] {
  return (TRANSACTIONS[mandate] ?? [])
    .filter((t) => t.isin === isin)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Up to `limit` verbatim trade receipts on `isin`, most recent first. [] if none. */
export function tradeReceipts(mandate: PMandate, isin: string, limit = 3): Evidence[] {
  return tradesForIsin(mandate, isin).slice(0, limit).map(txReceipt);
}
