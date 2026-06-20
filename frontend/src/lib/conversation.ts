import type { Client, DnaDeltas } from "../types";

/** Pure merge: returns a new Client with the accepted DNA deltas applied. */
export function mergeDeltas(client: Client, deltas: DnaDeltas): Client {
  const values = [...client.values];
  for (const v of deltas.values) if (!values.includes(v)) values.push(v);

  const dislikes = [...client.dislikes];
  for (const d of deltas.dislikes) if (!dislikes.includes(d)) dislikes.push(d);

  const affinities = client.affinities.map((a) => ({ ...a }));
  for (const delta of deltas.affinities) {
    const existing = affinities.find((a) => a.theme === delta.theme);
    if (existing) existing.weight = delta.toWeight;
    else affinities.push({ theme: delta.theme, weight: delta.toWeight });
  }

  return { ...client, values, dislikes, affinities };
}
