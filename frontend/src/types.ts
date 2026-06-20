export type Mandate = "Defensive" | "Balanced" | "Growth";

// The client value-axes (news-test VALUE_KEYS in values.mjs). One vocabulary for
// client DNA, hand-authored news themes, simulate and learning. Pipeline articles
// are tagged with news-themes and bridged onto these via scoreValues.
export type ThemeId =
  | "personal-cause"
  | "geographic-anchoring"
  | "us-exposure"
  | "environmental"
  | "social-ethics"
  | "reputation-sensitivity"
  | "philanthropy"
  | "military-defence"
  | "confidentiality";

export interface Theme {
  id: ThemeId;
  label: string;
  short: string;
  emoji: string;
  color: string;
}

/**
 * How strongly a client holds a value-axis (0..1). `polarity` encodes the
 * direction for bipolar/slot axes: +1 = seek it, -1 = avoid it (default +1).
 */
export interface ValueAffinity {
  theme: ThemeId;
  weight: number;
  polarity?: 1 | -1;
}

export type SignalType =
  | "value_conflict"
  | "reputational"
  | "mandate_drift"
  | "opportunity"
  | "exposure";

export interface NewsSignal {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  summary: string;
  type: SignalType;
  severity: number; // 0..100
  matchedHoldings: string[];
}

export interface Recommendation {
  id: string;
  action: string;
  rationale: string;
  evidence: string[];
  confidence: number; // 0..1
}

/**
 * One link in the "Glass Thread" — the deterministic chain of reasoning that
 * explains WHY a client surfaced at this priority. Ordered as a sequence of
 * events: client DNA → portfolio exposure → news → resulting conflict →
 * relationship sensitivity → priority score.
 */
export type ReasonKind =
  | "dna"          // a CRM-derived client trait
  | "holding"      // a portfolio position
  | "news"         // a market / news event
  | "conflict"     // the resulting value conflict or alignment
  | "relationship" // relationship sensitivity that amplifies urgency
  | "score";       // the resulting priority score

/**
 * A "source receipt": the verbatim evidence that justifies a reason — a CRM
 * note, a client email, a news snippet, a CIO desk instruction. Shape mirrors
 * the Phase-B `Evidence` model so the two can converge.
 */
export type EvidenceKind = "crm" | "email" | "client" | "news" | "cio" | "market";

export interface Evidence {
  kind: EvidenceKind;
  sourceId: string;  // provenance, e.g. "crm_schneider.csv:2024-05-14" or "inbox · Mrs Schneider"
  quote: string;     // the exact passage that backs the reason
  date?: string;     // ISO date
  ref?: string;      // optional ISIN or URL for deeper linking
}

export interface ReasonStep {
  kind: ReasonKind;
  label: string;          // short headline for the step
  detail: string;         // one-line explanation
  source?: string;        // provenance, e.g. "CRM 2023-09" or "Bloomberg · 2026-06-17"
  evidence?: Evidence[];  // direct receipts; the step expands to reveal these
}

export type Voice = "values-led" | "data-driven";

/**
 * A proposed client message the RM can review, edit and send. The AI never
 * sends directly — this is a draft surfaced as an actionable next step.
 */
export interface DraftEmail {
  subject: string;
  body: Record<Voice, string>;
}

/**
 * RM feedback on a recommendation or message — the reward signal in the
 * learning loop. Accepting / tweaking / declining nudges a per-client
 * preference model that tunes future recommendations.
 */
export type FeedbackDecision = "accepted" | "tweaked" | "declined";

export interface FeedbackEvent {
  id: string;
  clientId: string;
  date: string;            // ISO date (YYYY-MM-DD)
  theme: ThemeId;          // value dimension the recommendation touched
  decision: FeedbackDecision;
  summary: string;         // short description of what was decided
  voice?: Voice;           // framing used, if it was a message
}

/** Per value-theme: how feedback has shifted the client's learned affinity. */
export interface ThemeLearning {
  theme: ThemeId;
  base: number;            // original DNA affinity (0..1)
  learned: number;         // affinity after feedback (0..1)
  delta: number;           // learned - base
  accept: number;          // 0..1 acceptance rate on this theme (overall if none)
  n: number;               // feedback events on this theme
}

/** A per-client preference model inferred from feedback history. */
export interface PreferenceModel {
  clientId: string;
  sampleSize: number;
  acceptanceRate: number;  // 0..1 overall (0.5 prior when no data)
  themes: ThemeLearning[];
  preferredVoice: Voice | null;
  voiceRates: Record<Voice, { rate: number; n: number }>;
  recent: FeedbackEvent[]; // most-recent first
}

export interface Client {
  id: string;
  name: string;
  archetype: string;
  isPersona: boolean; // true = one of the 4 challenge personas
  mandate: Mandate;
  tenureYears: number;
  riskProfile: "Low" | "Moderate" | "High";
  commStyle: string;
  values: string[];
  dislikes: string[];
  affinities: ValueAffinity[];
  priorityScore: number; // 0..100
  topReason: string;
  signals: NewsSignal[];
  recommendations: Recommendation[];
  topHoldings: string[];
  amountAtStake?: number;        // CHF exposure tied to the active signal
  lastMessageAt?: string;        // ISO date the client last reached out, if any
  reasoningChain?: ReasonStep[]; // authored Glass-Thread chain (personas)
  draftEmail?: DraftEmail;       // authored client message draft (personas)
}

/**
 * A market / news event in the live feed. Authored with an intrinsic severity
 * and a value-theme "footprint"; which clients it actually touches is computed
 * live against the book (see `newsImpacts`).
 */
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  summary: string;
  type: SignalType;
  severity: number;          // 0..100 intrinsic significance of the story
  themes: ThemeId[];         // value dimensions this story touches (its footprint)
  matchedHoldings: string[]; // instrument names that may appear in client.topHoldings
  whyItMatters: string;      // one-paragraph reasoning: why this surfaced
  drivers: string[];         // short bullets behind the priority score
}

/** A client surfaced as affected by a news item, with computed impact. */
export interface NewsImpact {
  client: Client;
  impact: number;   // 0..100 estimated effect on this client
  theme: ThemeId;   // the value dimension through which the news reaches them
  via: string;      // human-readable reason (holding match / value alignment)
  holdings: string[]; // matched holdings, if any
}

export interface ChatMessage {
  role: "rm" | "copilot";
  text: string;
}

/** A simulated client-trajectory point under a proposed RM action. */
export interface TrajectoryPoint {
  label: string; // e.g. "Now", "Q1", "Q2"
  trust: number; // 0..100 relationship trust
  alignment: number; // 0..100 portfolio-to-values alignment
}

export interface SimulationResult {
  acceptanceProbability: number; // 0..1
  predictedReaction: string;
  objections: string[];
  bestFraming: string;
  nextStep: string;
  trajectory: TrajectoryPoint[];
}
