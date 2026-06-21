import type { Client, NewsSignal } from "../types";
import { PORTFOLIOS } from "./portfolio";
import { PERSONA_PLAY } from "../lib/portfolio";
import { SIX_SERIES } from "./sixPrices";
import { attachAnomalies } from "../lib/attachAnomalies";
import type { AnomalyEvent } from "../lib/anomaly";

// 4 challenge personas (rich) + synthetic twins (to show scale & clustering).
const BASE_CLIENTS: Client[] = [
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
      { theme: "reputation-sensitivity", weight: 0.95 },
      { theme: "social-ethics", weight: 0.6 },
    ],
    priorityScore: 92,
    amountAtStake: 3_200_000,
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
    reasoningChain: [
      {
        kind: "dna",
        label: "“Reputation = financial risk”",
        detail: "11-year client who treats any reputational association as a direct threat to his public standing and Swiss prominence.",
        source: "CRM 2024-03",
        evidence: [
          {
            kind: "crm",
            sourceId: "crm_ammann.csv:2024-03-11",
            date: "2024-03-11",
            quote: "Any association with exploitation is unacceptable — my name is on the line. If something in my book gets dragged through the press, that is my reputation, not just a number.",
          },
        ],
      },
      {
        kind: "holding",
        label: "Holds LuxeWear Group",
        detail: "A visible consumer-discretionary brand sitting in his Growth mandate.",
        source: "Portfolio · Growth sleeve",
      },
      {
        kind: "news",
        label: "Forced-labour investigation breaks",
        detail: "Reuters alleges systematic labour exploitation across LuxeWear's suppliers; shares fell 9% intraday.",
        source: "Reuters · 2026-06-18",
        evidence: [
          {
            kind: "news",
            sourceId: "reuters.com/luxewear-forced-labour-probe",
            date: "2026-06-18",
            quote: "Investigators documented forced-labour conditions across three LuxeWear Group supplier factories in South-East Asia; the company's shares closed down 9%.",
            ref: "https://www.reuters.com/luxewear-forced-labour-probe",
          },
        ],
      },
      {
        kind: "conflict",
        label: "Direct reputational exposure",
        detail: "A labour scandal inside a held brand collides head-on with his “my name is on the line” stance.",
      },
      {
        kind: "relationship",
        label: "Expects pre-emptive discretion",
        detail: "Direct and reputation-aware — he wants to hear it from us first, not from the press.",
      },
      {
        kind: "score",
        label: "Priority 92 / 100",
        detail: "Severity 88 × direct reputational exposure × high relationship sensitivity → top of the book.",
      },
    ],
    draftEmail: {
      subject: "A proactive note on your LuxeWear Group position",
      body: {
        "values-led":
          "Dear Mr Ammann,\n\nGiven how closely you guard your public reputation, I wanted to reach out before this reaches wider coverage. A forced-labour investigation has been opened into LuxeWear Group, a holding in your portfolio — exactly the kind of association we have always agreed to stay clear of.\n\nI'd like to propose exiting the position and rotating into Richemont, a same-sector name on our CIO buy list, so your allocation and your standing both stay intact. Nothing moves without your sign-off.\n\nAt your convenience,\nT. Keller",
        "data-driven":
          "Dear Mr Ammann,\n\nFlagging a material development: LuxeWear Group (held in your Growth mandate) is the subject of a Reuters forced-labour investigation; shares are down ~9% intraday.\n\nRecommended action: exit LuxeWear and rotate the proceeds into Richemont — a CIO BUY in the same consumer-discretionary sleeve, preserving your mandate allocation. I can have the trade ready to execute on your approval.\n\nBest regards,\nT. Keller",
      },
    },
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
      { theme: "personal-cause", weight: 0.9 },
      { theme: "philanthropy", weight: 0.65 },
    ],
    priorityScore: 84,
    amountAtStake: 1_450_000,
    lastMessageAt: "2026-06-19",
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
    reasoningChain: [
      {
        kind: "dna",
        label: "Foundation funds neuromuscular research",
        detail: "Her family foundation supports rare-disease research — a core, emotionally-held part of who she is as an investor.",
        source: "CRM 2023-09",
        evidence: [
          {
            kind: "crm",
            sourceId: "crm_schneider.csv:2023-09-02",
            date: "2023-09-02",
            quote: "Our family foundation exists to fund neuromuscular research. I expect the companies we own to be part of that fight, not to walk away from it.",
          },
        ],
      },
      {
        kind: "holding",
        label: "Holds Helvetia Pharma",
        detail: "A pharma position in her Balanced mandate, historically aligned with her cause.",
        source: "Portfolio · Balanced sleeve",
      },
      {
        kind: "news",
        label: "Helvetia winds down its neuromuscular unit",
        detail: "The company is closing the exact research division the Schneider foundation funds.",
        source: "Bloomberg · 2026-06-17",
        evidence: [
          {
            kind: "news",
            sourceId: "bloomberg.com/helvetia-neuromuscular-winddown",
            date: "2026-06-17",
            quote: "Helvetia Pharma will shutter its neuromuscular research division by year-end, redirecting spend toward higher-margin lifestyle treatments.",
            ref: "https://www.bloomberg.com/helvetia-neuromuscular-winddown",
          },
        ],
      },
      {
        kind: "conflict",
        label: "Value conflict",
        detail: "The holding now works directly against her foundational cause — a quiet but real betrayal of her values.",
      },
      {
        kind: "relationship",
        label: "Warm, values-led, high emotional stake",
        detail: "She responds to personal narrative; mishandling this would feel cold and transactional to her.",
        evidence: [
          {
            kind: "email",
            sourceId: "inbox · Mrs Schneider",
            date: "2026-06-19",
            quote: "I just saw the Helvetia news — please tell me we no longer hold them. You know what this cause means to my family. Can we speak today?",
          },
        ],
      },
      {
        kind: "score",
        label: "Priority 84 / 100",
        detail: "Severity 71 × direct value conflict × high relationship sensitivity → near the top of the book.",
      },
    ],
    draftEmail: {
      subject: "Helvetia Pharma and your foundation's work",
      body: {
        "values-led":
          "Dear Mrs Schneider,\n\nI thought of your foundation the moment I saw this. Helvetia Pharma has announced it is winding down its neuromuscular research division — the very field your family has spent years supporting. I didn't want a holding of yours to be quietly working against the cause closest to you.\n\nI'd like to propose moving into a healthcare name that is still actively investing in rare-disease research, keeping your Balanced mandate exactly where it should be. Whenever you have a moment, I'd welcome the chance to talk it through.\n\nWarmly,\nT. Keller",
        "data-driven":
          "Dear Mrs Schneider,\n\nA development relevant to your holdings: Helvetia Pharma is closing its neuromuscular research unit (Bloomberg, 17 Jun) — the area your foundation funds.\n\nProposed action: swap Helvetia Pharma for a same-sector CIO BUY that maintains rare-disease R&D. This preserves your Balanced allocation while removing the value conflict. Happy to walk you through the alternatives whenever suits.\n\nKind regards,\nT. Keller",
      },
    },
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
      { theme: "social-ethics", weight: 0.55 },
    ],
    priorityScore: 67,
    amountAtStake: 640_000,
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
    reasoningChain: [
      {
        kind: "dna",
        label: "Reforestation & environmental impact",
        detail: "Mission-first investor who finances South-American reforestation and wants impact framed alongside returns.",
        source: "CRM 2024-01",
        evidence: [
          {
            kind: "crm",
            sourceId: "crm_huber.csv:2024-01-18",
            date: "2024-01-18",
            quote: "I finance reforestation in South America myself — I want my portfolio pulling in the same direction, and I want to see the impact, not just the return.",
          },
        ],
      },
      {
        kind: "holding",
        label: "Holds GreenStaples Co",
        detail: "A consumer-staples position in his Defensive sleeve, tied to palm-oil supply chains he watches closely.",
        source: "Portfolio · Defensive sleeve",
      },
      {
        kind: "news",
        label: "Zero-deforestation pledge by 2027",
        detail: "GreenStaples announced the largest palm-oil deforestation cut-off in its sector.",
        source: "Financial Times · 2026-06-16",
        evidence: [
          {
            kind: "news",
            sourceId: "ft.com/greenstaples-zero-deforestation",
            date: "2026-06-16",
            quote: "GreenStaples committed to a fully traceable, zero-deforestation palm-oil supply chain by 2027 — the most ambitious pledge yet in consumer staples.",
            ref: "https://www.ft.com/greenstaples-zero-deforestation",
          },
        ],
      },
      {
        kind: "conflict",
        label: "Positive value alignment",
        detail: "Rare good news — a holding moving decisively toward the mission he cares about. A proof point, not a problem.",
      },
      {
        kind: "relationship",
        label: "Wants impact made visible",
        detail: "A values-led note here strengthens trust and shows the portfolio living up to his purpose.",
      },
      {
        kind: "score",
        label: "Priority 67 / 100",
        detail: "Moderate severity, but a high-value relationship-building moment worth acting on promptly.",
      },
    ],
    draftEmail: {
      subject: "Good news from GreenStaples — your reforestation thesis",
      body: {
        "values-led":
          "Dear Mr Huber,\n\nA rare and welcome update. GreenStaples — one of your holdings — has just committed to the largest zero-deforestation palm-oil pledge in its sector, due by 2027. It's a genuine proof point that the capital behind your portfolio is moving the way you intended.\n\nGiven how well this fits your reforestation thesis, I'd suggest we reinforce the position slightly within your Defensive sleeve. I'd love to share the detail and hear your thoughts.\n\nWarm regards,\nT. Keller",
        "data-driven":
          "Dear Mr Huber,\n\nPositive signal on a current holding: GreenStaples Co has announced a zero-deforestation palm-oil commitment by 2027 (FT, 16 Jun) — the strongest such pledge in the sector.\n\nProposed action: a small reinforcing add within your Defensive allocation, using this as a documented ESG proof point. Mandate impact is minimal. Happy to confirm sizing on your approval.\n\nBest regards,\nT. Keller",
      },
    },
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
      { theme: "us-exposure", weight: 0.85, polarity: -1 },
      { theme: "geographic-anchoring", weight: 0.8 },
    ],
    priorityScore: 58,
    amountAtStake: 2_100_000,
    topReason: "CIO suggests rebalancing from Swiss blue chips into US AI stocks — directly conflicts with their stated aversion.",
    topHoldings: ["Nestlé S.A.", "Procter & Gamble", "Abbott Laboratories", "Zurich Insurance", "Swiss Govt Bond 2031"],
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
    reasoningChain: [
      {
        kind: "dna",
        label: "Averse to US tech / AI speculation",
        detail: "Conservative Swiss couple, 14-year clients: “I want to sleep at night, not speculate on Silicon Valley.”",
        source: "CRM 2023-05",
        evidence: [
          {
            kind: "crm",
            sourceId: "crm_raeber.csv:2023-05-19",
            date: "2023-05-19",
            quote: "Keep our money in established global consumer staples. I want to sleep at night, not speculate on Silicon Valley.",
          },
        ],
      },
      {
        kind: "holding",
        label: "Swiss blue-chip staples core",
        detail: "Defensive mandate built on dividend-quality, tangible businesses they understand.",
        source: "Portfolio · Defensive sleeve",
      },
      {
        kind: "news",
        label: "CIO proposes a tilt into US AI leaders",
        detail: "The standard CIO rebalance rotates a slice of staples into US AI mega-caps to chase momentum.",
        source: "SIX CIO Desk · 2026-06-15",
        evidence: [
          {
            kind: "cio",
            sourceId: "SIX CIO Desk · rebalance note Q2-26",
            date: "2026-06-15",
            quote: "Recommended across Defensive mandates: rotate ~8% from blue-chip staples into US AI mega-caps to capture momentum into H2.",
          },
        ],
      },
      {
        kind: "conflict",
        label: "Mandate-drift risk",
        detail: "Forwarding the generic CIO advice would push them straight into the exact exposure they reject.",
      },
      {
        kind: "relationship",
        label: "Trust-led, hype-averse",
        detail: "Pushing the AI tilt would read as us not listening — a real risk to a 14-year relationship.",
      },
      {
        kind: "score",
        label: "Priority 58 / 100",
        detail: "Lower news severity, but a trust-protecting intervention: suppress the default advice before it's sent.",
      },
    ],
    draftEmail: {
      subject: "On the latest rebalancing note — keeping you on course",
      body: {
        "values-led":
          "Dear Mr and Mrs Räber,\n\nYou may receive a general rebalancing suggestion that tilts toward US technology and AI names. I want to be clear: I am not recommending it for you. It runs against everything you've told me about wanting to sleep soundly rather than speculate.\n\nInstead, I'd propose a defensive alternative built around the dividend-quality names you trust, aimed at the same return target. Always at your pace, and always your decision.\n\nWith respect,\nT. Keller",
        "data-driven":
          "Dear Mr and Mrs Räber,\n\nNote on the current CIO rebalancing proposal: it rotates part of your blue-chip staples into US AI mega-caps. This conflicts with your stated Defensive mandate, so I am not forwarding it as-is.\n\nProposed action: an alternative rebalance through dividend-quality names targeting a comparable return, with no increase in US tech exposure. I can send the comparison whenever you'd like to review it.\n\nKind regards,\nT. Keller",
      },
    },
  },
  {
    id: "lecun",
    name: "LeCun",
    archetype: "The AI-Native Anomaly",
    isPersona: true,
    mandate: "Growth",
    tenureYears: 6,
    riskProfile: "High",
    commStyle: "Technical, first-principles, fast — wants the model's reasoning, not its conclusions",
    values: ["European technological sovereignty", "First-principles conviction over consensus", "Open research over closed platforms"],
    dislikes: ["US mega-cap tech concentration", "Meta's LLM-first AI strategy", "Hype-driven momentum trades"],
    affinities: [
      { theme: "us-exposure", weight: 0.92, polarity: -1 },
      { theme: "geographic-anchoring", weight: 0.82 },
      { theme: "personal-cause", weight: 0.75 },
      { theme: "social-ethics", weight: 0.65 },
      { theme: "confidentiality", weight: 0.55 },
      { theme: "reputation-sensitivity", weight: 0.50 },
      { theme: "military-defence", weight: 0.35, polarity: -1 },
      { theme: "environmental", weight: 0.30 },
      { theme: "philanthropy", weight: 0.25 },
    ],
    priorityScore: 90,
    amountAtStake: 204_568,
    topReason: "A 65-year-old US-domiciled Growth client whose book is US-tech-heavy — but his stated conviction is the inverse: out of Meta over its AI strategy, out of US mega-cap, into Europe.",
    topHoldings: ["Meta Platforms Inc.", "Nvidia Corp", "Broadcom Inc.", "ASML Holding N.V.", "SAP SE"],
    signals: [
      {
        id: "lec-news-1",
        headline: "Meta doubles down on LLM-scale 'superintelligence', sidelines long-term AI research",
        source: "The Information",
        publishedAt: "2026-06-19",
        summary:
          "Meta is reorganising its AI org around large-language-model scale and product, winding down open-ended research — a strategic split prominent AI scientists have publicly criticised.",
        type: "value_conflict",
        severity: 72,
        matchedHoldings: ["Meta Platforms Inc."],
      },
    ],
    recommendations: [
      {
        id: "lec-rec-1",
        action: "Propose exiting the Meta Platforms position and rotating the US mega-cap tech overweight into European CIO names (ASML, SAP).",
        rationale:
          "His profile reads as a standard high-risk Growth client, but his stated conviction is the opposite of the book: he rejects Meta's AI direction and US mega-cap concentration, and wants European exposure. Selling Meta resolves a values conflict he holds publicly; ASML and SAP are European CIO BUYs that keep the equity sleeve intact.",
        evidence: [
          "CRM 2026-05: 'Meta is betting the company on LLM scale — I think that's the wrong path, and I don't want my own capital riding on it.'",
          "CRM 2025-11: 'The next decade of value compounds in Europe. Get me out of the US mega-cap crowd.'",
          "News: Meta sidelines long-term research (The Information, 2026-06-19)",
          "CIO List: ASML, SAP rated BUY — European tech",
        ],
        confidence: 0.84,
      },
    ],
    reasoningChain: [
      {
        kind: "dna",
        label: "Anti-Meta strategy, bullish on Europe",
        detail: "An AI pioneer who built his career in the US but now bets against US mega-cap concentration and Meta's LLM-first direction — an anomaly for his 65-year-old, US-domiciled profile.",
        source: "CRM 2026-05",
        evidence: [
          {
            kind: "crm",
            sourceId: "crm_lecun.csv:2026-05-12",
            date: "2026-05-12",
            quote: "Meta is betting the company on LLM scale — I think that's the wrong path, and I don't want my own capital riding on it. The real work, and the real returns, are moving to Europe.",
          },
        ],
      },
      {
        kind: "holding",
        label: "Holds Meta Platforms in a US-tech-heavy Growth book",
        detail: "His Growth mandate carries the standard US mega-cap overweight — Meta, Nvidia, Broadcom — the exact concentration he says he wants out of.",
        source: "Portfolio · Growth sleeve",
      },
      {
        kind: "news",
        label: "Meta sidelines long-term AI research",
        detail: "Meta reorganises around LLM-scale 'superintelligence' and winds down open-ended research — the strategy he has publicly broken with.",
        source: "The Information · 2026-06-19",
        evidence: [
          {
            kind: "news",
            sourceId: "theinformation.com/meta-superintelligence-pivot",
            date: "2026-06-19",
            quote: "Meta is consolidating its AI effort around large-language-model scale and shipping product, winding down the open-ended research bets that defined its lab for a decade.",
            ref: "https://www.theinformation.com/meta-superintelligence-pivot",
          },
        ],
      },
      {
        kind: "conflict",
        label: "Book contradicts conviction",
        detail: "A held US name collides head-on with his public anti-Meta, anti-US-concentration stance — the portfolio is invested in exactly what he argues against.",
      },
      {
        kind: "relationship",
        label: "Wants the reasoning, fast",
        detail: "First-principles and AI-native — he won't accept a conclusion without the chain behind it, and he moves quickly once it holds up.",
      },
      {
        kind: "score",
        label: "Priority 90 / 100",
        detail: "Severity 72 × direct holding conflict × a high-conviction client actively asking to act → near the top of the book.",
      },
    ],
    draftEmail: {
      subject: "Acting on your Meta position and the US-tech overweight",
      body: {
        "values-led":
          "Dear Dr LeCun,\n\nYou've been clear that Meta's direction is one you no longer want your own capital behind, and that you see the next decade compounding in Europe. Your portfolio doesn't yet reflect that — it still carries the US mega-cap overweight, Meta included.\n\nI'd like to propose exiting Meta and rotating that exposure into European names on our buy list — ASML and SAP — so the book finally matches your conviction. Nothing executes without your sign-off.\n\nAt your convenience,\nT. Keller",
        "data-driven":
          "Dear Dr LeCun,\n\nActioning your stated view: your Growth mandate holds Meta Platforms (~CHF 205k) inside a broader US mega-cap tech overweight, against your preference to reduce US concentration and tilt to Europe.\n\nRecommended action: exit Meta and rotate proceeds into ASML and SAP — both European CIO BUYs in the technology sleeve, preserving your equity allocation while cutting US exposure. I can stage the trades for your approval.\n\nBest regards,\nT. Keller",
      },
    },
  },

  // ---- synthetic twins (lighter detail; populate the network & scale) ----
  syn("nguyen", "Nguyen", "Tech-forward growth seeker", "Growth", "High", [
    { theme: "us-exposure", weight: 0.9 },
  ], 61, "Overweight US AI; CIO momentum signal flashing — opportunity to add."),
  syn("oduya", "Oduya", "Impact-first saver", "Balanced", "Moderate", [
    { theme: "environmental", weight: 0.85 },
    { theme: "personal-cause", weight: 0.35 },
  ], 44, "ESG screen drift after an energy-sector earnings surprise."),
  syn("bianchi", "Bianchi", "Dividend retiree", "Defensive", "Low", [
    { theme: "us-exposure", weight: 0.55, polarity: -1 },
    { theme: "geographic-anchoring", weight: 0.6 },
  ], 39, "Coupon reinvestment due; no urgent conflict."),
  syn("keller", "Keller", "Reputation-conscious founder", "Growth", "High", [
    { theme: "reputation-sensitivity", weight: 0.8 },
    { theme: "us-exposure", weight: 0.5 },
  ], 73, "Portfolio brand named in an ESG controversy watchlist."),
  syn("moreau", "Moreau", "Balanced pragmatist", "Balanced", "Moderate", [
    { theme: "geographic-anchoring", weight: 0.5 },
    { theme: "us-exposure", weight: 0.4 },
  ], 31, "Mandate within tolerance; routine review."),
  syn("frei", "Frei", "Green-income blend", "Defensive", "Low", [
    { theme: "environmental", weight: 0.6 },
    { theme: "geographic-anchoring", weight: 0.55 },
  ], 36, "Utility holding raised dividend; minor positive."),
  syn("tanaka", "Tanaka", "Global growth optimist", "Growth", "High", [
    { theme: "us-exposure", weight: 0.75 },
    { theme: "reputation-sensitivity", weight: 0.3 },
  ], 52, "Semiconductor export-control headline; check exposure."),
  syn("vogel", "Vogel", "Conservative steward", "Defensive", "Low", [
    { theme: "geographic-anchoring", weight: 0.85 },
    { theme: "personal-cause", weight: 0.3 },
  ], 28, "No active signal."),
];

