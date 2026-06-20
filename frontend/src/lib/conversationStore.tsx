import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Client, DnaDeltas, DistillNote, Evidence } from "../types";
import { mergeDeltas } from "./conversation";

export interface ConversationEntry {
  clientId: string;
  note: DistillNote;
  receipts: Evidence[];
}

interface ConversationContextValue {
  /** Approved DNA deltas applied per client. */
  deltasFor: (clientId: string) => DnaDeltas[];
  notes: ConversationEntry[];
  /** Commit an approved conversation: store the note + receipts and the deltas. */
  commit: (clientId: string, deltas: DnaDeltas, note: DistillNote, receipts: Evidence[]) => void;
  /** Returns the client with all approved deltas merged in. */
  withDeltas: (client: Client) => Client;
}

const Ctx = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [deltas, setDeltas] = useState<Record<string, DnaDeltas[]>>({});
  const [notes, setNotes] = useState<ConversationEntry[]>([]);

  const commit = useCallback<ConversationContextValue["commit"]>((clientId, d, note, receipts) => {
    setDeltas((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), d] }));
    setNotes((prev) => [{ clientId, note, receipts }, ...prev]);
  }, []);

  const deltasFor = useCallback((clientId: string) => deltas[clientId] ?? [], [deltas]);

  const withDeltas = useCallback<ConversationContextValue["withDeltas"]>(
    (client) => (deltas[client.id] ?? []).reduce((c, d) => mergeDeltas(c, d), client),
    [deltas]
  );

  const value = useMemo(
    () => ({ deltasFor, notes, commit, withDeltas }),
    [deltasFor, notes, commit, withDeltas]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConversation(): ConversationContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConversation must be used within a ConversationProvider");
  return ctx;
}
