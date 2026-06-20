import type { NewsItem, NewsImpact, ThemeId } from "../types";
import { CLIENTS } from "./clients";
import { THEME_BY_ID } from "./themes";

/**
 * The live news desk. Each item carries an intrinsic severity and a value-theme
 * footprint; the clients it affects are derived from the book at render time so
 * the feed reacts to whoever holds what.
 */
export const NEWS: NewsItem[] = [
  {
    id: "news-luxewear",
    headline: "LuxeWear Group accused of forced labour in supplier factories",
    source: "Reuters",
    publishedAt: "2026-06-18",
    summary:
      "An investigation alleges systematic labour exploitation across LuxeWear's South-East Asian suppliers. Shares fell 9% intraday.",
    type: "reputational",
    severity: 88,
    themes: ["reputation-sensitivity", "social-ethics"],
    matchedHoldings: ["LuxeWear Group"],
    whyItMatters:
      "A held consumer brand is now at the centre of a labour-exploitation scandal. For reputation-sensitive clients this is not a price move — it is a direct association risk that they expect to hear about from us before it reaches the press.",
    drivers: [
      "High intrinsic severity (88) — front-page reputational event",
      "Sits directly in a Growth-mandate holding",
      "Hits the book's most reputation-sensitive relationships",
    ],
  },
  {
    id: "news-helvetia",
    headline: "Helvetia Pharma winds down rare-disease research unit",
    source: "Bloomberg",
    publishedAt: "2026-06-17",
    summary:
      "Helvetia Pharma will close its neuromuscular research division — a field several philanthropic clients actively fund through their foundations.",
    type: "value_conflict",
    severity: 71,
    themes: ["personal-cause", "philanthropy"],
    matchedHoldings: ["Helvetia Pharma"],
    whyItMatters:
      "A holding is abandoning the exact cause a client's foundation supports. The financial impact is modest, but the values conflict is acute — the portfolio is now quietly working against what the client cares about most.",
    drivers: [
      "Direct value conflict for healthcare-philanthropy clients",
      "Held position turning against the client's stated mission",
      "Emotionally-charged — mishandling damages a warm relationship",
    ],
  },
  {
    id: "news-greenstaples",
    headline: "GreenStaples commits to zero-deforestation palm oil by 2027",
    source: "Financial Times",
    publishedAt: "2026-06-16",
    summary:
      "GreenStaples announced the largest palm-oil deforestation cut-off in its sector — a landmark sustainable-supply-chain pledge.",
    type: "opportunity",
    severity: 54,
    themes: ["environmental"],
    matchedHoldings: ["GreenStaples Co"],
    whyItMatters:
      "Rare good news that lines up with the environmental thesis of impact-first clients. It is a proof point that the capital behind their portfolio is moving the way they intended — a relationship-building moment, not a problem to defuse.",
    drivers: [
      "Positive value alignment for environmental mandates",
      "Held position delivering on the client's mission",
      "Low risk, high relationship upside if surfaced promptly",
    ],
  },
  {
    id: "news-cio-ai-tilt",
    headline: "CIO rebalance proposal tilts Defensive mandates toward US AI leaders",
    source: "SIX CIO Desk",
    publishedAt: "2026-06-15",
    summary:
      "The latest house view rotates a slice of blue-chip staples into US AI mega-caps to capture momentum across mandates.",
    type: "mandate_drift",
    severity: 49,
    themes: ["us-exposure"],
    matchedHoldings: ["Nestlé S.A."],
    whyItMatters:
      "The default CIO advice would push conservative, hype-averse clients into the precise exposure they reject — while genuinely fitting the tech-forward ones. The signal matters most as something to suppress for some of the book and amplify for the rest.",
    drivers: [
      "Broad reach — touches most Defensive and Growth mandates",
      "Mandate-drift risk for capital-preservation clients",
      "Opportunity for US-tech-bullish clients in the same move",
    ],
  },
  {
    id: "news-semis",
    headline: "New US export controls hit advanced semiconductor supply",
    source: "Wall Street Journal",
    publishedAt: "2026-06-15",
    summary:
      "Fresh export restrictions on advanced chips rattled AI hardware names; Nvidia and peers traded sharply lower on the headline.",
    type: "exposure",
    severity: 63,
    themes: ["us-exposure"],
    matchedHoldings: ["Nvidia Corp"],
    whyItMatters:
      "A direct hit to the AI-hardware complex that growth-oriented clients are overweight. Worth a proactive note on exposure and sizing before the next leg of volatility.",
    drivers: [
      "Material severity (63) for AI-hardware holders",
      "Concentrated in US-tech-bullish portfolios",
      "Volatility likely to persist — pre-empt client questions",
    ],
  },
  {
    id: "news-staples-dividend",
    headline: "Swiss consumer-staples leaders raise dividends above expectations",
    source: "Neue Zürcher Zeitung",
    publishedAt: "2026-06-14",
    summary:
      "Several defensive blue chips lifted payouts ahead of forecasts, reinforcing the income case for dividend-quality names.",
    type: "opportunity",
    severity: 42,
    themes: ["geographic-anchoring"],
    matchedHoldings: ["Nestlé S.A.", "Procter & Gamble"],
    whyItMatters:
      "A quiet positive for income- and preservation-focused clients: the dividend-quality core they trust just got stronger. A low-key reassurance note lands well with conservative relationships.",
    drivers: [
      "Reinforces the income thesis for Defensive mandates",
      "Touches widely-held staples positions",
      "Low urgency — relationship reassurance, not action",
    ],
  },
];

