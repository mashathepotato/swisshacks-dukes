import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Tracks which clients the RM has manually marked "dealt with" (messaged /
 * informed). They drop out of the active queue into a separate completed list
 * but keep their priority. Persisted to localStorage so the worklist survives
 * a refresh.
 */
const KEY = "dukes.doneClients";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface DoneContextValue {
  done: Set<string>;
  isDone: (id: string) => boolean;
  markDone: (id: string) => void;
  reopen: (id: string) => void;
}

const DoneContext = createContext<DoneContextValue | null>(null);

export function DoneProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [ids]);

  const done = useMemo(() => new Set(ids), [ids]);
  const markDone = useCallback((id: string) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id])), []);
  const reopen = useCallback((id: string) => setIds((prev) => prev.filter((x) => x !== id)), []);

  const value = useMemo<DoneContextValue>(
    () => ({ done, isDone: (id) => done.has(id), markDone, reopen }),
    [done, markDone, reopen]
  );

  return <DoneContext.Provider value={value}>{children}</DoneContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDone(): DoneContextValue {
  const ctx = useContext(DoneContext);
  if (!ctx) throw new Error("useDone must be used within a DoneProvider");
  return ctx;
}
