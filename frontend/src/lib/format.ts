export function scoreColor(score: number): string {
  if (score >= 80) return "#c0271a";
  if (score >= 65) return "#a85a1c";
  if (score >= 45) return "#94680a";
  return "#1f7a4d";
}

/** Compact CHF figure: 3_200_000 → "CHF 3.2M", 640_000 → "CHF 640k". */
export function formatMoney(chf: number): string {
  if (chf >= 1_000_000) return `CHF ${(chf / 1_000_000).toFixed(chf >= 10_000_000 ? 0 : 1)}M`;
  if (chf >= 1_000) return `CHF ${Math.round(chf / 1_000)}k`;
  return `CHF ${chf}`;
}

// Anchor "now" to the book's reporting date so relative times stay stable in the demo.
const NOW = new Date("2026-06-20T00:00:00Z");

/** A short "since" label: "today", "2d ago", "3w ago", "2mo ago". */
export function relativeTime(dateStr: string): string {
  const then = new Date(dateStr + "T00:00:00Z");
  const days = Math.round((NOW.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export const SIGNAL_META: Record<string, { label: string; color: string }> = {
  value_conflict: { label: "Value conflict", color: "#c0271a" },
  reputational: { label: "Reputational", color: "#a85a1c" },
  mandate_drift: { label: "Mandate drift", color: "#94680a" },
  opportunity: { label: "Opportunity", color: "#1f7a4d" },
  exposure: { label: "Exposure", color: "#3a5a8c" },
};
