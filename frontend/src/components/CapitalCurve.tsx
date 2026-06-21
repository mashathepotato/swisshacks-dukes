import { useMemo } from "react";
import type { Client } from "../types";
import { PERSONA_PLAY } from "../lib/portfolio";
import { PORTFOLIOS } from "../data/portfolio";
import { buildCapitalCurve } from "../lib/capitalCurve";
import { formatMoney } from "../lib/format";
import { Collapsible } from "./Collapsible";

const W = 520, H = 210;
const PAD = { l: 8, r: 78, t: 14, b: 26 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

/**
 * Invested-capital + realised-income time-series. Deliberately NOT a price
 * chart — we don't hold historical prices, so plotting a value path would be
 * fabrication. The caption states this explicitly (trust over flash).
 */
export function CapitalCurve({ client }: { client: Client }) {
  const play = PERSONA_PLAY[client.id];

  const curve = useMemo(() => {
    if (!play) return null;
    const holdings = PORTFOLIOS[play.mandate];
    const currentValue = holdings.reduce((s, h) => s + h.currentCHF, 0);
    return buildCapitalCurve(play.mandate, currentValue);
  }, [play]);

  if (!play || !curve || curve.points.length < 2) return null;

  const pts = curve.points;
  const t0 = ms(pts[0].date), t1 = ms(pts[pts.length - 1].date);
  const tSpan = Math.max(1, t1 - t0);
  const maxY = Math.max(curve.currentValueCHF, ...pts.map((p) => p.investedCHF)) * 1.05 || 1;

  const x = (d: string) => PAD.l + ((ms(d) - t0) / tSpan) * PLOT_W;
  const y = (v: number) => PAD.t + PLOT_H - (Math.max(0, v) / maxY) * PLOT_H;

  const line = (sel: (p: typeof pts[number]) => number) =>
    pts.map((p) => `${x(p.date).toFixed(1)},${y(sel(p)).toFixed(1)}`).join(" ");

  const investedLine = line((p) => p.investedCHF);
  const incomeLine = line((p) => p.cumIncomeCHF);
  const endX = PAD.l + PLOT_W;
  const cvY = y(curve.currentValueCHF);
  const gridYs = [0, 0.5, 1].map((f) => PAD.t + PLOT_H - f * PLOT_H);

  return (
    <Collapsible
      title="Invested capital & income"
      tag="FROM CASH FLOWS"
      summary={`${formatMoney(curve.currentValueCHF)} value`}
    >
      <div className="card">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
          {gridYs.map((gy, i) => (
            <line key={i} x1={PAD.l} y1={gy} x2={PAD.l + PLOT_W} y2={gy} stroke="#e7e4dc" strokeWidth={1} />
          ))}
          {/* realised income (secondary) */}
          <polyline points={incomeLine} fill="none" stroke="#1f7a4d" strokeWidth={1.5} strokeLinejoin="round" />
          {/* net invested capital (primary) */}
          <polyline points={investedLine} fill="none" stroke="#3a5a8c" strokeWidth={2} strokeLinejoin="round" />
          {/* current holdings value — single labelled endpoint marker */}
          <line x1={PAD.l} y1={cvY} x2={endX} y2={cvY} stroke="#94680a" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={endX} cy={cvY} r={4} fill="#94680a" />
          <text x={endX + 6} y={cvY} fill="#94680a" fontSize={11} fontWeight={700} dominantBaseline="middle">
            {formatMoney(curve.currentValueCHF)}
          </text>
          <text x={endX + 6} y={cvY + 13} fill="#94680a" fontSize={9} dominantBaseline="middle">
            value today
          </text>
          {/* date axis ends */}
          <text x={PAD.l} y={H - 8} fill="#8a8e97" fontSize={9.5}>{pts[0].date}</text>
          <text x={PAD.l + PLOT_W} y={H - 8} fill="#8a8e97" fontSize={9.5} textAnchor="end">{pts[pts.length - 1].date}</text>
        </svg>

        <div className="cc-legend">
          <span><i style={{ background: "#3a5a8c" }} /> Net invested capital · <b>{formatMoney(curve.investedNowCHF)}</b></span>
          <span><i style={{ background: "#1f7a4d" }} /> Realised income (coupons) · <b>{formatMoney(curve.incomeNowCHF)}</b></span>
        </div>
        <p className="cc-caption">
          Invested capital and realised income from the client's <b>actual</b> deposits, withdrawals and coupons.
          This is <b>not</b> a mark-to-market price history. We don't hold historical prices for these positions,
          so we don't draw a value path we can't substantiate.
        </p>
      </div>
    </Collapsible>
  );
}
