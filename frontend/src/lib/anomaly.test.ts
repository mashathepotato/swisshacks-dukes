import { describe, it, expect } from "vitest";
import { detectAnomaly, detectAnomalies, ANOMALY_CONFIG } from "./anomaly";
import type { InstrumentSeries, PriceBar } from "./anomaly";

// --- helpers ---------------------------------------------------------------

let dayCounter = 0;
function bar(close: number, volume: number, hvol30: number | null = 20): PriceBar {
  // dates ascending and unique; values are what matter for the maths
  const d = new Date(Date.UTC(2026, 0, 1 + dayCounter++));
  return { date: d.toISOString().slice(0, 10), close, volume, hvol30 };
}

/** A flat, low-noise series: stable close, steady volume, fixed 30d vol. */
function flatSeries(n: number, close = 100, volume = 1000, hvol30 = 20): PriceBar[] {
  dayCounter = 0;
  const bars: PriceBar[] = [];
  for (let i = 0; i < n; i++) bars.push(bar(close + (i % 2 === 0 ? 0.1 : -0.1), volume, hvol30));
  return bars;
}

function series(bars: PriceBar[], over: Partial<InstrumentSeries> = {}): InstrumentSeries {
  const last = bars[bars.length - 1];
  return {
    isin: "TEST0000001",
    issuer: "Test Co.",
    listingId: "1_XTST",
    source: "six",
    asOf: last.date,
    bars,
    ...over,
  };
}

describe("detectAnomaly — return shock", () => {
  it("flags a sharp drop beyond the z-threshold as a return_shock, direction down", () => {
    // hvol30 = 20% annualized → daily sigma = 0.20/sqrt(252) ≈ 1.26%.
    // A −5% day is ≈ −3.97σ, comfortably past the 3.0 default.
    const bars = flatSeries(34);
    bars.push(bar(95.0, 1100, 20)); // prev close ~99.9 → ~ −4.9% ... compute precisely below
    const ev = detectAnomaly(series(bars));
    expect(ev).not.toBeNull();
    expect(ev!.kind === "return_shock" || ev!.kind === "both").toBe(true);
    expect(ev!.direction).toBe(-1);
    expect(Math.abs(ev!.z)).toBeGreaterThan(3);
    expect(ev!.asOf).toBe(bars[bars.length - 1].date);
  });

  it("does NOT flag an ordinary ~1σ wiggle", () => {
    const bars = flatSeries(34);
    // daily sigma ≈ 1.26%; a 1% move is < 1σ → no flag.
    bars.push(bar(101.0, 1050, 20));
    expect(detectAnomaly(series(bars))).toBeNull();
  });

  it("severity is monotonic in |z| and saturates at 100", () => {
    const mk = (lastClose: number) => {
      const bars = flatSeries(34);
      bars.push(bar(lastClose, 1000, 20));
      return detectAnomaly(series(bars), { zThreshold: 1, volThreshold: 99 });
    };
    const small = mk(97)!; // ~ -3%
    const big = mk(80)!; // ~ -20% → way past saturation
    expect(small.severity).toBeGreaterThan(0);
    expect(big.severity).toBeGreaterThan(small.severity);
    expect(big.severity).toBeLessThanOrEqual(100);
  });
});

describe("detectAnomaly — volume spike", () => {
  it("flags a volume-only spike (flat price) as volume_spike", () => {
    const bars = flatSeries(34, 100, 1000, 20);
    // price essentially flat, volume 8× the ~1000 baseline.
    bars.push(bar(100.05, 8000, 20));
    const ev = detectAnomaly(series(bars));
    expect(ev).not.toBeNull();
    expect(ev!.kind).toBe("volume_spike");
    expect(ev!.volRatio).toBeGreaterThan(ANOMALY_CONFIG.volThreshold);
  });
});

describe("detectAnomaly — guards", () => {
  it("returns null for a too-short series (no baseline)", () => {
    expect(detectAnomaly(series(flatSeries(4)))).toBeNull();
  });

  it("scans a trailing window and surfaces the most-severe bar, not just the last", () => {
    const bars = flatSeries(34);
    bars.push(bar(85, 2000, 20)); // big −15% shock a few bars back
    bars.push(bar(85.1, 1000, 20));
    bars.push(bar(85.0, 1000, 20));
    const ev = detectAnomaly(series(bars));
    expect(ev).not.toBeNull();
    expect(ev!.asOf).toBe(bars[34].date); // the shock bar, not the final flat bar
    expect(ev!.direction).toBe(-1);
  });
});

describe("detectAnomaly — real SIX data (Broadcom, 2026-06)", () => {
  it("flags Broadcom's −12.6% move on 2026-06-04 as a severe return shock", () => {
    // Real end_of_day_history (41112361_XNAS), abbreviated to the run-up + shock.
    const real: [string, number, number, number][] = [
      ["2026-05-26", 422.01, 7177174, 40.68],
      ["2026-05-27", 421.86, 6045943, 39.65],
      ["2026-05-28", 426.58, 5804612, 36.18],
      ["2026-05-29", 446.77, 18819723, 39.02],
      ["2026-06-01", 459.97, 9667895, 40.64],
      ["2026-06-02", 481.57, 11681904, 42.11],
      ["2026-06-03", 479.23, 14726600, 41.25],
      ["2026-06-04", 418.91, 20429618, 63.36], // −12.6% shock
      ["2026-06-05", 385.73, 16152893, 69.39],
    ];
    const bars: PriceBar[] = real.map(([date, close, volume, hvol30]) => ({ date, close, volume, hvol30 }));
    // pad the front with a flat run so there's a >=30-bar baseline
    dayCounter = 0;
    const pad = flatSeries(30, 470, 9_000_000, 41);
    const ev = detectAnomaly(series([...pad, ...bars]), { windowBars: 12 });
    expect(ev).not.toBeNull();
    expect(ev!.asOf).toBe("2026-06-04");
    expect(ev!.direction).toBe(-1);
    expect(Math.abs(ev!.z)).toBeGreaterThan(4); // ≈ −4.9σ
    expect(ev!.severity).toBeGreaterThan(70);
  });
});

describe("detectAnomalies — batch", () => {
  it("returns one event per anomalous instrument and skips the calm ones", () => {
    const calm = series(flatSeries(34), { isin: "CALM0000001", issuer: "Calm Co." });
    const shockBars = flatSeries(34);
    shockBars.push(bar(85, 3000, 20));
    const shocked = series(shockBars, { isin: "SHOCK000001", issuer: "Shock Co." });
    const events = detectAnomalies([calm, shocked]);
    expect(events.map((e) => e.isin)).toEqual(["SHOCK000001"]);
  });
});
