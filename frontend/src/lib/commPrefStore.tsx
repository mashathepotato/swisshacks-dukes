import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Client } from "../types";
import type { CommChannel, CommLength, CommPref } from "./commPrefs";
import { defaultPref } from "./commPrefs";

export interface PrefChange {
  clientId: string;
  field: "channel" | "length";
  from: string;
  to: string;
  date: string;
}
interface Stored { prefs: Record<string, CommPref>; history: PrefChange[]; }

const KEY = "dukes.commPrefs";

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch { /* ignore */ }
  return { prefs: {}, history: [] };
}
// fixed "today" for the demo (Date.* is intentionally avoided in this codebase)
const TODAY = "2026-06-20";

interface Value {
  prefFor: (client: Client) => CommPref;
  isCustom: (clientId: string) => boolean;
  setChannel: (client: Client, channel: CommChannel) => void;
  setLength: (client: Client, length: CommLength) => void;
  historyFor: (clientId: string) => PrefChange[];
}
const Ctx = createContext<Value | null>(null);

export function CommPrefProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const prefFor = useCallback(
    (client: Client): CommPref => state.prefs[client.id] ?? defaultPref(client.id),
    [state],
  );
  const isCustom = useCallback((clientId: string) => clientId in state.prefs, [state]);

  const change = useCallback((client: Client, field: "channel" | "length", to: CommChannel | CommLength) => {
    setState((prev) => {
      const current = prev.prefs[client.id] ?? defaultPref(client.id);
      if (current[field] === to) return prev;
      const next: CommPref = { ...current, [field]: to } as CommPref;
      const log: PrefChange = { clientId: client.id, field, from: current[field], to, date: TODAY };
      return { prefs: { ...prev.prefs, [client.id]: next }, history: [...prev.history, log] };
    });
  }, []);

  const setChannel = useCallback((c: Client, ch: CommChannel) => change(c, "channel", ch), [change]);
  const setLength = useCallback((c: Client, l: CommLength) => change(c, "length", l), [change]);
  const historyFor = useCallback(
    (id: string) => state.history.filter((h) => h.clientId === id).slice().reverse(),
    [state],
  );

  const value = useMemo<Value>(
    () => ({ prefFor, isCustom, setChannel, setLength, historyFor }),
    [prefFor, isCustom, setChannel, setLength, historyFor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommPrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCommPrefs must be used within CommPrefProvider");
  return c;
}
