import { useMemo, useRef, useState } from "react";
import type { Client, ChatMessage } from "../types";
import { buildClientContext } from "../lib/clientContext";
import { useLearning } from "../lib/learningStore";
import { useConversation } from "../lib/conversationStore";

const SUGGESTIONS = [
  "What should I lead with?",
  "Summarise their portfolio risk",
  "What changed since last contact?",
];

export function AskClient({ client }: { client: Client }) {
  const { modelFor } = useLearning();
  const { notes } = useConversation();
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [aiEngine, setAiEngine] = useState<Record<number, boolean>>({});
  const seqRef = useRef(0);

  const clientNotes = useMemo(
    () => notes.filter((n) => n.clientId === client.id).map((n) => ({ text: n.note.text, date: n.note.date })),
    [notes, client.id]
  );
  const context = useMemo(
    () => buildClientContext(client, { model: modelFor(client), notes: clientNotes }),
    [client, modelFor, clientNotes]
  );

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    const history = thread.slice();
    const next: ChatMessage[] = [...thread, { role: "rm", text: q }];
    setThread(next);
    setInput("");
    setPending(true);
    const seq = ++seqRef.current;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client, context, question: q, history }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { answer: string; engine: string } | null) => {
        if (seq !== seqRef.current) return;
        const answer = d?.answer || "Couldn't reach the copilot. Try again.";
        setThread((t) => {
          const idx = t.length;
          setAiEngine((m) => ({ ...m, [idx]: d?.engine === "anthropic" }));
          return [...t, { role: "copilot", text: answer }];
        });
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setThread((t) => [...t, { role: "copilot", text: "Couldn't reach the copilot. Try again." }]);
      })
      .finally(() => { if (seq === seqRef.current) setPending(false); });
  }

  return (
    <div className="askclient">
      <div className="section-title">Ask about {client.name}</div>
      <div className="ask-thread">
        {thread.length === 0 && !pending && (
          <p className="ask-empty">Ask anything about {client.name}. Answers draw on their DNA, portfolio, signals and history.</p>
        )}
        {thread.map((m, i) => (
          <div key={i} className={"ask-bubble " + m.role}>
            {m.text}
            {m.role === "copilot" && aiEngine[i] && <span className="ask-ai" title="Answered by the LLM copilot"> ✦ AI</span>}
          </div>
        ))}
        {pending && (
          <div className="sim-thinking" role="status" aria-live="polite">
            <div className="sim-dots" aria-hidden="true"><span /><span /><span /></div>
            <p className="sim-thinking-label">Reading {client.name}'s file…</p>
          </div>
        )}
      </div>

      {thread.length === 0 && (
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ask-chip" onClick={() => send(s)} disabled={pending}>{s}</button>
          ))}
        </div>
      )}

      <div className="ask-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          aria-label={`Ask about ${client.name}`}
          placeholder={`Ask about ${client.name}…`}
          disabled={pending}
        />
        <button onClick={() => send(input)} disabled={!input.trim() || pending}>Ask</button>
      </div>
      <p className="ask-note">Grounded in what's on file. Review before acting.</p>
    </div>
  );
}
