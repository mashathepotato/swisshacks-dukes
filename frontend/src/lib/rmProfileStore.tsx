import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CommChannel } from "./commPrefs";
import type { RmProfile } from "./rmProfile";
import { DEFAULT_RM } from "./rmProfile";

const KEY = "dukes.rmProfile";

function load(): RmProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<RmProfile>;
      return { ...DEFAULT_RM, ...p, signoff: { ...DEFAULT_RM.signoff, ...(p.signoff ?? {}) } };
    }
  } catch { /* ignore */ }
  return DEFAULT_RM;
}

interface Value {
  profile: RmProfile;
  update: (patch: Partial<RmProfile>) => void;
  setSignoff: (channel: CommChannel, text: string) => void;
  reset: () => void;
}
const Ctx = createContext<Value | null>(null);

export function RmProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<RmProfile>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
  }, [profile]);

  const update = useCallback((patch: Partial<RmProfile>) => setProfile((p) => ({ ...p, ...patch })), []);
  const setSignoff = useCallback((channel: CommChannel, text: string) =>
    setProfile((p) => ({ ...p, signoff: { ...p.signoff, [channel]: text } })), []);
  const reset = useCallback(() => setProfile(DEFAULT_RM), []);

  const value = useMemo<Value>(() => ({ profile, update, setSignoff, reset }), [profile, update, setSignoff, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRmProfile() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRmProfile must be used within RmProfileProvider");
  return c;
}
