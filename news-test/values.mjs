// Value-axis schema for the Client DNA.
//
// The controlled vocabulary of investment VALUES we infer per client from CRM
// logs. Each axis is the bridge between three things:
//   • DNA       — cues in the conversation logs that reveal the value
//   • News      — the Stage-2 themes (classify.mjs THEME_VOCAB) that touch it
//   • Portfolio — the holdings it should tilt toward / away from (grounded in
//                 the real Industry Group + Region vocabulary of the data)
//
// Two kinds of axis:
//   • "axis"     — bipolar, scored -1..+1 (e.g. preservation ↔ growth)
//   • "affinity" — a conviction scored 0..1 with a `polarity`: +1 = seek it,
//                  -1 = avoid it (e.g. environmental conviction → avoid polluters)
//
// `themes` values MUST be keys of THEME_VOCAB; validated at load below.

import { THEME_KEYS } from "./classify.mjs";

export const VALUE_AXES = [
  {
    key: "personal-cause",
    label: "Personal cause",
    kind: "affinity",
    polarity: 1,
    description:
      "A specific cause tied to family history or lived experience (e.g. funding research for a particular disease). Client-specific — store the named cause.",
    dnaSignals: ["my late father", "the disease that affected our family", "the foundation funds research into", "deeply personal"],
    themes: ["healthcare"],
    portfolio: {
      prefer: ["Health Care"],
      avoid: [],
      note: "Bind to a named cause string per client; conflict fires when news threatens that specific cause.",
    },
    persona: "Schneider (chronic-illness research)",
  },
  {
    key: "geographic-anchoring",
    label: "Geographic anchoring",
    kind: "axis",
    poles: { negative: "Home / Swiss bias", positive: "Globally diversified" },
    description:
      "Preference for familiar domestic exposure versus broad global diversification. Strong home bias is common in UHNW.",
    dnaSignals: ["keep it in Switzerland", "Swiss quality", "don't trust foreign markets", "want global reach"],
    themes: ["geopolitics", "market-movement"],
    portfolio: {
      regionBias: "Schweiz ↔ Global",
      prefer: [],
      avoid: [],
    },
    persona: "Räber (Swiss home bias)",
  },
  {
    key: "us-exposure",
    label: "US market exposure",
    kind: "affinity",
    polarity: -1,
    description:
      "Stance on investing in US markets / companies. polarity -1 = aversion to US exposure (Räber: 'not speculate on Silicon Valley cloud bubbles'); flip to +1 for a client who wants US growth/AI exposure. Client-specific.",
    dnaSignals: ["not speculate on Silicon Valley", "avoid US tech", "stick to European names", "want S&P 500 exposure", "US growth story"],
    themes: ["market-movement", "tech-innovation"],
    portfolio: {
      regionFocus: "USA",
      prefer: [],
      avoid: ["Information Technology", "Digital Assets"],
      note: "Gate on Region = USA; for an averse client, US tech/AI names are the sharpest conflict.",
    },
    persona: "Räber (averse to US tech)",
  },
  {
    key: "environmental",
    label: "Environmental",
    kind: "affinity",
    polarity: 1,
    description:
      "Strength of environmental / sustainability conviction. High → seek green exposure, avoid polluters (fossil fuels, deforestation, palm oil).",
    dnaSignals: ["reforestation", "carbon footprint", "sustainable", "won't hold polluters", "climate"],
    themes: ["environment", "energy"],
    portfolio: {
      prefer: ["Utilities"],
      avoid: ["Energy", "Materials"],
      avoidTraits: ["palm oil", "deforestation", "high-emissions"],
    },
    persona: "Huber (reforestation)",
  },
  {
    key: "social-ethics",
    label: "Social & ethical conduct",
    kind: "affinity",
    polarity: 1,
    description:
      "Sensitivity to labour practices, human rights and social conduct of held companies. High → exit firms tied to exploitation/abuse.",
    dnaSignals: ["fair labour", "human rights", "won't profit from exploitation", "ethical supply chain"],
    themes: ["governance"],
    portfolio: {
      prefer: [],
      avoid: [],
      avoidTraits: ["labour exploitation", "human-rights controversy"],
    },
    persona: "Ammann / Huber",
  },
  {
    key: "reputation-sensitivity",
    label: "Reputation sensitivity",
    kind: "affinity",
    polarity: 1,
    description:
      "Degree to which reputational risk = financial risk. For prominent clients, association with a scandalised holding is itself a loss; they exit profitable positions to avoid it.",
    dnaSignals: ["in the public eye", "can't be associated with", "my name", "reputational risk"],
    themes: ["governance", "geopolitics"],
    portfolio: {
      prefer: [],
      avoid: [],
      avoidTraits: ["scandal", "boycott", "regulatory action", "fraud"],
    },
    persona: "Ammann (corporate reputation)",
  },
  {
    key: "philanthropy",
    label: "Philanthropy",
    kind: "affinity",
    polarity: 1,
    description:
      "Treats the portfolio partly as a vehicle for social good / impact — mission-aligned investing, foundation endowments, returns earmarked for giving.",
    dnaSignals: ["give back", "our foundation", "endowment", "impact investing", "for the community"],
    themes: ["healthcare", "environment"],
    portfolio: {
      prefer: ["Health Care", "Utilities", "Private Markets"],
      avoid: [],
      note: "Often co-occurs with personal-cause; philanthropy is the giving orientation, personal-cause is the specific beneficiary.",
    },
    persona: "Schneider (family foundation)",
  },
  {
    key: "military-defence",
    label: "Military / defence",
    kind: "affinity",
    polarity: -1,
    description:
      "Stance on defence / weapons exposure. polarity -1 = ethical avoidance of arms (the common expressed value); flip to +1 for a client who actively seeks defence exposure. Client-specific.",
    dnaSignals: ["won't invest in weapons", "no arms manufacturers", "pacifist", "defence is a growth area"],
    themes: ["geopolitics"],
    portfolio: {
      prefer: [],
      avoid: ["Industrials"],
      avoidTraits: ["weapons", "arms manufacturing", "defence contractor"],
      note: "Industrials is broad — gate the avoid on defence/aerospace names, not the whole sector.",
    },
    persona: "—",
  },
  {
    key: "confidentiality",
    label: "Confidentiality",
    kind: "affinity",
    polarity: 1,
    structural: true,
    description:
      "Premium on discretion and privacy — avoiding public exposure, preferring private/structured vehicles. Structural (shapes vehicle choice), not news-driven.",
    dnaSignals: ["keep this private", "discretion", "out of the public eye", "no public markets"],
    themes: [],
    portfolio: {
      prefer: ["Private Markets", "Real Estate (Fund)"],
      avoid: [],
    },
    persona: "—",
  },
];

