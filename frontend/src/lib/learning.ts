import type {
  Client,
  FeedbackDecision,
  FeedbackEvent,
  PreferenceModel,
  ThemeId,
  ThemeLearning,
  Voice,
} from "../types";

/** Reward attached to each decision — the signal the model learns from. */
export const REWARD: Record<FeedbackDecision, number> = {
  accepted: 1,
  tweaked: 0.6,
  declined: 0,
};

const LR = 0.09;          // learning rate: how hard feedback nudges value weights
const CONF_GAIN = 0.28;   // how much theme-acceptance can move recommendation confidence

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** The value-theme a client's recommendations primarily target (highest affinity). */
export function primaryTheme(client: Client): ThemeId | null {
  const top = [...client.affinities].sort((a, b) => b.weight - a.weight)[0];
  return top?.theme ?? null;
}

/** Infer a preference model for one client from the full feedback log. */
export function buildModel(client: Client, allEvents: FeedbackEvent[]): PreferenceModel {
  const own = allEvents.filter((e) => e.clientId === client.id);
  const sampleSize = own.length;
  const acceptanceRate = sampleSize ? mean(own.map((e) => REWARD[e.decision])) : 0.5;

  const baseByTheme = new Map<ThemeId, number>();
  client.affinities.forEach((a) => baseByTheme.set(a.theme, a.weight));
  const themeIds = new Set<ThemeId>([...baseByTheme.keys(), ...own.map((e) => e.theme)]);

  const themes: ThemeLearning[] = [...themeIds]
    .map((theme) => {
      const base = baseByTheme.get(theme) ?? 0;
      const te = own.filter((e) => e.theme === theme);
      // reward 1 -> +LR, reward 0 -> -LR; tweaks barely move the needle
      const nudge = te.reduce((s, e) => s + LR * (REWARD[e.decision] - 0.5) * 2, 0);
      const learned = clamp(base + nudge, 0, 1);
      const accept = te.length ? mean(te.map((e) => REWARD[e.decision])) : acceptanceRate;
      return { theme, base, learned, delta: learned - base, accept, n: te.length };
    })
    .sort((a, b) => b.learned - a.learned);

  const rate = (es: FeedbackEvent[]) => ({ rate: mean(es.map((e) => REWARD[e.decision])), n: es.length });
  const voiceRates: PreferenceModel["voiceRates"] = {
    "values-led": rate(own.filter((e) => e.voice === "values-led")),
    "data-driven": rate(own.filter((e) => e.voice === "data-driven")),
  };
  const preferredVoice = pickVoice(voiceRates);

  const recent = [...own].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return { clientId: client.id, sampleSize, acceptanceRate, themes, preferredVoice, voiceRates, recent };
}

function pickVoice(rates: PreferenceModel["voiceRates"]): Voice | null {
  const v = rates["values-led"];
  const d = rates["data-driven"];
  if (!v.n && !d.n) return null;
  if (v.n && d.n) return v.rate === d.rate ? (v.n >= d.n ? "values-led" : "data-driven") : v.rate > d.rate ? "values-led" : "data-driven";
  return v.n ? "values-led" : "data-driven";
}

/**
 * Adjust a recommendation's base confidence by what we've learned about how
 * this client responds to proposals on the same theme.
 */
export function adjustConfidence(
  base: number,
  model: PreferenceModel,
  theme: ThemeId | null
): { value: number; delta: number; accept: number; n: number } {
  const tl = theme ? model.themes.find((t) => t.theme === theme) : undefined;
  const n = tl?.n ?? 0;
  if (!n) return { value: base, delta: 0, accept: model.acceptanceRate, n: 0 };
  const delta = CONF_GAIN * (tl!.accept - 0.5); // ±0.14 at the extremes
  const value = clamp(base + delta, 0.3, 0.98);
  return { value, delta: value - base, accept: tl!.accept, n };
}
