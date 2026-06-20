import type { Theme, ThemeId } from "../types";

// The 9 client value-axes (mirrors news-test/values.mjs VALUE_AXES).
export const THEMES: Theme[] = [
  { id: "personal-cause", label: "Personal cause", short: "Personal cause", emoji: "❤️", color: "#e53e3e" },
  { id: "geographic-anchoring", label: "Geographic anchoring", short: "Geographic", emoji: "🇨🇭", color: "#3182ce" },
  { id: "us-exposure", label: "US market exposure", short: "US exposure", emoji: "🇺🇸", color: "#dd6b20" },
  { id: "environmental", label: "Environmental", short: "Environmental", emoji: "🌱", color: "#38a169" },
  { id: "social-ethics", label: "Social & ethical conduct", short: "Social/ethics", emoji: "⚖️", color: "#805ad5" },
  { id: "reputation-sensitivity", label: "Reputation sensitivity", short: "Reputation", emoji: "🏛️", color: "#d69e2e" },
  { id: "philanthropy", label: "Philanthropy", short: "Philanthropy", emoji: "🤲", color: "#ec4899" },
  { id: "military-defence", label: "Military / defence", short: "Military", emoji: "🛡️", color: "#718096" },
  { id: "confidentiality", label: "Confidentiality", short: "Confidential", emoji: "🔒", color: "#4a5568" },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ThemeId, Theme>
);
