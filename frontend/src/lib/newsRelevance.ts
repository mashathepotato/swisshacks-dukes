import type { Client, ThemeId } from "../types";
import type { FeedArticle } from "../data/newsFeed";
import { THEME_BY_ID } from "../data/themes";

// Normalize an issuer name for matching (mirror of the pipeline's holdings logic):
// strip accents, punctuation and common corporate suffixes.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,/&'’"()-]/g, " ")
    .replace(/\b(s a|ag|inc|plc|co|ltd|llc|holdings?|group|sa|nv|se|corp|corporation|company|the|adr)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export interface ValueMatch {
  axis: ThemeId;
  label: string;
  emoji: string;
  color: string;
  articleScore: number;   // 0..1 — how strongly the story implicates this axis
  clientWeight: number;   // 0..1 — the client's conviction on this axis
  polarity: 1 | -1;       // -1 = the client guards against this axis
  contribution: number;   // story value × client value
}
export interface HoldingMatch { issuer: string; isins: string[]; }
export type ReasonKind = "holding" | "value" | "mandate";
export interface Reason { kind: ReasonKind; text: string; }

// Weights for the combined priority score (sum to 1 → score stays in 0..1).
// Justification: docs/relevance-metric.md
export const RELEVANCE_WEIGHTS = { value: 0.5, severity: 0.3, recency: 0.2 } as const;
const HALF_LIFE_DAYS = 7;   // news relevance halves about weekly
const DAY_MS = 86_400_000;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Intrinsic significance of the story, 0..1 (independent of any client). */
function severityOf(a: FeedArticle): number {
  const sentMag = Math.min(1, Math.abs(a.sentiment ?? 0) / 0.5); // observed |sentiment| tops out near 0.5
  const mm = a.stage2?.marketMovement ? 1 : 0;
  const breadth = Math.min(1, (a.stage2?.themes.length ?? 0) / 2);
  return clamp01(0.45 * mm + 0.35 * sentMag + 0.2 * breadth);
}

/** Exponential-decay recency, 0..1, relative to the feed's newest story. */
function recencyOf(a: FeedArticle, nowMs: number): number {
  if (!a.date) return 0.5;
  const t = Date.parse(a.date);
  if (Number.isNaN(t)) return 0.5;
  const ageDays = Math.max(0, (nowMs - t) / DAY_MS);
  return clamp01(Math.pow(0.5, ageDays / HALF_LIFE_DAYS));
}

export interface Relevance {
  holdings: HoldingMatch[];      // unique issuers the story affects that the client holds
  valueMatches: ValueMatch[];    // value-axes overlapping the client's convictions
  mandateMatch: boolean;
  valueScore: number;            // Σ (story value × client value), raw
  valueOverlap: number;          // weighted avg of (story value × client value) over affected axes
  severity: number;              // 0..1 intrinsic story significance
  recency: number;               // 0..1 exponential-decay freshness
  combined: number;              // 0..1 weighted blend — the ranking score
  reasons: Reason[];             // the explainable "why"
}

/** Relevance of one funnel article to one client. `nowMs` anchors recency
 *  (defaults to real now; callers pass the feed's newest date for the static feed). */
export function relevance(article: FeedArticle, client: Client, nowMs: number = Date.now()): Relevance {
  // 1. value overlap: article's implicated axes ∩ the client's convictions
  const valueMatches: ValueMatch[] = [];
  for (const v of article.values) {
    if (v.score <= 0) continue;
    const aff = client.affinities.find((a) => a.theme === v.key);
    if (!aff) continue;
    const t = THEME_BY_ID[v.key as ThemeId];
    valueMatches.push({
      axis: v.key as ThemeId,
      label: t?.label ?? v.label,
      emoji: t?.emoji ?? "",
      color: t?.color ?? "#888",
      articleScore: v.score,
      clientWeight: aff.weight,
      polarity: aff.polarity ?? 1,
      contribution: v.score * aff.weight,
    });
  }
  valueMatches.sort((a, b) => b.contribution - a.contribution);
  const valueScore = valueMatches.reduce((s, m) => s + m.contribution, 0);
  // weighted average: Σ(story value × client value) ÷ number of affected values
  const valueOverlap = valueMatches.length ? valueScore / valueMatches.length : 0;

  // 2. direct holding match — deduped by issuer (one Nestlé, not one per ISIN)
  const held = new Set(client.topHoldings.map(norm));
  const byIssuer = new Map<string, HoldingMatch>();
  for (const h of article.affectedHoldings) {
    const k = norm(h.issuer);
    if (!held.has(k)) continue;
    if (!byIssuer.has(k)) byIssuer.set(k, { issuer: h.issuer, isins: [] });
    byIssuer.get(k)!.isins.push(h.isin);
  }
  const holdings = [...byIssuer.values()];

  // 3. mandate exposure (only when not already a named holding)
  const mandateMatch = holdings.length === 0 &&
    article.affectedHoldings.some((h) => h.mandates.includes(client.mandate.toLowerCase()));

  // 4. the reasons — concrete, ordered holdings → values → mandate
  const reasons: Reason[] = [];
  for (const h of holdings) {
    reasons.push({ kind: "holding", text: `Holds ${h.issuer}${h.isins.length > 1 ? ` (${h.isins.length} instruments)` : ""}` });
  }
  for (const m of valueMatches) {
    reasons.push({
      kind: "value",
      text: `${m.polarity === -1 ? "Guards against" : "Values"} ${m.label} (their ${Math.round(m.clientWeight * 100)}% conviction)`,
    });
  }
  if (mandateMatch) reasons.push({ kind: "mandate", text: `Their ${client.mandate} mandate holds an affected instrument` });

  // 5. combined priority score (0..1): value overlap × severity × recency, weighted
  const severity = severityOf(article);
  const recency = recencyOf(article, nowMs);
  const combined =
    RELEVANCE_WEIGHTS.value * valueOverlap +
    RELEVANCE_WEIGHTS.severity * severity +
    RELEVANCE_WEIGHTS.recency * recency;

  return { holdings, valueMatches, mandateMatch, valueScore, valueOverlap, severity, recency, combined, reasons };
}

export function hasRelevance(r: Relevance): boolean {
  return r.holdings.length > 0 || r.valueMatches.length > 0 || r.mandateMatch;
}

/** Funnel articles relevant to one client, ranked by the combined priority score
 *  (value overlap + severity + recency). Recency is anchored to the feed's newest
 *  story so it's meaningful on the static feed. Ties break to held instruments. */
export function articlesForClient(articles: FeedArticle[], client: Client, limit = 14) {
  const selected = articles.filter((a) => a.selected);
  const nowMs = Math.max(0, ...selected.map((a) => (a.date ? Date.parse(a.date) : 0)).filter((n) => !Number.isNaN(n)));
  return selected
    .map((a) => ({ article: a, rel: relevance(a, client, nowMs) }))
    .filter((x) => hasRelevance(x.rel))
    .sort((a, b) =>
      (b.rel.combined - a.rel.combined) ||
      (b.rel.holdings.length - a.rel.holdings.length))
    .slice(0, limit);
}
