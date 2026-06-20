import { useEffect, useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { ClientGrid } from "./components/ClientGrid";
import { Rehearse } from "./components/Rehearse";
import { ClientDetail } from "./components/ClientDetail";
import { ClientPage } from "./components/ClientPage";
import { NewsFeed } from "./components/NewsFeed";
import { NewsDetail } from "./components/NewsDetail";
import { RmProfilePanel } from "./components/RmProfilePanel";
import type { Client, NewsItem } from "./types";
import { CLIENTS } from "./data/clients";
import { RANKED_NEWS } from "./data/news";
import { useRmProfile } from "./lib/rmProfileStore";

type Tab = "priority" | "clients" | "news";
// The view is encoded in the URL hash so the browser back/forward buttons work
// and a refresh keeps you on the page you're on.
type Route =
  | { name: Tab }
  | { name: "client"; id: string }
  | { name: "rehearse"; id: string | null };

function serialize(r: Route): string {
  if (r.name === "client") return `#/client/${r.id}`;
  if (r.name === "rehearse") return `#/rehearse/${r.id ?? ""}`;
  return `#/${r.name}`;
}
function parseHash(hash: string): Route {
  const [a, b] = hash.replace(/^#\/?/, "").split("/");
  if (a === "client" && b) return { name: "client", id: b };
  if (a === "rehearse") return { name: "rehearse", id: b || null };
  if (a === "clients" || a === "news") return { name: a };
  return { name: "priority" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [selected, setSelected] = useState<Client | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(RANKED_NEWS[0]?.news ?? null);
  const [showProfile, setShowProfile] = useState(false);
  const { profile } = useRmProfile();

  // browser back/forward (and external hash edits) drive the view
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // every navigation pushes a history entry → the browser back button just works
  function navigate(r: Route) {
    const next = serialize(r);
    if (window.location.hash === next) setRoute(r); // same hash fires no event
    else window.location.hash = next;
  }

  function openFullClient(client: Client) {
    setSelected(client);
    navigate({ name: "client", id: client.id });
  }
  function openSimulator(client: Client) {
    navigate({ name: "rehearse", id: client.id });
  }

  const activeClient = route.name === "client" ? CLIENTS.find((c) => c.id === route.id) ?? null : null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">RM Copilot <span className="sub">SwissHacks · Dukes</span></div>
        <div className="tabs">
          <button className={"tab" + (route.name === "priority" ? " active" : "")} onClick={() => navigate({ name: "priority" })}>Priority queue</button>
          <button className={"tab" + (route.name === "clients" ? " active" : "")} onClick={() => navigate({ name: "clients" })}>Clients</button>
          <button className={"tab" + (route.name === "news" ? " active" : "")} onClick={() => navigate({ name: "news" })}>News feed</button>
        </div>
        <button className="rm-badge" onClick={() => setShowProfile(true)} title="Edit your communication conventions">
          Relationship Manager · <b>{profile.name}</b> <span className="rm-gear">Edit</span>
        </button>
      </div>
      <RmProfilePanel open={showProfile} onClose={() => setShowProfile(false)} />

      {activeClient ? (
        <ClientPage client={activeClient} onSimulate={openSimulator} />
      ) : (
        <div className="main">
          <div className="content">
            {route.name === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
            {route.name === "clients" && <ClientGrid onOpen={openFullClient} />}
            {route.name === "news" && <NewsFeed selectedId={selectedNews?.id ?? null} onSelect={setSelectedNews} />}
            {route.name === "rehearse" && <Rehearse focusClientId={route.id} />}
          </div>
          {route.name === "priority" && <ClientDetail client={selected} onOpenFull={openFullClient} />}
          {route.name === "news" && <NewsDetail news={selectedNews} onOpenClient={openFullClient} />}
        </div>
      )}
    </div>
  );
}
