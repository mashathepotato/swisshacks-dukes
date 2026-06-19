import fs from "fs";
import path from "path";
import { CioEntry, ClientSignal, DnaProfile, Holding, Mandate, NewsEvent, StrategyTarget } from "../../shared/domain";
import { loadPortfolio, loadStrategies, loadCioList } from "../data/loaders";
import { frozenDir } from "../data/paths";

interface ClientReg { id: string; name: string; mandate: Mandate; crmFile: string; }

const REGISTRY: ClientReg[] = [
  { id: "schneider", name: "Hubertus Schneider", mandate: "Balanced", crmFile: "crm_schneider.csv" },
  { id: "huber", name: "Marius Huber", mandate: "Defensive", crmFile: "crm_huber.csv" },
  { id: "raeber", name: "Eugen Räber", mandate: "Defensive", crmFile: "crm_raeber.csv" },
  { id: "ammann", name: "Julian Ammann", mandate: "Growth", crmFile: "crm_ammann.csv" },
];

const frozen = (f: string) => JSON.parse(fs.readFileSync(path.join(frozenDir(), f), "utf8"));

export interface Store {
  listClients(): { id: string; name: string; mandate: Mandate }[];
  getDna(id: string): DnaProfile | undefined;
  getHoldings(id: string): Holding[];
  getNews(id: string): NewsEvent[];
  getCio(): CioEntry[];
  getStrategies(): StrategyTarget[];
  getThread(id: string): unknown;
  getMessageCache(): Record<string, string>;
  addSignal(signal: ClientSignal): void;
  getSignals(id: string): ClientSignal[];
}

let singleton: Store | undefined;

export function getStore(): Store {
  if (singleton) return singleton;

  const cio = loadCioList();
  const strategies = loadStrategies();
  const messageCache = frozen("message_cache.json") as Record<string, string>;
  const dnaById: Record<string, DnaProfile> = {
    schneider: frozen("dna_schneider.json"),
    ammann: frozen("dna_ammann.json"),
    huber: frozen("dna_huber.json"),
    raeber: frozen("dna_raeber.json"),
  };
  const newsById: Record<string, NewsEvent[]> = {
    schneider: [frozen("news_schneider.json")],
    ammann: [frozen("news_ammann.json")],
    huber: [frozen("news_huber.json")],
    raeber: [frozen("news_raeber.json")],
  };
  const threadById: Record<string, unknown> = {
    schneider: frozen("thread_schneider.json"),
    ammann: frozen("thread_ammann.json"),
    huber: frozen("thread_huber.json"),
    raeber: frozen("thread_raeber.json"),
  };
  const holdingsByMandate: Record<Mandate, Holding[]> = {
    Defensive: loadPortfolio("Defensive"),
    Balanced: loadPortfolio("Balanced"),
    Growth: loadPortfolio("Growth"),
  };
  // Inbound client messages accumulate at runtime (reset on restart).
  const signalsById: Record<string, ClientSignal[]> = {};

  singleton = {
    listClients: () => REGISTRY.filter(({ id }) => id in dnaById).map(({ id, name, mandate }) => ({ id, name, mandate })),
    getDna: (id) => dnaById[id],
    getHoldings: (id) => {
      const reg = REGISTRY.find((r) => r.id === id);
      return reg ? holdingsByMandate[reg.mandate] : [];
    },
    getNews: (id) => newsById[id] || [],
    getCio: () => cio,
    getStrategies: () => strategies,
    getThread: (id) => threadById[id],
    getMessageCache: () => messageCache,
    addSignal: (signal) => {
      (signalsById[signal.clientId] ??= []).push(signal);
    },
    getSignals: (id) => (signalsById[id] ?? []).slice(),
  };
  return singleton;
}
