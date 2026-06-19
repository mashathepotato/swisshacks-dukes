import { useState } from "react";
import { PriorityQueue } from "./components/PriorityQueue";
import { SimulatorChat } from "./components/SimulatorChat";
import { BookSimulator } from "./components/BookSimulator";
import { ClientDetail } from "./components/ClientDetail";
import type { Client } from "./types";

type Tab = "priority" | "simulator" | "book";

export default function App() {
  const [tab, setTab] = useState<Tab>("priority");
  const [selected, setSelected] = useState<Client | null>(null);
  const [simFocus, setSimFocus] = useState<string | null>(null);

  function openSimulator(client: Client) {
    setSimFocus(client.id);
    setTab("simulator");
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">RM Copilot <span className="sub">SwissHacks · Dukes</span></div>
        <div className="tabs">
          <button className={"tab" + (tab === "priority" ? " active" : "")} onClick={() => setTab("priority")}>📋 Priority queue</button>
          <button className={"tab" + (tab === "simulator" ? " active" : "")} onClick={() => setTab("simulator")}>💬 Rehearse</button>
          <button className={"tab" + (tab === "book" ? " active" : "")} onClick={() => setTab("book")}>🌐 Book simulator</button>
        </div>
        <div className="rm-badge">Relationship Manager · <b>T. Keller</b></div>
      </div>

      <div className="main">
        <div className="content">
          {tab === "priority" && <PriorityQueue selectedId={selected?.id ?? null} onSelect={setSelected} />}
          {tab === "simulator" && <SimulatorChat focusClientId={simFocus} />}
          {tab === "book" && <BookSimulator />}
        </div>
        {tab === "priority" && <ClientDetail client={selected} onSimulate={openSimulator} />}
      </div>
    </div>
  );
}