export const VALUE_KEYS = VALUE_AXES.map((v) => v.key);

// Validate every referenced theme exists in the Stage-2 vocabulary.
for (const v of VALUE_AXES) {
  for (const t of v.themes) {
    if (!THEME_KEYS.includes(t)) {
      throw new Error(`values.mjs: axis "${v.key}" references unknown theme "${t}"`);
    }
  }
}

// Reverse index: theme -> value-axis keys it can touch.
export const THEME_TO_VALUES = {};
for (const t of THEME_KEYS) THEME_TO_VALUES[t] = [];
for (const v of VALUE_AXES) for (const t of v.themes) THEME_TO_VALUES[t].push(v.key);

// Given an article's Stage-2 themes, which client value-axes does it touch?
export function valuesForThemes(themes = []) {
  const keys = new Set();
  for (const t of themes) for (const k of THEME_TO_VALUES[t] || []) keys.add(k);
  return VALUE_AXES.filter((v) => keys.has(v.key));
}

// Short labels for chart axes.
const SHORT = {
  "personal-cause": "Personal cause",
  "geographic-anchoring": "Geographic",
  "us-exposure": "US exposure",
  environmental: "Environmental",
  "social-ethics": "Social/ethics",
  "reputation-sensitivity": "Reputation",
  philanthropy: "Philanthropy",
  "military-defence": "Military",
  confidentiality: "Confidential",
};

// Per-axis intensity for ALL axes (for a spider chart): the share of an axis's
// themes that the article hits (0..1). Structural axes (no themes) stay at 0.
export function scoreValues(themes = []) {
  const set = new Set(themes);
  return VALUE_AXES.map((v) => {
    const overlap = v.themes.filter((t) => set.has(t)).length;
    return {
      key: v.key,
      label: v.label,
      short: SHORT[v.key] || v.label,
      overlap,
      score: v.themes.length ? overlap / v.themes.length : 0,
    };
  });
}
