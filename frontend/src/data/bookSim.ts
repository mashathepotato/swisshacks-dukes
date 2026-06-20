import { CLIENTS } from "./clients";
import type { Client, ThemeId } from "../types";

export interface Advice {
  id: string;
  label: string;
  detail: string;
  weights: Partial<Record<ThemeId, number>>; // -1..1 alignment per theme
  targetRisk: number; // 0..100 risk level the advice steers portfolios toward
}

export const ADVICE: Advice[] = [
  {
    id: "trim_ai",
    label: "Trim US-tech / AI exposure",
    detail: "Reduce US AI mega-cap weight across the book and rotate into Swiss quality.",
    weights: { "us-exposure": -1, "geographic-anchoring": 0.5 },
    targetRisk: 35,
  },
  {
    id: "boost_ai",
    label: "Increase US AI allocation",
    detail: "Follow the CIO momentum signal and add US AI leaders across mandates.",
    weights: { "us-exposure": 1, "geographic-anchoring": -0.5 },
    targetRisk: 80,
  },
  {
    id: "green_bonds",
    label: "Rotate into green / ESG bonds",
    detail: "Add a sustainable fixed-income sleeve funding reforestation and transition projects.",
    weights: { "environmental": 1, "geographic-anchoring": 0.2 },
    targetRisk: 30,
  },
  {
    id: "exit_reputational",
    label: "Exit reputational-risk holdings",
    detail: "Divest names flagged on the ESG / controversy watchlist.",
    weights: { "reputation-sensitivity": 1 },
    targetRisk: 45,
  },
  {
    id: "dividend_quality",
    label: "Shift to dividend-quality staples",
    detail: "Tilt toward predictable-payout consumer staples and insurers.",
    weights: { "geographic-anchoring": 1, "us-exposure": -0.4 },
    targetRisk: 30,
  },
];

export interface ClientSimState {
  id: string;
  adopted: boolean;
  adoptedStep: number | null;
  trust: number;
  risk: number;
  aum: number;
}
export interface SimFrame {
  step: number;
  label: string;
  states: Record<string, ClientSimState>;
  adoptionPct: number;
  avgTrust: number;
  totalAum: number; // CHF millions
  bookRisk: number;
}

export const STEPS = 8;

// ---- derive stable per-client baselines from existing profile fields ----
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function dominantTheme(c: Client): ThemeId | null {
  const top = [...c.affinities].sort((a, b) => b.weight - a.weight)[0];
  return top ? top.theme : null;
}

function baseRisk(c: Client): number {
  return c.riskProfile === "High" ? 78 : c.riskProfile === "Moderate" ? 52 : 26;
}
function baseTrust(c: Client): number {
  return Math.max(40, Math.min(82, 50 + c.tenureYears * 1.6));
}
function baseAum(c: Client): number {
  // CHF millions; mock — scaled by mandate & a stable jitter
  const m = c.mandate === "Growth" ? 14 : c.mandate === "Balanced" ? 11 : 9;
  return +(m + hash01(c.id) * 8).toFixed(1);
}

export function adviceFit(c: Client, advice: Advice): number {
  let f = 0;
  for (const [theme, w] of Object.entries(advice.weights)) {
    const aff = c.affinities.find((a) => a.theme === (theme as ThemeId))?.weight ?? 0;
    f += (w as number) * aff;
  }
  return Math.max(-1, Math.min(1, f));
}

/** Run the whole-book + peer-influence simulation for a chosen advice. */
export function simulateBook(advice: Advice): SimFrame[] {
  const clients = CLIENTS;
  const fit = new Map(clients.map((c) => [c.id, adviceFit(c, advice)]));
  const threshold = new Map(clients.map((c) => [c.id, 0.3 + hash01(c.id + advice.id) * 0.32]));
  const clusterOf = new Map(clients.map((c) => [c.id, dominantTheme(c)]));

  // mutable state
  const st: Record<string, ClientSimState> = {};
  for (const c of clients) {
    st[c.id] = { id: c.id, adopted: false, adoptedStep: null, trust: baseTrust(c), risk: baseRisk(c), aum: baseAum(c) };
  }

  const frames: SimFrame[] = [];
  const snapshot = (step: number, label: string): SimFrame => {
    const states: Record<string, ClientSimState> = {};
    let adopted = 0, trustSum = 0, aumSum = 0, riskWeighted = 0;
    for (const c of clients) {
      const s = st[c.id];
      states[c.id] = { ...s };
      if (s.adopted) adopted++;
      trustSum += s.trust;
      aumSum += s.aum;
      riskWeighted += s.risk * s.aum;
    }
    return {
      step,
      label,
      states,
      adoptionPct: (adopted / clients.length) * 100,
      avgTrust: trustSum / clients.length,
      totalAum: +aumSum.toFixed(1),
      bookRisk: riskWeighted / aumSum,
    };
  };

  frames.push(snapshot(0, "Now"));

  for (let step = 1; step <= STEPS; step++) {
    // peer adoption fraction per cluster from current (pre-update) state
    const clusterTotal: Record<string, number> = {};
    const clusterAdopted: Record<string, number> = {};
    for (const c of clients) {
      const k = clusterOf.get(c.id) ?? "none";
      clusterTotal[k] = (clusterTotal[k] ?? 0) + 1;
      if (st[c.id].adopted) clusterAdopted[k] = (clusterAdopted[k] ?? 0) + 1;
    }

    for (const c of clients) {
      const s = st[c.id];
      const f = fit.get(c.id)!;
      const k = clusterOf.get(c.id) ?? "none";
      const peerFrac = clusterTotal[k] > 1 ? (clusterAdopted[k] ?? 0) / clusterTotal[k] : 0;

      if (!s.adopted) {
        const propensity = sigmoid(2.7 * f + 2.2 * peerFrac - 0.7);
        if (propensity >= threshold.get(c.id)!) {
          s.adopted = true;
          s.adoptedStep = step;
        }
      }

      // trust dynamics
      if (s.adopted) {
        s.trust += f >= 0 ? 3.2 * f : -2.4 * Math.abs(f); // good fit lifts; adopting a misfit (peer-pushed) brings regret
      } else if (f < 0) {
        s.trust -= 1.3 * Math.abs(f); // generic advice that doesn't suit them quietly erodes trust
      }
      s.trust = Math.max(2, Math.min(98, s.trust));

      // portfolio risk eases toward advice target once adopted
      if (s.adopted) s.risk += (advice.targetRisk - s.risk) * 0.35;

      // book health: trust drives retention / inflows
      s.aum *= 1 + (s.trust - 55) / 4000;
    }

    frames.push(snapshot(step, `Q${step}`));
  }

  return frames;
}
