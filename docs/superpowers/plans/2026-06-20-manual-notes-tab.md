# Manual Notes Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a `Manual notes` tab (no consent needed) alongside the default `Voice (consented)` tab in `ConversationCapture`; typed notes run through distill (DNA proposal) and commit as a "Manual note".

**Architecture:** Frontend-only change to `frontend/src/components/ConversationCapture.tsx`. Extract the proposed-DNA-changes UI into a shared `DnaProposal` component, add a `tab` state + tab bar, add a manual notes textarea + `finalizeManual()` (distill-only), and a shared approve that labels manual notes' `medium`.

**Tech Stack:** React 19 + TS. No backend change (reuses `POST /api/transcript/distill`).

---

### Task 1: Extract `DnaProposal` and add the manual-notes tab

**Files:**
- Modify: `frontend/src/components/ConversationCapture.tsx`

- [ ] **Step 1: Add tab + manual state**

In the component, add:
```tsx
  const [tab, setTab] = useState<"voice" | "manual">("voice");
  const [manualText, setManualText] = useState("");
```

- [ ] **Step 2: Extract `DnaProposal` sub-component**

Move the proposed-DNA-changes block (note editor + delta checkboxes + receipts + Approve) out of the inline JSX into a new sub-component at the end of the file:
```tsx
function DnaProposal({
  result, client, noteText, setNoteText, accepted, setAccepted, onApprove,
}: {
  result: DistillResult;
  client: Client;
  noteText: string;
  setNoteText: (t: string) => void;
  accepted: Record<string, boolean>;
  setAccepted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
      <button onClick={onApprove}>✓ Approve &amp; merge</button>
    </div>
  );
}
```
Then in the voice combined panel, replace the inline DNA block with `<DnaProposal result={result} client={client} noteText={noteText} setNoteText={setNoteText} accepted={accepted} setAccepted={setAccepted} onApprove={() => approve()} />`.

- [ ] **Step 3: Generalize `approve` for medium + reset both modes**

Change `approve` to accept an optional medium and reset manual state too:
```tsx
  function approve(medium?: string) {
    if (!result) return;
    const deltas = {
      values: result.dnaDeltas.values.filter((v) => accepted[`v:${v}`]),
      dislikes: result.dnaDeltas.dislikes.filter((d) => accepted[`d:${d}`]),
      affinities: result.dnaDeltas.affinities.filter((a: AffinityDelta) => accepted[`a:${a.theme}`]),
    };
    commit(client.id, deltas, { ...result.note, text: noteText, medium: medium ?? result.note.medium }, result.receipts);
    setPhase("consent"); setConsent(null); setResult(null); rec.stop(); rec.reset();
    setDigest(null); lastWordsRef.current = 0; lastAtRef.current = 0; setManualText("");
  }
```

- [ ] **Step 4: Add `finalizeManual` (distill-only)**

```tsx
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
```

- [ ] **Step 5: Add the tab bar + manual tab JSX**

Right after the `<h3>` title, add a tab bar:
```tsx
      <div style={{ display: "flex", gap: 8, margin: "8px 0 12px" }}>
        <button onClick={() => setTab("voice")} disabled={tab === "voice"}>🎙️ Voice (consented)</button>
        <button onClick={() => setTab("manual")} disabled={tab === "manual"}>📝 Manual notes</button>
      </div>
```
Wrap the existing consent + record content so it only shows when `tab === "voice"`. Add a manual block shown when `tab === "manual"`:
```tsx
      {tab === "manual" && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>No recording — type your notes. (Use Voice if the client consented to recording.)</p>
          <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={6} style={{ width: "100%" }} placeholder="Type your notes from the meeting…" />
          {!result && (
            <button onClick={finalizeManual} disabled={busy || !manualText.trim()}>{busy ? "Analyzing…" : "Generate insights"}</button>
          )}
          {err && <p style={{ color: "var(--red, #e53e3e)" }}>{err}</p>}
          {result && (
            <div style={{ marginTop: 12, border: "1px solid var(--border, #2a3142)", borderRadius: 6, padding: 12 }}>
              <DnaProposal result={result} client={client} noteText={noteText} setNoteText={setNoteText} accepted={accepted} setAccepted={setAccepted} onApprove={() => approve("Manual note")} />
            </div>
          )}
        </div>
      )}
```
Also update the voice combined panel's Approve to call `approve()` (no arg → keeps recorded medium).

Guard the consent gate + record blocks with `tab === "voice"` (e.g. `{tab === "voice" && phase === "consent" && (...)}` and `{tab === "voice" && phase === "record" && (...)}`).

- [ ] **Step 6: Verify**

Run: `cd frontend && npx tsc -b && npm run lint && npm run build && npm run test`
Expected: tsc clean, lint clean (resolve any unused-var/`React` import issues — import `type { Dispatch, SetStateAction }` from react if preferred over `React.Dispatch`), build OK, vitest 8/8.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ConversationCapture.tsx
git commit -m "feat: manual notes tab (no-consent path) sharing the DNA proposal"
```

---

## Self-Review Notes

- **Spec coverage:** two tabs default voice (Step 5), manual distill-only proposing DNA (Step 4), shared `DnaProposal` (Step 2), manual note medium "Manual note" (Steps 3+5), consent only gates voice (Step 5 guards). No backend change.
- **Type consistency:** `DnaProposal` props match the existing `result`/`noteText`/`accepted`/`approve` shapes; `approve(medium?)` is backward compatible (voice calls `approve()`).
- **Lint note:** if `React.Dispatch` triggers a no-undef/import rule, import `{ Dispatch, SetStateAction }` as types and use `Dispatch<SetStateAction<...>>`.
