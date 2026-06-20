# Client value-axes

The controlled vocabulary of investment **values** we infer per client for the
Client DNA. Each axis is the bridge between three things:

- **DNA** — cues in the CRM conversation logs that reveal the value
- **News** — the Stage-2 news themes that touch it (see the news pipeline's
  `THEME_VOCAB` in `news-test/classify.mjs`)
- **Portfolio** — the holdings it should tilt toward / away from, in the data's
  real Industry Group vocabulary

Two kinds of axis:
- **axis** — bipolar, scored −1..+1 (a spectrum between two poles)
- **affinity** — a conviction scored 0..1 with a `polarity`: **+1 = seek it**,
  **−1 = avoid it**

> The machine-readable schema lives in `news-test/values.mjs` (`VALUE_AXES`,
> `valuesForThemes`, `scoreValues`). This file is the human-facing summary.

## The eight axes

| Axis | Kind | Poles / polarity | News themes | Persona |
|---|---|---|---|---|
| **personal-cause** | affinity | +1 (seek) | healthcare | Schneider |
| **geographic-anchoring** | axis | Home/Swiss ↔ Global | geopolitics, market-movement | Räber |
| **us-exposure** | affinity | −1 (avoid US) by default | market-movement, tech-innovation | Räber |
| **environmental** | affinity | +1 (seek green / avoid polluters) | environment, energy | Huber |
| **social-ethics** | affinity | +1 (avoid abuses) | governance | Huber / Ammann |
| **reputation-sensitivity** | affinity | +1 (avoid scandal) | governance, geopolitics | Ammann |
| **philanthropy** | affinity | +1 (mission-aligned) | healthcare, environment | Schneider |
| **military-defence** | affinity | −1 (avoid arms) by default | geopolitics | — |
| **confidentiality** | affinity | +1 (structural) | — | — |

## Detail

### personal-cause
A specific cause tied to family history or lived experience (e.g. funding
research for a particular disease). **Client-specific** — store the *named*
cause; the conflict fires when news threatens that specific cause.
- DNA cues: "my late father", "the disease that affected our family", "the
  foundation funds research into", "deeply personal"
- Portfolio: prefer Health Care.

### geographic-anchoring
Preference for familiar domestic exposure versus broad global diversification.
Strong home bias is common in UHNW (Swiss couple averse to foreign markets).
- DNA cues: "keep it in Switzerland", "Swiss quality", "don't trust foreign
  markets", "want global reach"
- Portfolio: region bias Schweiz ↔ Global.

### us-exposure
Stance on investing in US markets / companies. **polarity −1** = aversion to US
exposure (Räber explicitly rejects "Silicon Valley cloud bubbles"); flip to **+1**
for a client who wants US growth / AI exposure. Distinct from
`geographic-anchoring`: that's home-vs-global broadly, this is the US specifically.
- DNA cues: "not speculate on Silicon Valley", "avoid US tech", "stick to
  European names", "want S&P 500 exposure", "US growth story"
- Portfolio: gate on Region = USA; avoid Information Technology, Digital Assets —
  US tech/AI names are the sharpest conflict for an averse client.

### environmental
Strength of environmental / sustainability conviction. High → seek green
exposure, avoid polluters (fossil fuels, deforestation, palm oil).
- DNA cues: "reforestation", "carbon footprint", "sustainable", "won't hold
  polluters", "climate"
- Portfolio: prefer Utilities; avoid Energy, Materials; avoid traits *palm oil,
  deforestation, high-emissions*.

### social-ethics
Sensitivity to labour practices, human rights and social conduct of held
companies. High → exit firms tied to exploitation/abuse.
- DNA cues: "fair labour", "human rights", "won't profit from exploitation",
  "ethical supply chain"
- Portfolio: avoid traits *labour exploitation, human-rights controversy*.

### reputation-sensitivity
Degree to which **reputational risk = financial risk**. For prominent clients,
association with a scandalised holding is itself a loss; they exit profitable
positions to avoid it.
- DNA cues: "in the public eye", "can't be associated with", "my name",
  "reputational risk"
- Portfolio: avoid traits *scandal, boycott, regulatory action, fraud*.

### philanthropy
Treats the portfolio partly as a vehicle for social good / impact — mission-
aligned investing, foundation endowments, returns earmarked for giving. Often
co-occurs with **personal-cause** (philanthropy is the giving orientation;
personal-cause is the specific beneficiary).
- DNA cues: "give back", "our foundation", "endowment", "impact investing",
  "for the community"
- Portfolio: prefer Health Care, Utilities, Private Markets.

### military-defence
Stance on defence / weapons exposure. **polarity −1** = ethical avoidance of arms
(the common expressed value); flip to **+1** for a client who actively seeks
defence exposure. Client-specific.
- DNA cues: "won't invest in weapons", "no arms manufacturers", "pacifist",
  "defence is a growth area"
- Portfolio: avoid Industrials — but gate on defence/aerospace *names*, not the
  whole sector.

### confidentiality
Premium on discretion and privacy — avoiding public exposure, preferring
private/structured vehicles. **Structural** (shapes vehicle choice), not
news-driven; it won't fire from a headline.
- DNA cues: "keep this private", "discretion", "out of the public eye", "no
  public markets"
- Portfolio: prefer Private Markets, Real Estate (Fund).

## Notes

- **An article can implicate several values** — and should. A labour scandal hits
  both `social-ethics` and `reputation-sensitivity`; the mapping is intentionally
  uncapped. Narrowing to the value that *genuinely* applies is the LLM conflict
  step's job, not the theme→value mapping's.
- **Structural axes** (`confidentiality`, and any with no news themes) sit at the
  centre of the value spider by design — news can't surface them; they shape
  vehicle and mandate choice instead.
- **personal-cause**, **military-defence** and **us-exposure** are *slots*: bind
  them to a per-client value (a named disease; a pro/anti-arms sign; a pro/anti-US
  sign) rather than a global default — the polarity flips by client.
