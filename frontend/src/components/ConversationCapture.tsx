import { useState } from "react";
import type { Client, ConsentRecord, DistillResult, AffinityDelta } from "../types";
import { useRecorder } from "../lib/useRecorder";
import { useConversation } from "../lib/conversationStore";
import { useRmProfile } from "../lib/rmProfileStore";

type Phase = "consent" | "record" | "review";

export function ConversationCapture({ client }: { client: Client }) {
  const rec = useRecorder();
  const { commit } = useConversation();
  const { profile } = useRmProfile();
  const [phase, setPhase] = useState<Phase>("consent");
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [result, setResult] = useState<DistillResult | null>(null);
  const [noteText, setNoteText] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function giveConsent(method: "verbal" | "written") {
    setConsent({
      clientId: client.id,
      rmName: profile.name,
      method,
      timestamp: new Date().toISOString(),
    });
    setPhase("record");
  }

  async function distill() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/transcript/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          transcript: rec.transcript,
          rmName: consent?.rmName ?? "RM",
          clientContact: client.name,
        }),
      });
      if (!res.ok) throw new Error(`distill failed (${res.status})`);
      const data: DistillResult = await res.json();
      setResult(data);
      setNoteText(data.note.text);
      const init: Record<string, boolean> = {};
      data.dnaDeltas.values.forEach((v) => (init[`v:${v}`] = true));
      data.dnaDeltas.dislikes.forEach((d) => (init[`d:${d}`] = true));
      data.dnaDeltas.affinities.forEach((a) => (init[`a:${a.theme}`] = true));
      setAccepted(init);
      setPhase("review");
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    if (!result) return;
    const deltas = {
      values: result.dnaDeltas.values.filter((v) => accepted[`v:${v}`]),
      dislikes: result.dnaDeltas.dislikes.filter((d) => accepted[`d:${d}`]),
      affinities: result.dnaDeltas.affinities.filter((a: AffinityDelta) => accepted[`a:${a.theme}`]),
    };
    commit(client.id, deltas, { ...result.note, text: noteText }, result.receipts);
    setPhase("consent"); setConsent(null); setResult(null); rec.stop(); rec.reset();
  }

  return (
    <section className="conv-capture" style={{ border: "1px solid var(--border, #2a3142)", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3>🎙️ Conversation Capture — {client.name}</h3>

      {phase === "consent" && (
        <div>
          <p>Recording requires the client's consent. Confirm how consent was given:</p>
          <button onClick={() => giveConsent("verbal")}>Client consented verbally</button>{" "}
          <button onClick={() => giveConsent("written")}>Client consented in writing</button>
        </div>
      )}

      {phase === "record" && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            ✓ Consent ({consent?.method}) recorded {consent?.timestamp}
          </p>
          {!rec.supported && <p style={{ color: "var(--amber, #d69e2e)" }}>Live mic needs Chrome. Paste a transcript below instead.</p>}
          <div>
            {!rec.recording
              ? <button onClick={rec.start} disabled={!rec.supported}>● Record</button>
              : <button onClick={rec.stop}>■ Stop</button>}
          </div>
          <textarea
            value={rec.transcript + (rec.interim ? " " + rec.interim : "")}
            onChange={(e) => rec.setTranscript(e.target.value)}
            readOnly={rec.recording}
            rows={6}
            style={{ width: "100%", marginTop: 8 }}
            placeholder="Live transcript appears here… (or paste one)"
          />
          {rec.error && <p style={{ color: "var(--red, #e53e3e)" }}>{rec.error}</p>}
          <button onClick={distill} disabled={busy || !rec.transcript.trim()}>
            {busy ? "Distilling…" : "Distill → review"}
          </button>
          {err && <p style={{ color: "var(--red, #e53e3e)" }}>{err}</p>}
        </div>
      )}

      {phase === "review" && result && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>✓ Consent ({consent?.method}) · {consent?.timestamp}</p>
          <label><strong>CRM note</strong></label>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} style={{ width: "100%" }} />

          <h4>Proposed DNA updates (uncheck to reject)</h4>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {result.dnaDeltas.values.map((v) => (
              <li key={`v:${v}`}><label><input type="checkbox" checked={!!accepted[`v:${v}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`v:${v}`]: e.target.checked }))} /> Value: {v}</label></li>
            ))}
            {result.dnaDeltas.dislikes.map((d) => (
              <li key={`d:${d}`}><label><input type="checkbox" checked={!!accepted[`d:${d}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`d:${d}`]: e.target.checked }))} /> Dislike: {d}</label></li>
            ))}
            {result.dnaDeltas.affinities.map((a) => {
              const cur = client.affinities.find((x) => x.theme === a.theme)?.weight ?? 0;
              return (
                <li key={`a:${a.theme}`}><label><input type="checkbox" checked={!!accepted[`a:${a.theme}`]} onChange={(e) => setAccepted((p) => ({ ...p, [`a:${a.theme}`]: e.target.checked }))} /> Affinity: {a.theme}: {cur.toFixed(2)} → {a.toWeight.toFixed(2)}</label></li>
              );
            })}
          </ul>

          <h4>Quote receipts</h4>
          <ul>
            {result.receipts.map((r, i) => (
              <li key={r.sourceId + ":" + i} style={{ fontSize: 13, opacity: 0.85 }}>"{r.quote}" <span style={{ opacity: 0.6 }}>— {r.sourceId}</span></li>
            ))}
          </ul>

          <button onClick={approve}>✓ Approve &amp; merge</button>{" "}
          <button onClick={() => setPhase("record")}>← Back</button>
        </div>
      )}
    </section>
  );
}
