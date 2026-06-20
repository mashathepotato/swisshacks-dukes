import type { Theme, ThemeId } from "../types";

// The 9 client value-axes (mirrors news-test/values.mjs VALUE_AXES).
// Muted Swiss-house palette so the colours sit on white.
export const THEMES: Theme[] = [
  { id: "personal-cause", label: "Personal cause", short: "Personal cause", emoji: "❤", color: "#c0271a" },
  { id: "geographic-anchoring", label: "Geographic anchoring", short: "Geographic", emoji: "⌖", color: "#3a5a8c" },
  { id: "us-exposure", label: "US market exposure", short: "US exposure", emoji: "★", color: "#a85a1c" },
  { id: "environmental", label: "Environmental", short: "Environ.", emoji: "❧", color: "#1f7a4d" },
  { id: "social-ethics", label: "Social & ethical conduct", short: "Social/ethics", emoji: "⚖", color: "#5a4b86" },
  { id: "reputation-sensitivity", label: "Reputation sensitivity", short: "Reputation", emoji: "▣", color: "#94680a" },
  { id: "philanthropy", label: "Philanthropy", short: "Philanthropy", emoji: "✿", color: "#a14a6b" },
  { id: "military-defence", label: "Military / defence", short: "Military", emoji: "◈", color: "#545861" },
  { id: "confidentiality", label: "Confidentiality", short: "Confidential", emoji: "⊘", color: "#3f4651" },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ThemeId, Theme>
);
