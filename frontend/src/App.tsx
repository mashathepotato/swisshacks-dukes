import { useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { ClientGrid } from "./components/ClientGrid";
import { Rehearse } from "./components/Rehearse";
import { ClientDetail } from "./components/ClientDetail";
import { ClientPage } from "./components/ClientPage";
import { NewsFeed } from "./components/NewsFeed";
import { NewsDetail } from "./components/NewsDetail";
import { RmProfilePanel } from "./components/RmProfilePanel";
import type { Client, NewsItem } from "./types";
import { RANKED_NEWS } from "./data/news";
import { useRmProfile } from "./lib/rmProfileStore";

type Tab = "priority" | "clients" | "news" | "rehearse";

export default function App() {
  const [tab, setTab] = useState<Tab>("priority");
  const [selected, setSelected] = useState<Client | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(RANKED_NEWS[0]?.news ?? null);
  const [simFocus, setSimFocus] = useState<string | null>(null);
  // when set, the full client page is shown full-screen over the tabs
  const [fullClient, setFullClient] = useState<Client | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const { profile } = useRmProfile();

  // Rehearse is reached only from a client's profile ("Rehearse this proposal with…")
  function openSimulator(client: Client) {
    setFullClient(null);
    setSimFocus(client.id);
    setTab("rehearse");
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
          <button className={"tab" + (tab === "priority" ? " active" : "")} onClick={() => setTab("priority")}>Priority queue</button>
          <button className={"tab" + (tab === "clients" ? " active" : "")} onClick={() => setTab("clients")}>Clients</button>
          <button className={"tab" + (tab === "news" ? " active" : "")} onClick={() => setTab("news")}>News feed</button>
        </div>
        <button className="rm-badge" onClick={() => setShowProfile(true)} title="Edit your communication conventions">
          Relationship Manager · <b>{profile.name}</b> <span className="rm-gear">Edit</span>
        </button>
      </div>
      <RmProfilePanel open={showProfile} onClose={() => setShowProfile(false)} />

      <div className="main">
        <div className="content">
          {tab === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
          {tab === "clients" && <ClientGrid onOpen={openFullClient} />}
          {tab === "news" && <NewsFeed selectedId={selectedNews?.id ?? null} onSelect={setSelectedNews} />}
          {tab === "rehearse" && <Rehearse focusClientId={simFocus} />}
        </div>
        {tab === "priority" && <ClientDetail client={selected} onOpenFull={openFullClient} />}
        {tab === "news" && <NewsDetail news={selectedNews} onOpenClient={openFullClient} />}
      </div>
    </div>
  );
}





