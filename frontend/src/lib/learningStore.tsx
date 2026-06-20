import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Client, FeedbackEvent, PreferenceModel } from "../types";
import { SEED_FEEDBACK } from "../data/feedback";
import { buildModel } from "./learning";

interface LearningContextValue {
  events: FeedbackEvent[];
  /** Append a new RM decision; the per-client model updates immediately. */
  record: (e: Omit<FeedbackEvent, "id" | "date"> & { date?: string }) => void;
  modelFor: (client: Client) => PreferenceModel;
}

const LearningContext = createContext<LearningContextValue | null>(null);

let seq = 0;
function nextId(): string {
  seq += 1;
  return `fb-live-${seq}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<FeedbackEvent[]>(SEED_FEEDBACK);

  const record = useCallback<LearningContextValue["record"]>((e) => {
    setEvents((prev) => [...prev, { id: nextId(), date: e.date ?? today(), ...e }]);
  }, []);

  const modelFor = useCallback<LearningContextValue["modelFor"]>(
    (client) => buildModel(client, events),
    [events]
  );

  const value = useMemo(() => ({ events, record, modelFor }), [events, record, modelFor]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLearning(): LearningContextValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error("useLearning must be used within a LearningProvider");
  return ctx;
}