// Associate a market anomaly with a client only where they actually hold the
// moved name — their persona-flagged position or a top-holding match — so a move
// stays personalised (and re-ranks the queue) instead of flooding the mandate.
const firstWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/)[0];

function exposureOf(client: Client, event: AnomalyEvent): number | null {
  const holding = PORTFOLIOS[client.mandate].find((h) => h.isin === event.isin);
  const holdsByName = client.topHoldings.some(
    (n) => firstWord(n).length > 2 && firstWord(n) === firstWord(event.issuer),
  );
  const isFlagged = PERSONA_PLAY[client.id]?.sellIsin === event.isin;
  if (!isFlagged && !holdsByName) return null;
  return holding?.currentCHF ?? client.amountAtStake ?? 100_000;
}

const ENRICHED_CLIENTS: Client[] = attachAnomalies(BASE_CLIENTS, SIX_SERIES, exposureOf);

// --- DEMO staging --------------------------------------------------------
// The demo opens with LeCun parked mid-queue and quiet. Before his call, his
// urgent Meta value-conflict (and the market anomaly his US-tech holdings pull
// in) are staged OFF, so his transparent priority computes low everywhere —
// the queue position, his profile score, and the breakdown all agree, because
// they all read from the same signals. A single calm signal keeps that score
// honest (a real, mild driver) and lands him ~6th. Flip DEMO_STAGE to "after"
// once the call + DNA injection arrive to restore the full signal set.
export type DemoStage = "before" | "after";
export const DEMO_STAGE: DemoStage = "after";

