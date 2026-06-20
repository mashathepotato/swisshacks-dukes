import type { Theme, ThemeId } from "../types";

export const THEMES: Theme[] = [
  { id: "environmental", label: "Environmental", emoji: "🌱", color: "#38a169" },
  { id: "us_tech_bullish", label: "US-Tech Bullish", emoji: "🇺🇸", color: "#3182ce" },
  { id: "defensive", label: "Capital Preservation", emoji: "🛡️", color: "#805ad5" },
  { id: "income", label: "Income / Dividends", emoji: "💰", color: "#d69e2e" },
  { id: "reputation", label: "Reputation-Sensitive", emoji: "🏛️", color: "#dd6b20" },
  { id: "healthcare", label: "Healthcare / Philanthropy", emoji: "⚕️", color: "#e53e3e" },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ThemeId, Theme>
);
