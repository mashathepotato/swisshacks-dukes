import type { Theme, ThemeId } from "../types";

export const THEMES: Theme[] = [
  { id: "environment", label: "Environment", emoji: "🌱", color: "#38a169" },
  { id: "tech-innovation", label: "Tech & Innovation", emoji: "💡", color: "#3182ce" },
  { id: "healthcare", label: "Healthcare", emoji: "⚕️", color: "#e53e3e" },
  { id: "governance", label: "Governance & Conduct", emoji: "🏛️", color: "#dd6b20" },
  { id: "consumer", label: "Consumer & Staples", emoji: "🛒", color: "#805ad5" },
  { id: "financials", label: "Financials & Income", emoji: "💰", color: "#d69e2e" },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ThemeId, Theme>
);
