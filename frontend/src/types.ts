export type Mandate = "Defensive" | "Balanced" | "Growth";

export type ThemeId =
  | "environmental"
  | "us_tech_bullish"
  | "defensive"
  | "income"
  | "reputation"
  | "healthcare";

export interface Theme {
  id: ThemeId;
  label: string;
  emoji: string;
  color: string;
}

/** How strongly a client aligns with a value theme (0..1). */
export interface ValueAffinity {
  theme: ThemeId;
  weight: number;
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
