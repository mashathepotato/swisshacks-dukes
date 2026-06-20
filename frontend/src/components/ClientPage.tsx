import { useMemo, useState } from "react";
import type { Client, FeedbackDecision, PreferenceModel, Voice } from "../types";
import { THEME_BY_ID } from "../data/themes";
import { SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
import { REASON_META, EVIDENCE_META, buildReasoningChain } from "../lib/explain";
import { adjustConfidence, primaryTheme } from "../lib/learning";
import { PORTFOLIOS } from "../data/portfolio";
import { buildMessage, CHANNEL_META, LENGTH_META } from "../lib/commPrefs";
import type { CommChannel, CommLength } from "../lib/commPrefs";
import { useLearning } from "../lib/learningStore";
import { useDone } from "../lib/doneStore";
import { useCommPrefs } from "../lib/commPrefStore";
import { useRmProfile } from "../lib/rmProfileStore";
import { ValueRadar } from "./ValueRadar";
import { PriorityScore } from "./PriorityScore";
import { ConversationCapture } from "./ConversationCapture";
import { useConversation } from "../lib/conversationStore";

interface Props {
  client: Client;
  onSimulate?: (client: Client) => void;
}

const DECISION_META: Record<FeedbackDecision, { label: string; color: string }> = {
  accepted: { label: "Accepted", color: "var(--green)" },
  tweaked: { label: "Tweaked", color: "var(--amber)" },
  declined: { label: "Declined", color: "var(--red)" },
};

export function ClientPage({ client, onSimulate }: Props) {
  const { isDone, markDone, reopen } = useDone();
  const { withDeltas } = useConversation();
  const mergedClient = withDeltas(client);
  const dealt = isDone(mergedClient.id);
  const [chainOpen, setChainOpen] = useState(false);

  const portfolioValue = PORTFOLIOS[mergedClient.mandate].reduce((s, h) => s + h.currentCHF, 0);

  return (
    <div className="clientpage">
      <div className="clientpage-inner">
        <div className="cp-head">
          <div className="cp-head-main">
            <h1>{mergedClient.name}</h1>
            <div className="archetype">{mergedClient.archetype}</div>

            <div className="cp-pval">
              <b>{formatMoney(portfolioValue)}</b> portfolio value · {mergedClient.mandate} mandate
            </div>

            {mergedClient.values.length > 0 && (
              <>
                <div className="section-title">Client DNA</div>
                <div className="chips">
                  {mergedClient.values.map((v) => <span key={v} className="chip">✓ {v}</span>)}
                  {mergedClient.dislikes.map((v) => <span key={v} className="chip" style={{ color: "var(--red)" }}>✕ {v}</span>)}
                </div>
              </>
            )}

            <div className="section-title">Specific requests</div>
            <div className="cp-requests">
              <div className="kv"><span className="k">Comm style</span><span>{mergedClient.commStyle}</span></div>
              <div className="kv"><span className="k">Risk</span><span>{mergedClient.riskProfile}</span></div>
              <div className="kv"><span className="k">Tenure</span><span>{mergedClient.tenureYears} yrs</span></div>
              {mergedClient.lastMessageAt && (
                <div className="kv"><span className="k">Last contact</span><span>{relativeTime(mergedClient.lastMessageAt)}</span></div>
              )}
            </div>
          </div>

          <div className="cp-head-radar">
            <ValueRadar client={mergedClient} />
          </div>
        </div>

        <button
          className={"markdone" + (dealt ? " on" : "")}
          style={{ maxWidth: 320 }}
          onClick={() => (dealt ? reopen(mergedClient.id) : markDone(mergedClient.id))}
        >
          {dealt ? "✓ Completed — reopen" : "✓ Mark as complete"}
        </button>

        <div className="cp-grid">
          {/* Left: the priority story — score → what happened → (why) → suggested action → next step */}
          <div className="cp-col">
            <PriorityScore client={mergedClient} />

            {mergedClient.signals.length > 0 && (
              <>
                <div className="section-title">What happened</div>
                {mergedClient.signals.map((s) => {
                  const meta = SIGNAL_META[s.type];
                  return (
                    <div className="card" key={s.id}>
                      <span
                        className="badge"
                        style={{ background: meta.color + "22", color: meta.color, fontSize: 10, padding: "2px 7px", borderRadius: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}
                      >
                        {meta.label} · sev {s.severity}
                      </span>
                      <h4 style={{ marginTop: 6 }}>{s.headline}</h4>
                      <p>{s.summary}</p>
                      <p style={{ marginTop: 6, color: "var(--text-faint)" }}>{s.source} · {s.publishedAt}</p>
                    </div>
                  );
                })}
              </>
            )}

            <button
              className={"flow-arrow" + (chainOpen ? " open" : "")}
              onClick={() => setChainOpen((o) => !o)}
              aria-expanded={chainOpen}
            >
              <span className="flow-arrow-glyph">↓</span>
              <span className="flow-arrow-label">
                {chainOpen ? "Hide the reasoning" : "Why this leads to the action — see the full thought process"}
              </span>
            </button>

            {chainOpen && <ReasoningChain key={"reason-" + mergedClient.id} client={mergedClient} />}

            <Recommendations key={"rec-" + mergedClient.id} client={mergedClient} />

            <DraftMessage key={"draft-" + mergedClient.id} client={mergedClient} />

            {onSimulate && (
              <button className="cp-rehearse" style={{ width: "100%", marginTop: 14, textAlign: "center" }} onClick={() => onSimulate(mergedClient)}>
                Rehearse a proposal →
              </button>
            )}
          </div>

          {/* Right: general info + tools for the relationship */}
          <div className="cp-col">
            <LearningPanel client={mergedClient} />

            <ConversationCapture client={mergedClient} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The "Glass Thread": the deterministic sequence of factors behind the priority. */
function ReasoningChain({ client }: { client: Client }) {
  const chain = useMemo(() => buildReasoningChain(client), [client]);
  const [open, setOpen] = useState<number | null>(null);
  if (!chain.length) return null;

  return (
    <>
      <div className="thread" style={{ marginTop: 16 }}>
        {chain.map((step, i) => {
          const meta = REASON_META[step.kind];
          const ev = step.evidence ?? [];
          const isOpen = open === i;
          return (
            <div className="rstep" key={i}>
              <div className="rstep-rail">
                <span className="rstep-node" style={{ background: meta.color + "22", borderColor: meta.color }} />
                {i < chain.length - 1 && <span className="rstep-line" />}
              </div>
              <div className="rstep-body">
                <div className="rstep-kind" style={{ color: meta.color }}>{meta.label}</div>
                <div className="rstep-label">{step.label}</div>
                <div className="rstep-detail">{step.detail}</div>
                {step.source && <div className="rstep-source">{step.source}</div>}
                {ev.length > 0 && (
                  <div className="rstep-evidence">
                    <button className="ev-toggle" onClick={() => setOpen(isOpen ? null : i)}>
                      {isOpen ? "▾ Hide evidence" : `▸ ${ev.length} piece${ev.length > 1 ? "s" : ""} of evidence`}
                    </button>
                    {isOpen && (
                      <div className="receipts">
                        {ev.map((e, j) => {
                          const em = EVIDENCE_META[e.kind];
                          return (
                            <div className="receipt" key={j}>
                              <div className="rcpt-meta">
                                <span className="kindtag" style={{ background: em.color }}>{em.label}</span>
                                <span className="rcpt-src">{e.sourceId}{e.date ? ` · ${e.date}` : ""}</span>
                              </div>
                              <blockquote className="rcpt-quote">“{e.quote}”</blockquote>
                              {e.ref && (
                                e.ref.startsWith("http")
                                  ? <a className="rcpt-ref" href={e.ref} target="_blank" rel="noreferrer">{e.ref}</a>
                                  : <span className="rcpt-ref">{e.ref}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** What the copilot has learned about this client from past RM feedback. */
function LearningPanel({ client }: { client: Client }) {
  const { modelFor } = useLearning();
  const model = modelFor(client);

  return (
    <>
      <div className="section-title">Learning from your feedback</div>

      {model.sampleSize === 0 ? (
        <div className="card">
          <p>No feedback logged yet for {client.name}.</p>
        </div>
      ) : (
        <div className="learn">
          <div className="learn-top">
            <div className="learn-rate">
              <div className="big">{Math.round(model.acceptanceRate * 100)}%</div>
              <div className="lbl">acceptance · {model.sampleSize} decisions</div>
            </div>
            {model.preferredVoice && (
              <div className="learn-voice">
                <div className="lbl">Preferred tone</div>
                <span className="voice-badge">{model.preferredVoice === "values-led" ? "Values-led" : "Data-driven"}</span>
                <div className="sub">{Math.round(model.voiceRates[model.preferredVoice].rate * 100)}% accepted</div>
              </div>
            )}
          </div>

          <div className="learn-sub">Learned value weights (base → now)</div>
          <div className="learn-themes">
            {model.themes
              .filter((t) => t.n > 0 || t.base > 0)
              .map((t) => {
                const meta = THEME_BY_ID[t.theme];
                const up = t.delta > 0.005;
                const down = t.delta < -0.005;
                return (
                  <div className="lrow" key={t.theme}>
                    <span className="lrow-name">{meta.label}</span>
                    <div className="lrow-bar">
                      <span className="lrow-base" style={{ left: `${t.base * 100}%` }} />
                      <span className="lrow-fill" style={{ width: `${t.learned * 100}%`, background: meta.color }} />
                    </div>
                    <span className={"lrow-delta" + (up ? " up" : down ? " down" : "")}>
                      {up ? "▲" : down ? "▼" : "■"} {t.delta >= 0 ? "+" : ""}{Math.round(t.delta * 100)}
                    </span>
                  </div>
                );
              })}
          </div>

          {model.recent.length > 0 && (
            <>
              <div className="learn-sub">Recent decisions</div>
              <div className="learn-recent">
                {model.recent.map((e) => {
                  const dm = DECISION_META[e.decision];
                  return (
                    <span className="rchip" key={e.id} title={`${e.date} · ${e.summary}`} style={{ borderColor: dm.color, color: dm.color }}>
                      {dm.label}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Recommendations with learning-adjusted confidence and an inline feedback loop. */
function Recommendations({ client }: { client: Client }) {
  const { record, modelFor } = useLearning();
  const model = modelFor(client);
  const theme = primaryTheme(client);
  // remounted per client (keyed in the parent), so session decisions reset on switch
  const [decided, setDecided] = useState<Record<string, FeedbackDecision>>({});

  if (client.recommendations.length === 0) return null;

  function give(recId: string, action: string, decision: FeedbackDecision) {
    if (theme) record({ clientId: client.id, theme, decision, summary: action });
    setDecided((d) => ({ ...d, [recId]: decision }));
  }

  return (
    <>
      <div className="section-title">Actions</div>
      {client.recommendations.map((r) => {
        const adj = adjustConfidence(r.confidence, model, theme);
        const base = Math.round(r.confidence * 100);
        const tuned = Math.round(adj.value * 100);
        const moved = adj.delta !== 0;
        const choice = decided[r.id];
        return (
          <div className="card" key={r.id}>
            <h4>{r.action}</h4>
            <p>{r.rationale}</p>
            <ul className="evidence">
              {r.evidence.map((e, i) => <li key={i}>{e}</li>)}
            </ul>

            <div className="conf">
              {moved ? (
                <>
                  <span className="conf-base">{base}%</span>
                  <span className="conf-arrow">→</span>
                  <span className="conf-tuned" style={{ color: adj.delta > 0 ? "var(--green)" : "var(--amber)" }}>
                    {tuned}% {adj.delta > 0 ? "▲" : "▼"} learned
                  </span>
                </>
              ) : (
                <span className="conf-tuned" style={{ color: "var(--accent)" }}>Confidence {base}%</span>
              )}
            </div>
            {moved && (
              <p className="conf-why">
                Tuned from history: {Math.round(adj.accept * 100)}% of {adj.n} similar proposal{adj.n === 1 ? "" : "s"} accepted by {client.name}.
              </p>
            )}

            {choice ? (
              <div className="fb-done" style={{ color: DECISION_META[choice].color }}>
                ✓ Recorded as {DECISION_META[choice].label.toLowerCase()} — model updated.
              </div>
            ) : (
              <div className="fb-row">
                <button className="fb accept" onClick={() => give(r.id, r.action, "accepted")}>Accept</button>
                <button className="fb tweak" onClick={() => give(r.id, r.action, "tweaked")}>Tweak</button>
                <button className="fb decline" onClick={() => give(r.id, r.action, "declined")}>Decline</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** The actionable next step: a proposed client message, defaulted to the learned tone. */
function fmtPref(field: "channel" | "length", val: string): string {
  return field === "channel"
    ? CHANNEL_META[val as CommChannel]?.label ?? val
    : LENGTH_META[val as CommLength]?.label ?? val;
}

function DraftMessage({ client }: { client: Client }) {
  const { record, modelFor } = useLearning();
  const { prefFor, isCustom, setChannel, setLength, historyFor } = useCommPrefs();
  const { profile } = useRmProfile();
  const model: PreferenceModel = modelFor(client);
  const theme = primaryTheme(client);
  const pref = prefFor(client);

  // remounted per client (keyed in the parent); initial tone = learned preference, else RM house tone
  const [voice, setVoice] = useState<Voice>(model.preferredVoice ?? profile.defaultVoice);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const msg = useMemo(
    () => buildMessage(client, pref.channel, pref.length, voice, profile),
    [client, pref.channel, pref.length, voice, profile],
  );
  const history = historyFor(client.id);
  const learnedThisVoice = model.preferredVoice === voice && model.voiceRates[voice].n > 0;
  const channels = Object.keys(CHANNEL_META) as CommChannel[];
  const lengths = Object.keys(LENGTH_META) as CommLength[];

  function copy() {
    const text = (msg.subject ? `Subject: ${msg.subject}\n\n` : "") + msg.body;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  function send() {
    if (theme) record({ clientId: client.id, theme, decision: "accepted", summary: `Sent via ${pref.channel}: ${msg.subject ?? client.name}`, voice });
    setSent(true);
  }

  return (
    <>
      <div className="section-title">Next step</div>
      <div className="draft">
        {/* communication preference: how this client wants to hear from us */}
        <div className="pref-block">
          <div className="pref-row">
            <span className="pref-lbl">Channel</span>
            <div className="pref-opts">
              {channels.map((ch) => (
                <button key={ch} className={"pref-opt" + (pref.channel === ch ? " on" : "")} onClick={() => { setChannel(client, ch); setSent(false); }}>
                  {CHANNEL_META[ch].label}
                </button>
              ))}
            </div>
          </div>
          <div className="pref-row">
            <span className="pref-lbl">Length</span>
            <div className="pref-opts">
              {lengths.map((l) => (
                <button key={l} className={"pref-opt" + (pref.length === l ? " on" : "")} onClick={() => { setLength(client, l); setSent(false); }}>
                  {LENGTH_META[l].label}
                </button>
              ))}
            </div>
          </div>
          <p className="pref-note">
            {isCustom(client.id)
              ? <>Tuned by you — {client.name} set to <b>{CHANNEL_META[pref.channel].label.toLowerCase()}</b>, <b>{pref.length}</b>. The draft below follows it.</>
              : <>On file: {client.name} prefers <b>{CHANNEL_META[pref.channel].label.toLowerCase()}</b>, <b>{pref.length}</b>. The draft below follows it.</>}
          </p>
          {history.length > 0 && (
            <ul className="pref-history">
              {history.slice(0, 3).map((h, i) => (
                <li key={i}>{h.field === "channel" ? "Channel" : "Length"}: {fmtPref(h.field, h.from)} → {fmtPref(h.field, h.to)} · {h.date}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="draft-voices">
          <button className={"voice" + (voice === "values-led" ? " on" : "")} onClick={() => setVoice("values-led")}>
            Values-led
          </button>
          <button className={"voice" + (voice === "data-driven" ? " on" : "")} onClick={() => setVoice("data-driven")}>
            Data-driven
          </button>
        </div>
        {learnedThisVoice && (
          <p className="draft-learned">Pre-selected — {client.name} accepts this tone most often.</p>
        )}

        <div className="draft-format">{msg.format}{msg.subject ? "" : " · spoken / no subject line"}</div>
        {msg.subject && (
          <div className="draft-subject">
            <span className="k">Subject</span> {msg.subject}
          </div>
        )}
        <textarea className="draft-body" value={msg.body} readOnly rows={Math.min(16, msg.body.split("\n").length + 2)} />
        <div className="draft-actions">
          {msg.sendHref ? (
            <a className="draft-send" href={msg.sendHref} onClick={send}>{msg.sendLabel}</a>
          ) : (
            <button className="draft-send" onClick={send}>{msg.sendLabel}</button>
          )}
          <button className="draft-copy" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
        {sent ? (
          <p className="draft-note" style={{ color: "var(--green)" }}>✓ Logged via {CHANNEL_META[pref.channel].label.toLowerCase()} ({voice}) — the copilot will favour this tone next time.</p>
        ) : (
          <p className="draft-note">Drafts only — review before sending.</p>
        )}
      </div>
    </>
  );
}

