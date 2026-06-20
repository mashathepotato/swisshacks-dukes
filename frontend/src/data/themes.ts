import type { Theme, ThemeId } from "../types";

export const THEMES: Theme[] = [
  { id: "environmental", label: "Environmental", short: "Environ.", emoji: "", color: "#1f7a4d" },
  { id: "us_tech_bullish", label: "US-Tech Bullish", short: "US Tech", emoji: "", color: "#3a5a8c" },
  { id: "defensive", label: "Capital Preservation", short: "Capital", emoji: "", color: "#5a4b86" },
  { id: "income", label: "Income / Dividends", short: "Income", emoji: "", color: "#94680a" },
  { id: "reputation", label: "Reputation-Sensitive", short: "Reputation", emoji: "", color: "#a85a1c" },
  { id: "healthcare", label: "Healthcare / Philanthropy", short: "Health", emoji: "", color: "#c0271a" },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ThemeId, Theme>
);
