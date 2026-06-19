export function scoreColor(score: number): string {
  if (score >= 80) return "#e53e3e";
  if (score >= 65) return "#dd6b20";
  if (score >= 45) return "#d69e2e";
  return "#4a7a52";
}

export const SIGNAL_META: Record<string, { label: string; color: string }> = {
  value_conflict: { label: "Value conflict", color: "#e53e3e" },
  reputational: { label: "Reputational", color: "#dd6b20" },
  mandate_drift: { label: "Mandate drift", color: "#d69e2e" },
  opportunity: { label: "Opportunity", color: "#38a169" },
  exposure: { label: "Exposure", color: "#4f8ff7" },
};
