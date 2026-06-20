// Daily price/volume series feeding the market-anomaly detector (lib/anomaly.ts).
//
// PROVENANCE — honest by construction:
//  • source: "six"       → REAL SIX EOD data, pulled live from the SIX Financial
//    MCP on 2026-06-20 via `end_of_day_history` (US listings; the hackathon token
//    only covers US venues — Swiss/EU venues return empty).
//  • source: "synthetic" → deterministic, clearly-labelled stand-in for Swiss/EU
//    persona holdings the token can't price. NEVER shown as SIX in the UI.
//
// EOD lags one settled trading day; the latest bar here is 2026-06-18.

import type { InstrumentSeries, PriceBar } from "../lib/anomaly";

// Real SIX rows, verbatim: "YYYY-MM-DD close volume hvol30(annualised %)".
// Blank close = exchange holiday (skipped); blank hvol on the latest bar is fine.
const REAL: { isin: string; issuer: string; listingId: string; tsv: string }[] = [
  {
    isin: "US11135F1012",
    issuer: "Broadcom Inc.",
    listingId: "41112361_XNAS",
    tsv: `
2026-04-20 399.63 5641143 44.64
2026-04-21 402.17 4943368 43.48
2026-04-22 422.65 7676801 44.44
2026-04-23 419.94 5969235 44.00
2026-04-24 422.76 6833055 43.87
2026-04-27 418.20 5237326 37.90
2026-04-28 399.83 8838686 43.25
2026-04-29 405.45 5151610 42.15
2026-04-30 417.43 8949449 40.19
2026-05-01 421.28 3793005 40.22
2026-05-04 416.50 5334772 41.79
2026-05-05 427.36 6959698 40.93
2026-05-06 425.44 8062226 40.47
2026-05-07 412.56 7898752 39.62
2026-05-08 430.00 7911538 38.83
2026-05-11 428.43 6112443 38.23
2026-05-12 419.30 6186242 38.47
2026-05-13 416.79 5893375 37.71
2026-05-14 439.79 6173629 41.25
2026-05-15 425.19 8196443 41.52
2026-05-18 420.71 5351317 42.85
2026-05-19 411.07 7003226 42.71
2026-05-20 417.76 5637834 41.98
2026-05-21 414.57 6899151 42.08
2026-05-22 414.14 4972673 38.44
2026-05-26 422.01 7177174 40.68
2026-05-27 421.86 6045943 39.65
2026-05-28 426.58 5804612 36.18
2026-05-29 446.77 18819723 39.02
2026-06-01 459.97 9667895 40.64
2026-06-02 481.57 11681904 42.11
2026-06-03 479.23 14726600 41.25
2026-06-04 418.91 20429618 63.36
2026-06-05 385.73 16152893 69.39
2026-06-08 396.60 12965100 71.44
2026-06-09 392.16 10603297 69.58
2026-06-10 372.10 10869598 69.83
2026-06-11 385.57 11775879 71.10
2026-06-12 382.07 7814963 71.12
2026-06-15 393.94 10751686 72.04
2026-06-16 376.71 11345293 71.63
2026-06-17 392.90 10072259 71.74
2026-06-18 411.35 21883058 `,
  },
  {
    isin: "US0028241000",
    issuer: "Abbott Laboratories",
    listingId: "903037_XNYS",
    tsv: `
2026-04-20 96.00 2012399 27.80
2026-04-21 92.72 3246188 29.14
2026-04-22 91.70 3378574 28.46
2026-04-23 92.48 3583758 28.89
2026-04-24 91.13 2555838 28.68
2026-04-27 92.80 3291377 30.98
2026-04-28 93.86 3396723 30.68
2026-04-29 91.33 2341186 30.99
2026-04-30 90.79 6137712 30.65
2026-05-01 89.46 2738855 30.80
2026-05-04 87.54 3920023 31.78
2026-05-05 87.17 3025528 30.99
2026-05-06 86.30 3084163 30.26
2026-05-07 87.01 2778229 30.71
2026-05-08 84.32 2509301 30.58
2026-05-11 82.56 3390291 31.63
2026-05-12 84.35 3576914 32.66
2026-05-13 83.83 2262026 31.88
2026-05-14 84.90 2792883 32.42
2026-05-15 84.47 3062499 31.74
2026-05-18 87.91 3054193 30.59
2026-05-19 88.82 2604634 30.25
2026-05-20 88.38 2158284 29.52
2026-05-21 87.77 2188131 27.44
2026-05-22 87.41 2238497 27.28
2026-05-26 86.67 2620655 27.08
2026-05-27 85.68 2429768 26.54
2026-05-28 86.30 2135001 26.28
2026-05-29 85.60 9948248 24.94
2026-06-01 87.78 2672830 26.58
2026-06-02 86.97 2336279 26.08
2026-06-03 86.99 2576367 25.42
2026-06-04 90.78 2957354 29.39
2026-06-05 91.07 2671587 29.06
2026-06-08 90.50 4001516 26.30
2026-06-09 91.25 2686098 25.62
2026-06-10 89.17 3098123 26.80
2026-06-11 89.65 3952156 26.02
2026-06-12 88.18 3969843 26.72
2026-06-15 88.67 2720325 23.76
2026-06-16 90.62 2529985 24.33
2026-06-17 88.50 3197907 25.27
2026-06-18 88.41 23148970 `,
  },
  {
    isin: "US0378331005",
    issuer: "Apple Inc.",
    listingId: "908440_XNAS",
    tsv: `
2026-04-20 273.05 12510682 22.71
2026-04-21 266.17 15709183 24.51
2026-04-22 273.17 14288872 25.20
2026-04-23 273.43 11254261 25.19
2026-04-24 271.06 13821720 25.57
2026-04-27 267.61 13432063 26.18
2026-04-28 270.71 11625553 25.61
2026-04-29 270.17 9667374 25.07
2026-04-30 271.35 40096852 23.46
2026-05-01 280.14 23271553 25.47
2026-05-04 276.83 14649894 26.59
2026-05-05 284.18 17512103 27.10
2026-05-06 287.51 19392321 26.56
2026-05-07 287.44 14917954 25.04
2026-05-08 293.32 17233768 24.98
2026-05-11 292.68 13723779 26.00
2026-05-12 294.80 15027326 25.35
2026-05-13 298.87 16117367 24.87
2026-05-14 298.21 11301541 24.90
2026-05-15 300.23 19464078 23.59
2026-05-18 297.84 12224232 23.27
2026-05-19 298.97 13506625 22.68
2026-05-20 302.25 13670836 22.24
2026-05-21 304.99 12592819 19.53
2026-05-22 308.82 14025113 18.39
2026-05-26 308.33 16979734 17.31
2026-05-27 310.85 16169574 16.87
2026-05-28 312.51 18601309 16.81
2026-05-29 312.06 30566920 16.77
2026-06-01 306.31 16918435 16.12
2026-06-02 315.20 15904113 17.72
2026-06-03 310.26 18117434 18.93
2026-06-04 311.23 15419476 17.37
2026-06-05 307.34 22908882 18.10
2026-06-08 301.54 23182591 19.52
2026-06-09 290.55 21721196 23.45
2026-06-10 291.58 15475122 22.89
2026-06-11 295.63 17072997 23.27
2026-06-12 291.13 13056692 23.31
2026-06-15 296.42 16012646 25.25
2026-06-16 299.24 14912500 24.82
2026-06-17 295.95 17101044 24.50
2026-06-18 298.01 38786119 `,
  },
];

