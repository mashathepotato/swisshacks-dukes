import type { Client, ThemeId } from "../types";

/**
 * Project a client's value affinities onto a 2D positioning map.
 *  x: -1 (defensive / anti-US) ... +1 (US-tech / growth appetite)
 *  y: -1 (returns-led)         ... +1 (values-led)
 */
export function valueCoords(client: Client): { x: number; y: number } {
  const a = (t: ThemeId) => client.affinities.find((v) => v.theme === t)?.weight ?? 0;
  const x = a("us_tech_bullish") - 0.5 * a("defensive") - 0.4 * a("income");
  const y =
    a("environmental") + a("healthcare") + 0.8 * a("reputation") -
    (0.9 * a("income") + 0.5 * a("defensive"));
  return { x: clamp(x), y: clamp(y) };
}

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

export const AXIS_LABELS = {
  top: "VALUES-LED",
  bottom: "RETURNS-LED",
  left: "DEFENSIVE · ANTI-US",
  right: "US-TECH · GROWTH",
};
