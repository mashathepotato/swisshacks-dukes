// Wire detected market anomalies into the client book: each anomalous instrument
// fans out to every client whose mandate holds it, as a `market_anomaly` signal
// whose severity is scaled by that client's CHF exposure. Pure — returns new
// client objects; the input is untouched.

import type { Client, Mandate, NewsSignal } from "../types";
import { detectAnomalies, type InstrumentSeries } from "./anomaly";
import { anomalySignal } from "./anomalySignal";

interface Holding {
  isin: string;
  issuer: string;
  currentCHF: number;
}

export function attachAnomalies(
  clients: Client[],
  series: InstrumentSeries[],
  holdingsFor: (mandate: Mandate) => Holding[],
): Client[] {
  const events = detectAnomalies(series);

  return clients.map((c) => {
    const held = holdingsFor(c.mandate);
    const extra: NewsSignal[] = [];
    for (const ev of events) {
      const h = held.find((x) => x.isin === ev.isin);
      if (h) extra.push(anomalySignal(ev, h.currentCHF));
    }
    if (!extra.length) return c;

    // Most-severe first so the queue badge + Glass Thread reflect the driver.
    const signals = [...c.signals, ...extra].sort((a, b) => b.severity - a.severity);
    return { ...c, signals };
  });
}
