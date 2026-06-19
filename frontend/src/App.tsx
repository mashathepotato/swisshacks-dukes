import { useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { SimulatorChat } from "./components/SimulatorChat";
import { BookSimulator } from "./components/BookSimulator";
import { ClientDetail } from "./components/ClientDetail";
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

  function openSimulator(client: Client) {
    setSimFocus(client.id);
    setTab("simulator");
  }

  // jump from a news impact map straight to the client's full profile
  function openClient(client: Client) {
    setSelected(client);
    setTab("priority");
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">RM Copilot <span className="sub">SwissHacks · Dukes</span></div>
        <div className="tabs">
          <button className={"tab" + (tab === "priority" ? " active" : "")} onClick={() => setTab("priority")}>📋 Priority queue</button>
          <button className={"tab" + (tab === "news" ? " active" : "")} onClick={() => setTab("news")}>📰 News feed</button>
          <button className={"tab" + (tab === "simulator" ? " active" : "")} onClick={() => setTab("simulator")}>💬 Rehearse</button>
          <button className={"tab" + (tab === "book" ? " active" : "")} onClick={() => setTab("book")}>🌐 Book simulator</button>
        </div>
        <div className="rm-badge">Relationship Manager · <b>T. Keller</b></div>
      </div>

      <div className="main">
        <div className="content">
          {tab === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
          {tab === "news" && <NewsFeed selectedId={selectedNews?.id ?? null} onSelect={setSelectedNews} />}
          {tab === "simulator" && <SimulatorChat focusClientId={simFocus} />}
          {tab === "book" && <BookSimulator />}
        </div>
        {tab === "priority" && <ClientDetail client={selected} onSimulate={openSimulator} />}
        {tab === "news" && <NewsDetail news={selectedNews} onOpenClient={openClient} />}
      </div>
    </div>
  );
}
