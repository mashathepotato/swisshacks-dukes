import type { Client } from "../types";

export const DIGEST_MIN_WORDS = 40;
export const DIGEST_MIN_INTERVAL_MS = 5000;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Fire a live digest only when enough new words AND enough time have accrued. */
export function shouldRequestDigest(
  prevWords: number,
  curWords: number,
  lastAtMs: number,
  nowMs: number,
): boolean {
  return curWords - prevWords >= DIGEST_MIN_WORDS && nowMs - lastAtMs >= DIGEST_MIN_INTERVAL_MS;
}

/** Compact current-DNA summary sent as context for the finalize pass. */
export function dnaContextOf(client: Client): string {
  const aff = client.affinities.map((a) => `${a.theme} ${a.weight.toFixed(2)}`).join(", ");
  return [
    client.values.length ? `values: ${client.values.join("; ")}` : "",
    client.dislikes.length ? `dislikes: ${client.dislikes.join("; ")}` : "",
    aff ? `affinities: ${aff}` : "",
  ].filter(Boolean).join(" | ");
}
