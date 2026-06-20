import { useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { ClientGrid } from "./components/ClientGrid";
import { SimulatorChat } from "./components/SimulatorChat";
import { RehearseOutcome } from "./components/RehearseOutcome";
import { ClientDetail } from "./components/ClientDetail";
import { ClientPage } from "./components/ClientPage";
import { NewsFeed } from "./components/NewsFeed";
import { NewsDetail } from "./components/NewsDetail";
import type { Client, NewsItem } from "./types";
import { RANKED_NEWS } from "./data/news";
import { useCustomize } from "./lib/customizeStore";

type Tab = "priority" | "clients" | "news" | "simulator" | "book";

const TAB_CONFIG: Record<Tab, string> = {
  priority: "📋 Priority queue",
  clients: "👥 Clients",
  news: "📰 News feed",
  simulator: "💬 Rehearse",
  book: "🔬 Rehearse outcome",
};

export default function App() {
  const { customising, toggleCustomising, tabOrder, reorderTabs, resetTabs, density, setDensity } = useCustomize();

  const [tab, setTab] = useState<Tab>("priority");
  const [selected, setSelected] = useState<Client | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(RANKED_NEWS[0]?.news ?? null);
  const [simFocus, setSimFocus] = useState<string | null>(null);
  const [fullClient, setFullClient] = useState<Client | null>(null);
  const [dragTab, setDragTab] = useState<string | null>(null);

  function openSimulator(client: Client) {
    setFullClient(null);
    setSimFocus(client.id);
    setTab("simulator");
  }
  function openFullClient(client: Client) {
    setSelected(client);
    setFullClient(client);
  }

  if (fullClient) {
    return (
      <div className={"density-" + density}>
        <ClientPage client={fullClient} onBack={() => setFullClient(null)} onSimulate={openSimulator} />
      </div>
    );
  }

  return (
    <div className={"app density-" + density}>
      <div className="topbar">
        <div className="brand">RM Copilot <span className="sub">SwissHacks · Dukes</span></div>
        <div className={"tabs" + (customising ? " editing" : "")}>
          {tabOrder.map((key) => {
            const label = TAB_CONFIG[key as Tab];
            if (!label) return null;
            return (
              <button
                key={key}
                className={"tab" + (tab === key ? " active" : "") + (customising ? " draggable" : "") + (dragTab === key ? " dragging" : "")}
                draggable={customising}
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; setDragTab(key); }}
                onDragEnd={() => setDragTab(null)}
                onDragOver={(e) => { if (customising) e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("text/plain") || dragTab;
                  if (from && from !== key) reorderTabs(from, key);
                  setDragTab(null);
                }}
                onClick={() => setTab(key as Tab)}
                title={customising ? "Drag to reorder" : undefined}
              >
                {customising && <span className="grip">⠿</span>}{label}
              </button>
            );
          })}
        </div>
        <div className="topbar-actions">
          {customising && (
            <button className="dens-toggle" onClick={resetTabs} title="Reset tab order">↺ Tabs</button>
          )}
          <button
            className="dens-toggle"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
            title="Toggle spacing"
          >
            {density === "compact" ? "⊟ Compact" : "▦ Comfortable"}
          </button>
          <button className={"cust-toggle" + (customising ? " on" : "")} onClick={toggleCustomising}>
            ⚙ {customising ? "Done" : "Customise"}
          </button>
          <div className="rm-badge">RM · <b>T. Keller</b></div>
        </div>
      </div>

      {customising && (
        <div className="cust-hint">
          ⚙ Customise mode — drag the tabs above to reorder them. Open a client to rearrange and resize their page. Your layout is saved automatically.
        </div>
      )}

      <div className="main">
        <div className="content">
          {tab === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
          {tab === "clients" && <ClientGrid onOpen={openFullClient} />}
          {tab === "news" && <NewsFeed selectedId={selectedNews?.id ?? null} onSelect={setSelectedNews} />}
          {tab === "simulator" && <SimulatorChat focusClientId={simFocus} />}
          {tab === "book" && <RehearseOutcome />}
        </div>
        {tab === "priority" && <ClientDetail client={selected} onOpenFull={openFullClient} />}
        {tab === "news" && <NewsDetail news={selectedNews} onOpenClient={openFullClient} />}
      </div>
    </div>
  );
}



