// Shared customisation types, defaults, and helpers (no React) so the store
// module can export only its provider + hook (keeps fast-refresh happy).

export type Density = "comfortable" | "compact";

export interface ClientSection {
  id: string;
  span: 1 | 2; // 1 = half width, 2 = full width (2-track grid)
  height?: number; // persisted resize height (px), optional
  hidden?: boolean;
}

export const DEFAULT_TAB_ORDER = ["priority", "clients", "news", "simulator", "book"];

export const DEFAULT_CLIENT_LAYOUT: ClientSection[] = [
  { id: "reasoning", span: 2 },
  { id: "value", span: 1 },
  { id: "profile", span: 1 },
  { id: "signals", span: 1 },
  { id: "learning", span: 1 },
  { id: "recommendations", span: 1 },
  { id: "compliance", span: 2 },
  { id: "draft", span: 1 },
];

/** Move `from` to sit immediately before `to` within a list. */
export function moveBefore<T>(list: T[], from: T, to: T): T[] {
  if (from === to) return list;
  const next = list.filter((x) => x !== from);
  const i = next.indexOf(to);
  if (i < 0) return list;
  next.splice(i, 0, from);
  return next;
}

/** Keep a stored ordered tab list in sync with the canonical set: drop unknown, append new. */
export function reconcileTabs(stored: string[]): string[] {
  const known = stored.filter((t) => DEFAULT_TAB_ORDER.includes(t));
  const missing = DEFAULT_TAB_ORDER.filter((t) => !known.includes(t));
  return [...known, ...missing];
}

export function reconcileLayout(stored: ClientSection[]): ClientSection[] {
  const byId = new Map(stored.map((s) => [s.id, s]));
  const known = stored.filter((s) => DEFAULT_CLIENT_LAYOUT.some((d) => d.id === s.id));
  const missing = DEFAULT_CLIENT_LAYOUT.filter((d) => !byId.has(d.id));
  return [...known, ...missing];
}