/**
 * Compute which clients a news item affects, and how hard, from the live book.
 * A client is affected if they hold a matched instrument (direct exposure) or
 * align with one of the story's value themes (thematic exposure).
 */
export function newsImpacts(news: NewsItem): NewsImpact[] {
  const out: NewsImpact[] = [];

  for (const client of CLIENTS) {
    const holdings = news.matchedHoldings.filter((h) => client.topHoldings.includes(h));

    // strongest value theme through which this story reaches the client
    let bestTheme: ThemeId | null = null;
    let bestWeight = 0;
    for (const t of news.themes) {
      const w = client.affinities.find((a) => a.theme === t)?.weight ?? 0;
      if (w > bestWeight) { bestWeight = w; bestTheme = t; }
    }

    let impact: number;
    let via: string;
    if (holdings.length) {
      // direct exposure: severity, amplified by how much they care about the theme
      impact = Math.round(news.severity * (0.62 + 0.38 * bestWeight));
      via = `Holds ${holdings.join(", ")}`;
    } else if (bestWeight >= 0.3) {
      // thematic exposure: no holding, but the values overlap
      impact = Math.round(news.severity * bestWeight * 0.7);
      via = bestTheme
        ? `Aligns with ${THEME_BY_ID[bestTheme].label}`
        : "Thematic exposure";
    } else {
      continue; // not meaningfully affected
    }

    out.push({
      client,
      impact: Math.min(100, impact),
      theme: bestTheme ?? news.themes[0],
      via,
      holdings,
    });
  }

  return out.sort((a, b) => b.impact - a.impact);
}

/**
 * Feed-level priority: blends the story's intrinsic severity, the single hardest
 * client hit, and how broadly it reaches across the book.
 */
export function newsPriority(news: NewsItem): number {
  const impacts = newsImpacts(news);
  const topImpact = impacts[0]?.impact ?? 0;
  const reach = Math.min(100, impacts.length * 18);
  return Math.round(0.5 * news.severity + 0.3 * topImpact + 0.2 * reach);
}

/** The feed, ranked. Computed once — the book is static within a session. */
export const RANKED_NEWS: { news: NewsItem; priority: number }[] = NEWS
  .map((news) => ({ news, priority: newsPriority(news) }))
  .sort((a, b) => b.priority - a.priority);
