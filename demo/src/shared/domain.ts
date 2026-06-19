export type Mandate = "Defensive" | "Balanced" | "Growth";
export type Voice = "data-driven" | "values-led";
export type Severity = "act" | "watch" | "info";
export type AlertType =
  | "dna-conflict"
  | "dna-opportunity"
  | "cio-dna-conflict"
  | "cio-sell"
  | "drift-breach"
  | "client-signal"
  | "news-hit";
export type EvidenceKind = "crm" | "cio" | "news" | "market" | "client";
export type Rating = "BUY" | "HOLD" | "SELL";

export interface Evidence {
  kind: EvidenceKind;
  sourceId: string;   // e.g. "crm_schneider.csv:2024-05-14"
  quote: string;
  date: string;       // ISO date
  ref?: string;       // ISIN or URL
}

export interface DnaTrait {
  id: string;
  label: string;
  detail: string;
  confidence: number; // 0..1
  evidence: Evidence[];
}

export interface DnaProfile {
  clientId: string;
  name: string;
  mandate: Mandate;
  style: Voice;
  traits: DnaTrait[];
}

export interface Holding {
  isin: string;
  issuer: string;
  assetClass: string;
  subAssetClass: string;
  region: string;
  industryGroup: string;
  targetCHF: number;
  currentCHF: number;
  valor: string;
  mic: string;
  yahoo: string;
}

export interface CioEntry {
  isin: string;
  issuer: string;
  rating: Rating;
  ratingSince: string;
  industryGroup: string;
  subAssetClass: string;
  cioView: string;
}

export interface StrategyTarget {
  subAssetClass: string;
  defPct: number;
  balancedPct: number;
  growthPct: number;
}

export interface DriftBreach {
  subAssetClass: string;
  targetPct: number;
  currentPct: number;
  deltaPct: number;   // currentPct - targetPct
  breached: boolean;  // Math.abs(deltaPct) > 2.0
}

export interface SwapCandidate {
  isin: string;
  issuer: string;
  cioView: string;
}

export interface RejectedCandidate {
  isin: string;
  issuer: string;
  reason: string;
}

export interface SwapResult {
  sell: { isin: string; issuer: string };
  chosen: SwapCandidate | null; // null => no compliant swap
  rejected: RejectedCandidate[];
}

export interface Trace {
  id: string;
  claim: string;
  type: AlertType;
  confidence: number;
  severity: Severity;
  evidence: Evidence[];
  valueAtStakeCHF?: number;
}

export interface ClientSignal {
  id: string;
  clientId: string;
  text: string;
  receivedAt: string;
  flagged: boolean;   // true => raises the client's priority for the RM
  reason: string;     // why it was (or wasn't) flagged
}

export interface SimResult {
  sell: { isin: string; issuer: string; currentCHF: number };
  buy: { isin: string; issuer: string; rating: Rating | null; industryGroup: string };
  amountCHF: number;
  sameSector: boolean;
  buyRatingOk: boolean;          // buy instrument is CIO-rated BUY
  driftBefore: DriftBreach[];
  driftAfter: DriftBreach[];
  newBreaches: string[];         // sub-asset classes breached after the trade but not before
  compliant: boolean;            // same sector + CIO-BUY + introduces no new ±2.0pp breach
  dna: { verdict: "honors" | "conflicts" | "neutral"; reason: string; traitId?: string };
}

export interface InboxRow {
  id: string;
  name: string;
  mandate: Mandate;
  top: { type: AlertType; severity: Severity; claim: string; valueAtStakeCHF?: number } | null;
  score: number;
}

export interface NewsEvent {
  id: string;
  headline: string;
  summary: string;
  affectedIsins: string[];
  publishedAt: string;
  url?: string;
  // "threat" (default): negative news that may trigger divestment.
  // "opportunity": positive news aligning with a client value.
  // "cio-directive": a CIO recommendation that may conflict with client DNA.
  kind?: "threat" | "opportunity" | "cio-directive";
  // Optional explicit trait this event keys off (by DnaTrait.id). When absent,
  // a "threat" event falls back to the divestment-style trait heuristic.
  triggerTraitId?: string;
}

export interface CrmNote {
  date: string;
  medium: string;
  rmName: string;
  contact: string;
  note: string;
}
