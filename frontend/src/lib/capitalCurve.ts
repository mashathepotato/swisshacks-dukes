// Invested-capital curve — the HONEST time-series. We hold no historical prices,
// so a mark-to-market path would be fabrication. Instead we plot only what the
// data actually supports: cumulative net invested capital (deposits − withdrawals),
// cumulative net trade flow, and cumulative realised income (coupons − fees),
// with the current holdings value as a single labelled endpoint. Pure.

import type { PMandate, PTransaction, PCashFlow } from "./portfolio";
import { TRANSACTIONS, CASHFLOWS } from "../data/portfolio";

export interface CurvePoint {
  date: string;          // YYYY-MM-DD
  investedCHF: number;   // cumulative deposits − withdrawals
  netTradeCHF: number;   // cumulative BUY − SELL amounts
  cumIncomeCHF: number;  // cumulative coupons − fees
}

export interface CapitalCurve {
  points: CurvePoint[];
  currentValueCHF: number;  // Σ current holdings value, the "today" endpoint
  investedNowCHF: number;   // net invested capital as of the last event
  incomeNowCHF: number;     // total realised income to date
}

type Ev = { date: string; invested: number; trade: number; income: number };

const evFromTx = (t: PTransaction): Ev => ({
  date: t.date,
  invested: 0,
  trade: t.side === "BUY" ? t.amountCHF : -t.amountCHF,
  income: 0,
});

const evFromCf = (f: PCashFlow): Ev => {
  // Amounts are stored signed (withdrawals/fees negative); normalise by side so
  // the maths is explicit regardless of sign conventions in the source.
  const a = Math.abs(f.amountCHF);
  if (f.side === "DEPOSIT") return { date: f.date, invested: a, trade: 0, income: 0 };
  if (f.side === "WITHDRAWAL") return { date: f.date, invested: -a, trade: 0, income: 0 };
  if (f.side === "COUPON") return { date: f.date, invested: 0, trade: 0, income: a };
  return { date: f.date, invested: 0, trade: 0, income: -a }; // FEE
};

export function buildCapitalCurve(mandate: PMandate, currentValueCHF: number): CapitalCurve {
  const events: Ev[] = [
    ...(CASHFLOWS[mandate] ?? []).map(evFromCf),
    ...(TRANSACTIONS[mandate] ?? []).map(evFromTx),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let invested = 0;
  let trade = 0;
  let income = 0;
  const byDate = new Map<string, CurvePoint>();
  for (const e of events) {
    invested += e.invested;
    trade += e.trade;
    income += e.income;
    // collapse same-day events into one point (last write wins on the running totals)
    byDate.set(e.date, {
      date: e.date,
      investedCHF: Math.round(invested),
      netTradeCHF: Math.round(trade),
      cumIncomeCHF: Math.round(income),
    });
  }
  const points = [...byDate.values()];
  return {
    points,
    currentValueCHF: Math.round(currentValueCHF),
    investedNowCHF: Math.round(invested),
    incomeNowCHF: Math.round(income),
  };
}
