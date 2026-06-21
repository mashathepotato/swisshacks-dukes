import { useEffect, useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { ClientGrid } from "./components/ClientGrid";
import { Rehearse } from "./components/Rehearse";
import { ClientDetail } from "./components/ClientDetail";
import { ClientPage } from "./components/ClientPage";
import { NewsFeed } from "./components/NewsFeed";
import { ClientNewsFeed } from "./components/ClientNewsFeed";
import { NewsViewToggle } from "./components/NewsViewToggle";
import type { NewsView } from "./components/NewsViewToggle";
import { RmProfilePanel } from "./components/RmProfilePanel";
import type { Client } from "./types";
import { CLIENTS } from "./data/clients";
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
  // A proposal handed to the rehearse page (e.g. the draft) so the composer is pre-filled.
  const [pendingProposal, setPendingProposal] = useState<string | null>(null);
  const [newsView, setNewsView] = useState<NewsView>("client");
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
  function openSimulator(client: Client, proposal?: string) {
    setPendingProposal(proposal ?? null);
    navigate({ name: "rehearse", id: client.id });
  }

  const activeClient = route.name === "client" ? CLIENTS.find((c) => c.id === route.id) ?? null : null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">Priori</div>
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
            {route.name === "news" && (
              <div className="newstab">
                <div className="newstab-bar">
                  <NewsViewToggle view={newsView} onView={setNewsView} />
                </div>
                {newsView === "funnel" ? <NewsFeed /> : <ClientNewsFeed />}
              </div>
            )}
            {route.name === "rehearse" && <Rehearse focusClientId={route.id} initialProposal={pendingProposal} />}
          </div>
          {route.name === "priority" && <ClientDetail client={selected} onOpenFull={openFullClient} />}
        </div>
      )}
    </div>
  );
}