function parseTsv(tsv: string): PriceBar[] {
  return tsv
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((c) => c.length >= 3 && c[1] !== "") // skip holiday rows (blank close)
    .map(([date, close, volume, hvol]) => ({
      date,
      close: Number(close),
      volume: Number(volume),
      hvol30: hvol === undefined || hvol === "" ? null : Number(hvol),
    }));
}

// --- synthetic series for Swiss/EU persona holdings the token can't price -----
// Deterministic (seeded per ISIN) so the fixture is stable across runs. Each
// plants ONE clearly-defined shock so the persona's market-anomaly beat lands —
// labelled source:"synthetic" and never disguised as SIX.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

const SESSION_DATES = REAL[0].tsv.trim().split("\n").map((l) => l.trim().split(/\s+/)[0]);

function synthetic(opts: {
  isin: string; issuer: string; listingId: string;
  baseClose: number; baseVol: number; hvol: number;
  dropPct: number; dropDaysAgo: number;
}): InstrumentSeries {
  const rnd = mulberry32(seedOf(opts.isin));
  const n = SESSION_DATES.length;
  const shockIdx = n - 1 - opts.dropDaysAgo;
  let close = opts.baseClose;
  const bars: PriceBar[] = SESSION_DATES.map((date, i) => {
    const drift = (rnd() - 0.5) * 2 * (opts.hvol / 100 / Math.sqrt(252)); // ~1σ daily noise
    close = i === shockIdx ? close * (1 + opts.dropPct) : close * (1 + drift);
    const vol = Math.round(opts.baseVol * (0.8 + 0.4 * rnd()) * (i === shockIdx ? 3 : 1));
    return { date, close: Math.round(close * 100) / 100, volume: vol, hvol30: opts.hvol };
  });
  bars[bars.length - 1].hvol30 = null; // mirror SIX's blank latest-bar hvol
  return {
    isin: opts.isin, issuer: opts.issuer, listingId: opts.listingId,
    source: "synthetic", asOf: bars[bars.length - 1].date, bars,
  };
}

export const SIX_SERIES: InstrumentSeries[] = [
  ...REAL.map((r) => ({
    isin: r.isin, issuer: r.issuer, listingId: r.listingId,
    source: "six" as const,
    asOf: "2026-06-18",
    bars: parseTsv(r.tsv),
  })),
  // Ammann — labour-exploitation scandal hits Adidas (Growth book).
  synthetic({ isin: "DE000A1EWWW0", issuer: "Adidas AG", listingId: "11730015_XETR", baseClose: 232, baseVol: 1_200_000, hvol: 28, dropPct: -0.092, dropDaysAgo: 4 }),
  // Schneider — Roche winds down the family's disease research (Balanced book).
  synthetic({ isin: "CH0012032048", issuer: "Roche Holding AG", listingId: "1203204_XSWX", baseClose: 251, baseVol: 1_500_000, hvol: 18, dropPct: -0.071, dropDaysAgo: 3 }),
];
