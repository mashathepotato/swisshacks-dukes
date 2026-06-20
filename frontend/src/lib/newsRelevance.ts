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
  clientWeight: number;   // 0..1 — the client's conviction on it
  polarity: 1 | -1;       // -1 = the client guards against this axis
  contribution: number;   // articleScore × clientWeight
}
export interface HoldingMatch { isin: string; issuer: string; }

export interface Relevance {
  score: number;          // 0..100 roll-up (the breakdown below is the real explanation)
  valueScore: number;     // Σ contributions
  valueMatches: ValueMatch[];
  holdingMatches: HoldingMatch[];
  mandateMatch: boolean;
  summary: string;
}

/** Relevance of one funnel article to one client — fully traceable. */
export function relevance(article: FeedArticle, client: Client): Relevance {
  // 1. value overlap: article's implicated axes ∩ the client's convictions
  const valueMatches: ValueMatch[] = [];
  for (const v of article.values) {
    if (v.score <= 0) continue;
    const aff = client.affinities.find((a) => a.theme === (v.key as ThemeId));
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

  // 2. direct holding match
  const held = new Set(client.topHoldings.map(norm));
  const holdingMatches: HoldingMatch[] = article.affectedHoldings
    .filter((h) => held.has(norm(h.issuer)))
    .map((h) => ({ isin: h.isin, issuer: h.issuer }));

  // 3. mandate exposure (only when not already a named top holding)
  const mandateKey = client.mandate.toLowerCase();
  const mandateMatch = holdingMatches.length === 0 &&
    article.affectedHoldings.some((h) => h.mandates.includes(mandateKey));

  const score = Math.min(100, Math.round(valueScore * 55 + holdingMatches.length * 38 + (mandateMatch ? 14 : 0)));

  const bits: string[] = [];
  if (holdingMatches.length) bits.push(`holds ${holdingMatches.map((h) => h.issuer).join(", ")}`);
  else if (mandateMatch) bits.push(`their ${client.mandate} mandate holds an affected instrument`);
  if (valueMatches.length) {
    const top = valueMatches[0];
    bits.push(`${top.polarity === -1 ? "guards against" : "values"} ${top.label.toLowerCase()}`);
  }
  const summary = bits.length ? `Relevant — ${bits.join("; ")}.` : "Limited direct relevance.";

  return { score, valueScore, valueMatches, holdingMatches, mandateMatch, summary };
}

/** Funnel articles ranked by relevance to one client. */
export function articlesForClient(articles: FeedArticle[], client: Client, limit = 14) {
  return articles
    .filter((a) => a.selected)
    .map((a) => ({ article: a, rel: relevance(a, client) }))
    .filter((x) => x.rel.score > 0)
    .sort((a, b) => b.rel.score - a.rel.score)
    .slice(0, limit);
}
