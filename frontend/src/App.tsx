import { useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { SimulatorChat } from "./components/SimulatorChat";
import { RehearseOutcome } from "./components/RehearseOutcome";
import { ClientDetail } from "./components/ClientDetail";
import { ClientPage } from "./components/ClientPage";
import { NewsFeed } from "./components/NewsFeed";
import { NewsDetail } from "./components/NewsDetail";
import type { Client, NewsItem } from "./types";
import { RANKED_NEWS } from "./data/news";

type Tab = "priority" | "news" | "simulator" | "book";

export default function App() {
  const [tab, setTab] = useState<Tab>("priority");
  const [selected, setSelected] = useState<Client | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(RANKED_NEWS[0]?.news ?? null);
  const [simFocus, setSimFocus] = useState<string | null>(null);
  // when set, the full client page is shown full-screen over the tabs
  const [fullClient, setFullClient] = useState<Client | null>(null);

  function openSimulator(client: Client) {
    setFullClient(null);
    setSimFocus(client.id);
    setTab("simulator");
  }

  // open the dedicated full-screen client page (from the queue drawer or news impact map)
  function openFullClient(client: Client) {
    setSelected(client);
    setFullClient(client);
  }

  if (fullClient) {
    return (
      <ClientPage
        client={fullClient}
        onBack={() => setFullClient(null)}
        onSimulate={openSimulator}
      />
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">RM Copilot <span className="sub">SwissHacks · Dukes</span></div>
        <div className="tabs">
          <button className={"tab" + (tab === "priority" ? " active" : "")} onClick={() => setTab("priority")}>📋 Priority queue</button>
          <button className={"tab" + (tab === "news" ? " active" : "")} onClick={() => setTab("news")}>📰 News feed</button>
          <button className={"tab" + (tab === "simulator" ? " active" : "")} onClick={() => setTab("simulator")}>💬 Rehearse</button>
          <button className={"tab" + (tab === "book" ? " active" : "")} onClick={() => setTab("book")}>🔬 Rehearse outcome</button>
        </div>
        <div className="rm-badge">Relationship Manager · <b>T. Keller</b></div>
      </div>

      <div className="main">
        <div className="content">
          {tab === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
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

