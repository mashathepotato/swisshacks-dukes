import type { Client } from "../types";

// 4 challenge personas (rich) + synthetic twins (to show scale & clustering).
export const CLIENTS: Client[] = [
  {
    id: "ammann",
    name: "Ammann",
    archetype: "The Corporate Reputation Case",
    isPersona: true,
    mandate: "Growth",
    tenureYears: 11,
    riskProfile: "High",
    commStyle: "Direct, reputation-aware, expects discretion",
    values: ["Reputation = financial risk", "Swiss prominence", "Ethical supply chains"],
    dislikes: ["Labour exploitation", "Negative press exposure"],
    affinities: [
      { theme: "reputation", weight: 0.95 },
      { theme: "us_tech_bullish", weight: 0.45 },
    ],
    priorityScore: 92,
    topReason: "Labour-exploitation scandal hits a consumer brand in the Growth portfolio — direct reputational exposure.",
    topHoldings: ["LuxeWear Group", "Nestlé S.A.", "Richemont", "Nvidia Corp"],
    signals: [
      {
        id: "amm-news-1",
        headline: "LuxeWear Group accused of forced labour in supplier factories",
        source: "Reuters",
        publishedAt: "2026-06-18",
        summary:
          "An investigation alleges systematic labour exploitation across LuxeWear's South-East Asian suppliers. Shares fell 9% intraday.",
        type: "reputational",
        severity: 88,
        matchedHoldings: ["LuxeWear Group"],
      },
    ],
    recommendations: [
      {
        id: "amm-rec-1",
        action: "Propose exiting LuxeWear Group, rotate into a same-sector CIO BUY (Richemont).",
        rationale:
          "Client treats reputational risk as financial risk; continued exposure to a labour scandal conflicts with his public profile. Richemont is a CIO BUY in the same consumer-discretionary sleeve, preserving mandate allocation.",
        evidence: [
          "CRM 2024-03: 'Any association with exploitation is unacceptable — my name is on the line.'",
          "News: LuxeWear forced-labour investigation (Reuters, 2026-06-18)",
          "CIO List: Richemont rated BUY, same sector",
        ],
        confidence: 0.86,
      },
    ],
  },
  {
    id: "schneider",
    name: "Schneider",
    archetype: "The Personal Connection",
    isPersona: true,
    mandate: "Balanced",
    tenureYears: 8,
    riskProfile: "Moderate",
    commStyle: "Warm, values-led, responds to personal narrative",
    values: ["Family foundation", "Chronic-illness research", "Long-term stewardship"],
    dislikes: ["Cold/transactional advice"],
    affinities: [
      { theme: "healthcare", weight: 0.9 },
      { theme: "defensive", weight: 0.4 },
    ],
    priorityScore: 84,
    topReason: "A pharma holding is shutting the research division for the disease the client's foundation supports.",
    topHoldings: ["Helvetia Pharma", "Roche Holding", "Nestlé S.A.", "Swiss Re"],
    signals: [
      {
        id: "sch-news-1",
        headline: "Helvetia Pharma winds down rare-disease research unit",
        source: "Bloomberg",
        publishedAt: "2026-06-17",
        summary:
          "Helvetia Pharma will close its neuromuscular research division, the field the Schneider family foundation funds.",
        type: "value_conflict",
        severity: 71,
        matchedHoldings: ["Helvetia Pharma"],
      },
    ],
    recommendations: [
      {
        id: "sch-rec-1",
        action: "Swap Helvetia Pharma for a healthcare name still investing in rare-disease research.",
        rationale:
          "The holding now conflicts with the client's foundational cause. A same-sector CIO BUY that maintains rare-disease R&D keeps the Balanced mandate intact and honours her values.",
        evidence: [
          "CRM 2023-09: foundation funds neuromuscular research",
          "News: Helvetia Pharma closes neuromuscular unit (Bloomberg)",
          "CIO List: healthcare alternatives rated BUY",
        ],
        confidence: 0.79,
      },
    ],
  },
  {
    id: "huber",
    name: "Huber",
    archetype: "The Purpose-Driven Investor",
    isPersona: true,
    mandate: "Defensive",
    tenureYears: 6,
    riskProfile: "Low",
    commStyle: "Mission-first, wants impact framed alongside returns",
    values: ["Reforestation", "Environmental impact", "Sustainable supply chains"],
    dislikes: ["Deforestation", "Greenwashing"],
    affinities: [
      { theme: "environmental", weight: 0.92 },
      { theme: "defensive", weight: 0.5 },
    ],
    priorityScore: 67,
    topReason: "A consumer-staples holding just announced a historic palm-oil deforestation cut-off — a positive value alignment.",
    topHoldings: ["GreenStaples Co", "Nestlé S.A.", "Unilever", "Zurich Insurance"],
    signals: [
      {
        id: "hub-news-1",
        headline: "GreenStaples commits to zero-deforestation palm oil by 2027",
        source: "Financial Times",
        publishedAt: "2026-06-16",
        summary:
          "GreenStaples announced a landmark deforestation cut-off across its palm-oil supply chain, the largest such pledge in the sector.",
        type: "opportunity",
        severity: 54,
        matchedHoldings: ["GreenStaples Co"],
      },
    ],
    recommendations: [
      {
        id: "hub-rec-1",
        action: "Reinforce / slightly increase GreenStaples within the Defensive sleeve; use as a proof point.",
        rationale:
          "Rare positive alignment between a holding and the client's environmental mission. A small reinforcing move plus a values-led note strengthens the relationship.",
        evidence: [
          "CRM 2024-01: finances South American reforestation",
          "News: GreenStaples zero-deforestation pledge (FT)",
        ],
        confidence: 0.74,
      },
    ],
  },
  {
    id: "raeber",
    name: "Räber",
    archetype: "The Defensive Value Investor",
    isPersona: true,
    mandate: "Defensive",
    tenureYears: 14,
    riskProfile: "Low",
    commStyle: "Conservative Swiss couple; data-light, trust-led, averse to hype",
    values: ["Capital preservation", "Predictable dividends", "Tangible businesses"],
    dislikes: ["US tech / AI speculation", "High-beta names"],
    affinities: [
      { theme: "defensive", weight: 0.9 },
      { theme: "income", weight: 0.8 },
    ],
    priorityScore: 58,
    topReason: "CIO suggests rebalancing from Swiss blue chips into US AI stocks — directly conflicts with their stated aversion.",
    topHoldings: ["Nestlé S.A.", "Procter & Gamble", "Zurich Insurance", "Swiss Govt Bond 2031"],
    signals: [
      {
        id: "rae-news-1",
        headline: "CIO rebalance proposal tilts Defensive mandates toward US AI leaders",
        source: "SIX CIO Desk",
        publishedAt: "2026-06-15",
        summary:
          "The latest CIO recommendation rotates a slice of blue-chip staples into US AI mega-caps to capture momentum.",
        type: "mandate_drift",
        severity: 49,
        matchedHoldings: ["Nestlé S.A."],
      },
    ],
    recommendations: [
      {
        id: "rae-rec-1",
        action: "Do NOT forward the standard CIO AI tilt; offer a defensive alternative that meets the same return target.",
        rationale:
          "Client explicitly rejects US tech speculation. Pushing the generic CIO tilt would damage trust. Frame any rebalance through dividend-quality names instead.",
        evidence: [
          "CRM 2023-05: 'keep our money in established global consumer staples; I want to sleep at night, not speculate on Silicon Valley.'",
          "CIO List: AI tilt flagged — conflicts with client DNA",
        ],
        confidence: 0.82,
      },
    ],
  },

  // ---- synthetic twins (lighter detail; populate the network & scale) ----
  syn("nguyen", "Nguyen", "Tech-forward growth seeker", "Growth", "High", [
    { theme: "us_tech_bullish", weight: 0.9 },
  ], 61, "Overweight US AI; CIO momentum signal flashing — opportunity to add."),
  syn("oduya", "Oduya", "Impact-first saver", "Balanced", "Moderate", [
    { theme: "environmental", weight: 0.85 },
    { theme: "healthcare", weight: 0.35 },
  ], 44, "ESG screen drift after an energy-sector earnings surprise."),
  syn("bianchi", "Bianchi", "Dividend retiree", "Defensive", "Low", [
    { theme: "income", weight: 0.9 },
    { theme: "defensive", weight: 0.6 },
  ], 39, "Coupon reinvestment due; no urgent conflict."),
  syn("keller", "Keller", "Reputation-conscious founder", "Growth", "High", [
    { theme: "reputation", weight: 0.8 },
    { theme: "us_tech_bullish", weight: 0.5 },
  ], 73, "Portfolio brand named in an ESG controversy watchlist."),
  syn("moreau", "Moreau", "Balanced pragmatist", "Balanced", "Moderate", [
    { theme: "defensive", weight: 0.5 },
    { theme: "us_tech_bullish", weight: 0.4 },
  ], 31, "Mandate within tolerance; routine review."),
  syn("frei", "Frei", "Green-income blend", "Defensive", "Low", [
    { theme: "environmental", weight: 0.6 },
    { theme: "income", weight: 0.55 },
  ], 36, "Utility holding raised dividend; minor positive."),
  syn("tanaka", "Tanaka", "Global growth optimist", "Growth", "High", [
    { theme: "us_tech_bullish", weight: 0.75 },
    { theme: "reputation", weight: 0.3 },
  ], 52, "Semiconductor export-control headline; check exposure."),
  syn("vogel", "Vogel", "Conservative steward", "Defensive", "Low", [
    { theme: "defensive", weight: 0.85 },
    { theme: "healthcare", weight: 0.3 },
  ], 28, "No active signal."),
];

function syn(
  id: string,
  name: string,
  archetype: string,
  mandate: Client["mandate"],
  riskProfile: Client["riskProfile"],
  affinities: Client["affinities"],
  priorityScore: number,
  topReason: string
): Client {
  return {
    id,
    name,
    archetype,
    isPersona: false,
    mandate,
    tenureYears: 2 + (name.length % 9),
    riskProfile,
    commStyle: "—",
    values: [],
    dislikes: [],
    affinities,
    priorityScore,
    topReason,
    topHoldings: [],
    signals: [],
    recommendations: [],
  };
}

export const CLIENT_BY_ID: Record<string, Client> = CLIENTS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<string, Client>
);
