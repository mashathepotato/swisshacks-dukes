import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientSection, Density } from "./customize";
import { DEFAULT_CLIENT_LAYOUT, DEFAULT_TAB_ORDER, moveBefore, reconcileLayout, reconcileTabs } from "./customize";

/**
 * Per-RM dashboard customisation — tab order, client-page layout, and density —
 * persisted to localStorage (mirrors doneStore / learningStore). `customising`
 * is session-only: it gates the edit handles without being remembered.
 */

const KEYS = { tabs: "dukes.tabOrder", layout: "dukes.clientLayout", density: "dukes.density" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface CustomizeValue {
  customising: boolean;
  toggleCustomising: () => void;

  tabOrder: string[];
  reorderTabs: (from: string, to: string) => void;
  resetTabs: () => void;

  density: Density;
  setDensity: (d: Density) => void;

  clientLayout: ClientSection[];
  reorderSections: (from: string, to: string) => void;
  setSpan: (id: string, span: 1 | 2) => void;
  setHeight: (id: string, height: number | undefined) => void;
  toggleHidden: (id: string) => void;
  resetLayout: () => void;
}

const Ctx = createContext<CustomizeValue | null>(null);

export function CustomizeProvider({ children }: { children: ReactNode }) {
  const [customising, setCustomising] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>(() => reconcileTabs(load(KEYS.tabs, DEFAULT_TAB_ORDER)));
  const [density, setDensityState] = useState<Density>(() => load<Density>(KEYS.density, "comfortable"));
  const [clientLayout, setClientLayout] = useState<ClientSection[]>(() => reconcileLayout(load(KEYS.layout, DEFAULT_CLIENT_LAYOUT)));

  useEffect(() => { try { localStorage.setItem(KEYS.tabs, JSON.stringify(tabOrder)); } catch { /* ignore */ } }, [tabOrder]);
  useEffect(() => { try { localStorage.setItem(KEYS.density, JSON.stringify(density)); } catch { /* ignore */ } }, [density]);
  useEffect(() => { try { localStorage.setItem(KEYS.layout, JSON.stringify(clientLayout)); } catch { /* ignore */ } }, [clientLayout]);

  const reorderTabs = useCallback((from: string, to: string) => setTabOrder((prev) => moveBefore(prev, from, to)), []);
  const resetTabs = useCallback(() => setTabOrder(DEFAULT_TAB_ORDER), []);
  const setDensity = useCallback((d: Density) => setDensityState(d), []);

  const reorderSections = useCallback(
    (from: string, to: string) => setClientLayout((prev) => moveBefore(prev.map((s) => s.id), from, to).map((id) => prev.find((s) => s.id === id)!)),
    []
  );
  const setSpan = useCallback((id: string, span: 1 | 2) => setClientLayout((prev) => prev.map((s) => (s.id === id ? { ...s, span } : s))), []);
  const setHeight = useCallback((id: string, height: number | undefined) => setClientLayout((prev) => prev.map((s) => (s.id === id ? { ...s, height } : s))), []);
  const toggleHidden = useCallback((id: string) => setClientLayout((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s))), []);
  const resetLayout = useCallback(() => setClientLayout(DEFAULT_CLIENT_LAYOUT), []);

  const value = useMemo<CustomizeValue>(
    () => ({
      customising, toggleCustomising: () => setCustomising((v) => !v),
      tabOrder, reorderTabs, resetTabs,
      density, setDensity,
      clientLayout, reorderSections, setSpan, setHeight, toggleHidden, resetLayout,
    }),
    [customising, tabOrder, reorderTabs, resetTabs, density, setDensity, clientLayout, reorderSections, setSpan, setHeight, toggleHidden, resetLayout]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomize(): CustomizeValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomize must be used within a CustomizeProvider");
  return ctx;
}
