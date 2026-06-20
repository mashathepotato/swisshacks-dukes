// Wire detected market anomalies into the client book: each anomalous instrument
// fans out to every client whose mandate holds it, as a `market_anomaly` signal
// whose severity is scaled by that client's CHF exposure. Pure — returns new
// client objects; the input is untouched.

import type { Client, NewsSignal } from "../types";
import { detectAnomalies, type AnomalyEvent, type InstrumentSeries } from "./anomaly";
import { anomalySignal } from "./anomalySignal";

/**
 * Per-client exposure to a moved instrument, in CHF — or null if this client
 * doesn't hold it. Keeping the association client-specific (their actual
 * positions, not the whole mandate book) is what keeps a market move
 * *personalised* rather than flooding every client in the mandate.
 */
export type ExposureOf = (client: Client, event: AnomalyEvent) => number | null;

export function attachAnomalies(
  clients: Client[],
  series: InstrumentSeries[],
  exposureOf: ExposureOf,
): Client[] {
  const events = detectAnomalies(series);

  return clients.map((c) => {
    const extra: NewsSignal[] = [];
    for (const ev of events) {
      const exposureCHF = exposureOf(c, ev);
      if (exposureCHF != null) extra.push(anomalySignal(ev, exposureCHF));
    }
    if (!extra.length) return c;

    // Most-severe first so the queue badge + Glass Thread reflect the driver.
    const signals = [...c.signals, ...extra].sort((a, b) => b.severity - a.severity);
    return { ...c, signals };
  });
}
