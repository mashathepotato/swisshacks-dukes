// Market-anomaly detector — a pure, deterministic function over a holding's
// daily price/volume series. Flags extreme daily moves (return shock) and volume
// spikes, scored on a comparable 0..100 severity. Grounded in real SIX EOD data
// where coverage exists (US listings); see docs/superpowers/specs/2026-06-20-
// portfolio-anomaly-detection-design.md and data/sixPrices.ts.

export interface PriceBar {
  date: string;            // YYYY-MM-DD (the settled session date)
  close: number;
  volume: number;
  hvol30?: number | null;  // SIX historicalVolatility30Days — ANNUALISED %, may be null
}

export interface InstrumentSeries {
  isin: string;
  issuer: string;
  listingId: string;          // {valor}_{mic}
  source: "six" | "synthetic";
  asOf: string;               // latest bar date (EOD lags a settled day)
  bars: PriceBar[];           // ascending by date
}

export interface AnomalyEvent {
  isin: string;
  issuer: string;
  listingId: string;
  source: "six" | "synthetic";
  asOf: string;               // the ANOMALOUS bar's date (may be a few days back)
  latestReturn: number;       // daily return on that bar
  z: number;                  // vol-scaled z-score of the return
  volRatio: number;           // volume vs the trailing-30 average
  direction: -1 | 1;          // ▼ drop / ▲ spike
  severity: number;           // 0..100
  kind: "return_shock" | "volume_spike" | "both";
}

// One tunable config block (overridable per call).
export const ANOMALY_CONFIG = {
  zThreshold: 3.0,    // |z| at/above which a daily return is a shock
  volThreshold: 4.0,  // volume / trailing-avg at/above which volume is a spike
  zSat: 6,            // |z| at which severity's return component saturates (→100)
  windowBars: 15,     // how many trailing bars to scan for the most-severe move
  minBars: 6,         // below this we can't form a baseline → skip
  baselineBars: 30,   // lookback for the volume average / stdev fallback
};

type Cfg = typeof ANOMALY_CONFIG;
const ANN = Math.sqrt(252); // de-annualisation factor for a 30d annualised vol
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function mean(xs: number[]): number {
  const v = xs.filter((x) => x > 0);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

function stdevReturns(bars: PriceBar[], i: number, lookback: number): number {
  const rs: number[] = [];
  for (let k = Math.max(1, i - lookback); k < i; k++) {
    const p = bars[k - 1].close;
    if (p > 0) rs.push(bars[k].close / p - 1);
  }
  if (rs.length < 2) return 0;
  const m = rs.reduce((s, x) => s + x, 0) / rs.length;
  return Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1));
}

/** Evaluate one bar `i` against its trailing baseline; null if not anomalous. */
function evalBar(bars: PriceBar[], i: number, cfg: Cfg): Omit<AnomalyEvent, "isin" | "issuer" | "listingId" | "source"> | null {
  const prev = bars[i - 1].close;
  if (!(prev > 0)) return null;
  const latestReturn = bars[i].close / prev - 1;

  // Baseline σ comes from the PRIOR bar's annualised 30d vol (the vol going INTO
  // the move, not inflated by the move itself); fall back to trailing stdev.
  const hvol = bars[i - 1].hvol30 ?? bars[i].hvol30 ?? null;
  let dailySigma = hvol != null && hvol > 0 ? hvol / 100 / ANN : 0;
  if (!(dailySigma > 0)) dailySigma = stdevReturns(bars, i, cfg.baselineBars);
  const z = dailySigma > 0 ? latestReturn / dailySigma : 0;

  const volBaseline = mean(bars.slice(Math.max(0, i - cfg.baselineBars), i).map((b) => b.volume));
  const volRatio = volBaseline > 0 ? bars[i].volume / volBaseline : 0;

  const returnFlag = Math.abs(z) >= cfg.zThreshold;
  const volFlag = volRatio >= cfg.volThreshold;
  if (!returnFlag && !volFlag) return null;

  const severity = clamp(
    100 * (Math.abs(z) / cfg.zSat) + 15 * Math.max(0, volRatio / cfg.volThreshold - 1),
    0,
    100,
  );
  const kind = returnFlag && volFlag ? "both" : returnFlag ? "return_shock" : "volume_spike";

  return {
    asOf: bars[i].date,
    latestReturn,
    z,
    volRatio,
    direction: latestReturn < 0 ? -1 : 1,
    severity,
    kind,
  };
}

/** The single most-severe anomaly in the trailing window, or null if calm. */
export function detectAnomaly(s: InstrumentSeries, config: Partial<Cfg> = {}): AnomalyEvent | null {
  const cfg = { ...ANOMALY_CONFIG, ...config };
  const bars = s.bars;
  if (bars.length < cfg.minBars) return null;

  const start = Math.max(1, bars.length - cfg.windowBars);
  let best: AnomalyEvent | null = null;
  for (let i = start; i < bars.length; i++) {
    const e = evalBar(bars, i, cfg);
    if (e && (!best || e.severity > best.severity)) {
      best = { isin: s.isin, issuer: s.issuer, listingId: s.listingId, source: s.source, ...e };
    }
  }
  return best;
}

/** One event per anomalous instrument; calm instruments are dropped. */
export function detectAnomalies(list: InstrumentSeries[], config: Partial<Cfg> = {}): AnomalyEvent[] {
  return list.map((s) => detectAnomaly(s, config)).filter((e): e is AnomalyEvent => e !== null);
}
