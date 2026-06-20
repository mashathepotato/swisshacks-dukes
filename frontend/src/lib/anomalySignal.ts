// Turn a detected market AnomalyEvent into a per-client `market_anomaly` signal,
// with severity scaled by the client's CHF exposure to the moved holding. Keeps
// the dashboard's NewsSignal shape so it flows through the existing queue, badge
// and Glass-Thread UI unchanged.

import type { AnomalyEvent } from "./anomaly";
import type { NewsSignal } from "../types";

// A position this size gets the full exposure boost; smaller positions less.
export const EXPOSURE_REF_CHF = 250_000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function exposureScale(exposureCHF: number): number {
  // 0.85× for a negligible position → 1.15× at/above the reference size.
  return 0.85 + 0.3 * Math.min(1, Math.max(0, exposureCHF) / EXPOSURE_REF_CHF);
}

export function anomalySignal(event: AnomalyEvent, exposureCHF: number): NewsSignal {
  const arrow = event.direction < 0 ? "▼" : "▲";
  const pct = Math.abs(event.latestReturn * 100).toFixed(1);
  const sigma = Math.abs(event.z).toFixed(1);
  const volNote = event.kind === "return_shock" ? "" : ` on ${event.volRatio.toFixed(1)}× volume`;
  const severity = Math.round(clamp(event.severity * exposureScale(exposureCHF), 0, 100));

  return {
    id: `anom-${event.isin}-${event.asOf}`,
    headline: `${event.issuer} ${arrow} ${pct}% — ${sigma}σ daily move${volNote}`,
    source: event.source === "six" ? `SIX · EOD ${event.asOf}` : `Synthetic series · ${event.asOf}`,
    publishedAt: event.asOf,
    summary:
      `${event.issuer} moved ${arrow === "▼" ? "down" : "up"} ${pct}% on ${event.asOf} — ` +
      `a ${sigma}σ daily move${volNote} relative to its 30-day volatility.`,
    type: "market_anomaly",
    severity,
    matchedHoldings: [event.issuer],
  };
}