// Calm standing note — low severity, a couple of weeks old — so a quiet LeCun
// still ranks on a genuine (if minor) driver rather than an empty zero.
const LECUN_QUIET_SIGNAL: NewsSignal = {
  id: "lec-quiet-1",
  headline: "Routine portfolio review due — no open issues",
  source: "CRM",
  publishedAt: "2026-06-02",
  summary: "Standing six-monthly review window is open. No active news or mandate flags against the book.",
  type: "opportunity",
  severity: 10,
  matchedHoldings: [],
};

// Everything urgent that surfaces in the queue row (the trigger signal, the
// headline reason, the action) is staged to a calm standing state. His deeper
// profile (values, holdings, behavioural DNA) is unchanged. Flipping to "after"
// restores the authored Meta value-conflict, recommendation and anomaly.
const LECUN_BEFORE: Partial<Client> = {
  signals: [LECUN_QUIET_SIGNAL],
  topReason:
    "Long-standing Growth client in his routine semi-annual review window. No active news or mandate flags against the book right now.",
  recommendations: [],
};

// Beat 2: the urgent call lands. He's relocating to the US and wants the book
// restructured before the move, with a meeting set for tomorrow — recorded in
// the captured script. That call (fresh, high-conflict) plus his whole
// relationship now in play vaults him to the top, on the SAME prior conviction
// (exit Meta / trim the US mega-cap overweight) that explains the why.
const LECUN_CALL_SIGNAL: NewsSignal = {
  id: "lec-call-1",
  headline: "Client call (recorded): relocating to the US, wants the book restructured before the move",
  source: "Call · recorded today",
  publishedAt: "2026-06-21",
  summary:
    "LeCun called to say he is relocating to the US and wants his portfolio restructured ahead of the move; a follow-up meeting is set for tomorrow. This sharpens his standing conviction to exit Meta and cut the US mega-cap overweight.",
  type: "value_conflict",
  severity: 96,
  matchedHoldings: ["Meta Platforms Inc."],
};

const LECUN_AFTER: Partial<Client> = {
  lastMessageAt: "2026-06-21",
  amountAtStake: 3_400_000, // whole relationship in play for the relocation restructure
  topReason:
    "Called today (recorded): relocating to the US and wants his book restructured before the move, with a meeting set for tomorrow — on top of his standing conviction to exit Meta and the US mega-cap overweight he has long said he wants out of.",
};

function applyDemoStage(book: Client[]): Client[] {
  if (DEMO_STAGE === "before")
    return book.map((c) => (c.id === "lecun" ? { ...c, ...LECUN_BEFORE } : c));
  // "after": layer the recorded call + tomorrow's meeting on top of his prior story
  return book.map((c) =>
    c.id === "lecun" ? { ...c, ...LECUN_AFTER, signals: [LECUN_CALL_SIGNAL, ...c.signals] } : c,
  );
}

export const CLIENTS: Client[] = applyDemoStage(ENRICHED_CLIENTS);

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
    // synthetic but plausible CHF exposure scaled to the priority score
    amountAtStake: (priorityScore * 18 + name.length * 90) * 1000,
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
