import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Client, ConsentRecord, DistillResult, AffinityDelta, DigestResult, DialogueResult } from "../types";
import { countWords, shouldRequestDigest, dnaContextOf } from "../lib/digest";
import { useRecorder } from "../lib/useRecorder";
import { useConversation } from "../lib/conversationStore";
import { useRmProfile } from "../lib/rmProfileStore";

type Phase = "consent" | "record";

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
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [turns, setTurns] = useState<DialogueResult["turns"] | null>(null);
  const [tab, setTab] = useState<"voice" | "manual">("voice");
  const [manualText, setManualText] = useState("");
  const lastWordsRef = useRef(0);
  const lastAtRef = useRef(0);
  const seqRef = useRef(0);

  // Live rolling digest while recording: debounced by words + time, stale-guarded.
  useEffect(() => {
    if (phase !== "record" || !rec.recording) return;
    const words = countWords(rec.transcript);
    if (!shouldRequestDigest(lastWordsRef.current, words, lastAtRef.current, Date.now())) return;
    lastWordsRef.current = words;
    lastAtRef.current = Date.now();
    const seq = ++seqRef.current;
    fetch("/api/transcript/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, transcript: rec.transcript, mode: "live" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DigestResult | null) => { if (d && seq === seqRef.current) setDigest(d); })
      .catch(() => {});
  }, [rec.transcript, rec.recording, phase, client.id]);

  function handleStop() {
    rec.stop();
    void finalize();
  }

  function giveConsent(method: "verbal" | "written") {
    setConsent({
      clientId: client.id,
      rmName: profile.name,
      method,
      timestamp: new Date().toISOString(),
    });
    setPhase("record");
  }

  // On Stop (or "Generate insights" for the paste path): attribute the dialogue
  // (RM vs Client), then run the finalize digest and DNA-proposal distill on the
  // speaker-labeled transcript so DNA is driven by what the client said.
  async function finalize() {
    const raw = rec.transcript.trim();
    if (!raw) return;
    setBusy(true); setErr(null);
    const seq = ++seqRef.current;
    try {
      // 1) attribute speakers (best-effort; falls back to one "Conversation" turn)
      let labeled = raw;
      try {
        const dr = await fetch("/api/transcript/dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: raw }),
        });
        if (dr.ok) {
          const dlg = (await dr.json()) as DialogueResult;
          if (seq === seqRef.current) setTurns(dlg.turns);
          if (dlg.turns.length && !(dlg.turns.length === 1 && dlg.turns[0].speaker === "Conversation")) {
            labeled = dlg.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
          }
        }
      } catch { /* keep raw transcript */ }
      if (seq !== seqRef.current) return;

      // 2) digest + distill on the labeled transcript
      const digestReq = fetch("/api/transcript/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript: labeled, mode: "final", dnaContext: dnaContextOf(client) }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const distillReq = fetch("/api/transcript/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript: labeled, rmName: consent?.rmName ?? profile.name, clientContact: client.name }),
      }).then(async (r) => { if (!r.ok) throw new Error(`distill failed (${r.status})`); return (await r.json()) as DistillResult; });

      const [d, data] = await Promise.all([digestReq, distillReq]);
      if (seq !== seqRef.current) return;
      if (d) setDigest(d);
      setResult(data);
      setNoteText(data.note.text);
      const init: Record<string, boolean> = {};
      data.dnaDeltas.values.forEach((v) => (init[`v:${v}`] = true));
      data.dnaDeltas.dislikes.forEach((dd) => (init[`d:${dd}`] = true));
      data.dnaDeltas.affinities.forEach((a) => (init[`a:${a.theme}`] = true));
      setAccepted(init);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  // Distill-only path for the manual-notes tab (no recording, no digest).
  async function finalizeManual() {
    const transcript = manualText.trim();
    if (!transcript) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/transcript/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, transcript, rmName: profile.name, clientContact: client.name }),
      });
      if (!res.ok) throw new Error(`distill failed (${res.status})`);
      const data = (await res.json()) as DistillResult;
      setResult(data);
      setNoteText(data.note.text);
      const init: Record<string, boolean> = {};
      data.dnaDeltas.values.forEach((v) => (init[`v:${v}`] = true));
      data.dnaDeltas.dislikes.forEach((dd) => (init[`d:${dd}`] = true));
      data.dnaDeltas.affinities.forEach((a) => (init[`a:${a.theme}`] = true));
      setAccepted(init);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  // Switch tabs and clear the shared insight state so one tab's result never
  // bleeds into the other.
  function switchTab(t: "voice" | "manual") {
    setTab(t);
    setResult(null); setAccepted({}); setNoteText(""); setErr(null); setDigest(null); setTurns(null);
  }

  function approve(medium?: string) {
    if (!result) return;
    const deltas = {
      values: result.dnaDeltas.values.filter((v) => accepted[`v:${v}`]),
      dislikes: result.dnaDeltas.dislikes.filter((d) => accepted[`d:${d}`]),
      affinities: result.dnaDeltas.affinities.filter((a: AffinityDelta) => accepted[`a:${a.theme}`]),
    };
    commit(client.id, deltas, { ...result.note, text: noteText, medium: medium ?? result.note.medium }, result.receipts);
    setPhase("consent"); setConsent(null); setResult(null); rec.stop(); rec.reset();
    setDigest(null); setTurns(null); lastWordsRef.current = 0; lastAtRef.current = 0; setManualText("");
  }

  return (
    <section className="conv-capture" style={{ border: "1px solid var(--border)", borderRadius: 2, padding: 16, marginTop: 16 }}>
      <h3>🎙️ Conversation Capture — {client.name}</h3>

      <div className="conv-tabs">
        <button className={`conv-tab${tab === "voice" ? " on" : ""}`} onClick={() => switchTab("voice")} disabled={tab === "voice"}>🎙️ Voice (consented)</button>
        <button className={`conv-tab${tab === "manual" ? " on" : ""}`} onClick={() => switchTab("manual")} disabled={tab === "manual"}>📝 Manual notes</button>
      </div>

      {tab === "manual" && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>No recording — type your notes. (Use Voice if the client consented to recording.)</p>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={6}
            style={{ width: "100%" }}
            placeholder="Type your notes from the meeting…"
          />
          {!result && (
            <button className="conv-btn primary" style={{ marginTop: 8 }} onClick={finalizeManual} disabled={busy || !manualText.trim()}>{busy ? "Analyzing…" : "Generate insights"}</button>
          )}
          {err && <p style={{ color: "var(--red)" }}>{err}</p>}
          {result && (
            <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 2, padding: 12 }}>
              <DnaProposal result={result} client={client} noteText={noteText} setNoteText={setNoteText} accepted={accepted} setAccepted={setAccepted} onApprove={() => approve("Manual note")} />
            </div>
          )}
        </div>
      )}

      {tab === "voice" && phase === "consent" && (
        <div>
          <p>Recording requires the client's consent. Confirm how consent was given:</p>
          <button className="conv-btn" onClick={() => giveConsent("verbal")}>Client consented verbally</button>{" "}
          <button className="conv-btn" onClick={() => giveConsent("written")}>Client consented in writing</button>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>No consent to record? Use the <strong>Manual notes</strong> tab.</p>
        </div>
      )}

      {tab === "voice" && phase === "record" && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            ✓ Consent ({consent?.method}) recorded {consent?.timestamp}
          </p>
          {!rec.supported && <p style={{ color: "var(--amber)" }}>Live mic needs Chrome. Paste a transcript below instead.</p>}
          <div>
            {!rec.recording
              ? <button className="conv-btn primary" onClick={rec.start} disabled={!rec.supported}>● Record</button>
              : <button className="conv-btn" onClick={handleStop}>■ Stop</button>}
          </div>
          <textarea
            value={rec.transcript + (rec.interim ? " " + rec.interim : "")}
            onChange={(e) => rec.setTranscript(e.target.value)}
            readOnly={rec.recording}
            rows={6}
            style={{ width: "100%", marginTop: 8 }}
            placeholder="Live transcript appears here… (or paste one)"
          />
          {rec.error && <p style={{ color: "var(--red)" }}>{rec.error}</p>}
          {!rec.recording && rec.transcript.trim() && !result && (
            <button className="conv-btn primary" style={{ marginTop: 8 }} onClick={finalize} disabled={busy}>{busy ? "Analyzing…" : "Generate insights"}</button>
          )}
          {err && <p style={{ color: "var(--red)" }}>{err}</p>}

          {(digest || result || turns) && (
            <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 2, padding: 12 }}>
              {turns && turns.length > 0 && <DialogueView turns={turns} />}
              {digest && <DigestView d={digest} />}
              {result && (
                <div style={{ marginTop: digest ? 12 : 0 }}>
                  <DnaProposal result={result} client={client} noteText={noteText} setNoteText={setNoteText} accepted={accepted} setAccepted={setAccepted} onApprove={() => approve()} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DnaProposal({
  result, client, noteText, setNoteText, accepted, setAccepted, onApprove,
}: {
  result: DistillResult;
  client: Client;
  noteText: string;
  setNoteText: (t: string) => void;
  accepted: Record<string, boolean>;
  setAccepted: Dispatch<SetStateAction<Record<string, boolean>>>;
  onApprove: () => void;
}) {
  const empty =
    result.dnaDeltas.values.length === 0 &&
    result.dnaDeltas.dislikes.length === 0 &&
    result.dnaDeltas.affinities.length === 0;
  return (
    <div>
      <label><strong>CRM note</strong></label>
      <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} style={{ width: "100%" }} />

      <h4 style={{ marginBottom: 4 }}>Proposed DNA changes (uncheck to reject)</h4>
      {empty ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No DNA changes proposed for this conversation.</p>
      ) : (
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
      )}

      {result.receipts.length > 0 && (
        <>
          <h4 style={{ marginBottom: 4 }}>Quote receipts</h4>
          <ul>
            {result.receipts.map((r, i) => (
              <li key={r.sourceId + ":" + i} style={{ fontSize: 13, opacity: 0.85 }}>"{r.quote}" <span style={{ opacity: 0.6 }}>— {r.sourceId}</span></li>
            ))}
          </ul>
        </>
      )}

      <button className="conv-btn primary" onClick={onApprove}>✓ Approve &amp; merge</button>
    </div>
  );
}

function DialogueView({ turns }: { turns: DialogueResult["turns"] }) {
  if (turns.length === 1 && turns[0].speaker === "Conversation") {
    return (
      <div className="conv-dialogue">
        <div className="conv-dialogue-label">Transcript</div>
        <p style={{ margin: "4px 0", fontSize: 13 }}>{turns[0].text}</p>
      </div>
    );
  }
  return (
    <div className="conv-dialogue">
      <div className="conv-dialogue-label">Dialogue · AI-inferred speakers</div>
      {turns.map((t, i) => (
        <div key={i} className={`conv-turn ${t.speaker === "RM" ? "rm" : "client"}`}>
          <span className="conv-turn-who">{t.speaker}</span>{t.text}
        </div>
      ))}
    </div>
  );
}

function modelBadge(model: string): string {
  if (model === "heuristic") return "heuristic";
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

function DigestView({ d }: { d: DigestResult }) {
  return (
    <div style={{ marginTop: 8, padding: 10, background: "var(--panel-2)", border: "1px solid var(--border-soft)", borderRadius: 2 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        🧠 Digest · {d.mode === "final" ? "final" : "live"} ·{" "}
        <span className="conv-badge">{modelBadge(d.model)}</span>
      </div>
      {d.summary && <p style={{ margin: "6px 0" }}>{d.summary}</p>}
      {d.bullets.length > 0 && (
        <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
          {d.bullets.map((b, i) => <li key={i} style={{ fontSize: 13 }}>{b}</li>)}
        </ul>
      )}
      {d.topics.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>Topics: {d.topics.join(", ")}</div>
      )}
      {d.historyLinks && d.historyLinks.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 4 }}>
          ↩ Connects to history:
          <ul style={{ margin: "2px 0", paddingLeft: 18 }}>
            {d.historyLinks.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
