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

export interface Relevance {
  holdings: HoldingMatch[];      // unique issuers the story affects that the client holds
  valueMatches: ValueMatch[];    // value-axes overlapping the client's convictions
  mandateMatch: boolean;
  valueScore: number;            // Σ touched convictions (raw)
  valueOverlap: number;          // valueScore normalised 0..1 by the client's total conviction
  reasons: Reason[];             // the explainable "why" — no opaque number
}

/** Relevance of one funnel article to one client — expressed as concrete reasons. */
export function relevance(article: FeedArticle, client: Client): Relevance {
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

  return { holdings, valueMatches, mandateMatch, valueScore, valueOverlap, reasons };
}

export function hasRelevance(r: Relevance): boolean {
  return r.holdings.length > 0 || r.valueMatches.length > 0 || r.mandateMatch;
}

/** Funnel articles relevant to one client, sorted by total value overlap (desc).
 *  Ties break to held instruments, then mandate, so holdings-only stories still
 *  surface — below anything that touches the client's values. */
export function articlesForClient(articles: FeedArticle[], client: Client, limit = 14) {
  return articles
    .filter((a) => a.selected)
    .map((a) => ({ article: a, rel: relevance(a, client) }))
    .filter((x) => hasRelevance(x.rel))
    .sort((a, b) =>
      (b.rel.valueOverlap - a.rel.valueOverlap) ||
      (b.rel.holdings.length - a.rel.holdings.length) ||
      ((b.rel.mandateMatch ? 1 : 0) - (a.rel.mandateMatch ? 1 : 0)))
    .slice(0, limit);
}
