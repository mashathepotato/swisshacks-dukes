import { useMemo, useState } from "react";
import type { Client, FeedbackDecision, PreferenceModel, Voice } from "../types";
import { THEME_BY_ID } from "../data/themes";
import { scoreColor, SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
import { REASON_META, EVIDENCE_META, buildReasoningChain, buildDraftEmail } from "../lib/explain";
import { adjustConfidence, primaryTheme } from "../lib/learning";
import { PERSONA_PLAY } from "../lib/portfolio";
import { useLearning } from "../lib/learningStore";
import { ValueRadar } from "./ValueRadar";
import { ComplianceDesk } from "./ComplianceDesk";

interface Props {
  client: Client | null;
  onSimulate?: (client: Client) => void;
}

const DECISION_META: Record<FeedbackDecision, { label: string; color: string }> = {
  accepted: { label: "Accepted", color: "var(--green)" },
  tweaked: { label: "Tweaked", color: "var(--amber)" },
  declined: { label: "Declined", color: "var(--red)" },
};

export function ClientDetail({ client, onSimulate }: Props) {
  if (!client) {
    return (
      <div className="drawer">
        <p className="empty">Select a client to see their DNA, the reasoning chain behind their priority, what the copilot has learned from your feedback, and a ready-to-send message.</p>
      </div>
    );
  }

  return (
    <div className="drawer">
      <h2>{client.name}</h2>
      <div className="archetype">{client.archetype}</div>

      <span
        className="score-pill"
        style={{ background: scoreColor(client.priorityScore) + "22", color: scoreColor(client.priorityScore) }}
      >
        <span className="n">{client.priorityScore}</span>
        <span className="d">/100 priority</span>
      </span>

      {client.amountAtStake != null && (
        <div className="stake-line">
          <b>{formatMoney(client.amountAtStake)}</b> at stake
          {client.lastMessageAt
            ? <> · <span className="ago">messaged {relativeTime(client.lastMessageAt)}</span></>
            : client.signals[0]
            ? <> · <span className="ago">news {relativeTime(client.signals[0].publishedAt)}</span></>
            : null}
        </div>
      )}

      <ReasoningChain key={"reason-" + client.id} client={client} />

      <div className="section-title">Value vector</div>
      <ValueRadar client={client} />
      <div className="chips" style={{ marginTop: 4 }}>
        {client.affinities
          .filter((a) => a.weight > 0)
          .sort((a, b) => b.weight - a.weight)
          .map((a) => {
            const t = THEME_BY_ID[a.theme];
            return (
              <span key={a.theme} className="chip theme" style={{ background: t.color }}>
                {t.emoji} {t.label} · {Math.round(a.weight * 100)}
              </span>
            );
          })}
      </div>

      <div className="kv"><span className="k">Mandate</span><span>{client.mandate}</span></div>
      <div className="kv"><span className="k">Risk</span><span>{client.riskProfile}</span></div>
      <div className="kv"><span className="k">Tenure</span><span>{client.tenureYears} yrs</span></div>
      <div className="kv"><span className="k">Style</span><span>{client.commStyle}</span></div>

      {client.values.length > 0 && (
        <>
          <div className="section-title">Client DNA</div>
          <div className="chips">
            {client.values.map((v) => <span key={v} className="chip">✓ {v}</span>)}
            {client.dislikes.map((v) => <span key={v} className="chip" style={{ color: "#f0a0a0" }}>✕ {v}</span>)}
          </div>
        </>
      )}

      {client.signals.length > 0 && (
        <>
          <div className="section-title">Why now — signals</div>
          {client.signals.map((s) => {
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

      <LearningPanel client={client} />

      <Recommendations key={"rec-" + client.id} client={client} />

      {PERSONA_PLAY[client.id] && <ComplianceDesk key={"cdesk-" + client.id} client={client} />}

      <DraftMessage key={"draft-" + client.id} client={client} />

      {onSimulate && (
        <button
          onClick={() => onSimulate(client)}
          style={{
            marginTop: 12, width: "100%", background: "transparent", color: "var(--text-dim)",
            border: "1px solid var(--border)", borderRadius: 9, padding: "11px", fontWeight: 600, fontSize: 13,
          }}
        >
          Rehearse this proposal with {client.name} →
        </button>
      )}
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
      <div className="section-title" style={{ marginTop: 16 }}>
        Why this priority — reasoning chain
      </div>
      <p className="thread-intro">
        How a combination of factors and a sequence of events led to this ranking. Expand any step to see the
        direct evidence behind it.
      </p>
      <div className="thread">
        {chain.map((step, i) => {
          const meta = REASON_META[step.kind];
          const ev = step.evidence ?? [];
          const isOpen = open === i;
          return (
            <div className="rstep" key={i}>
              <div className="rstep-rail">
                <span className="rstep-node" style={{ background: meta.color + "22", color: meta.color, borderColor: meta.color }}>
                  {meta.icon}
                </span>
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
                                <span className="kindtag" style={{ background: em.color }}>{em.icon} {em.label}</span>
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
      <div className="section-title">
        Learning from your feedback <span className="learn-tag">RLHF</span>
      </div>

      {model.sampleSize === 0 ? (
        <div className="card">
          <p>No feedback logged yet for {client.name}. As you accept, tweak or decline recommendations below, the copilot tunes future confidence, value weights and tone for this relationship.</p>
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
                    <span className="lrow-name">{meta.emoji} {meta.label}</span>
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
      <div className="section-title">Recommendations</div>
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
function DraftMessage({ client }: { client: Client }) {
  const { record, modelFor } = useLearning();
  const model: PreferenceModel = modelFor(client);
  const draft = useMemo(() => buildDraftEmail(client), [client]);
  const theme = primaryTheme(client);

  // remounted per client (keyed in the parent); initial tone = learned preference
  const [voice, setVoice] = useState<Voice>(model.preferredVoice ?? "values-led");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const body = draft.body[voice];
  const mailto = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(body)}`;

  function copy() {
    navigator.clipboard?.writeText(`Subject: ${draft.subject}\n\n${body}`).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  function send() {
    if (theme) record({ clientId: client.id, theme, decision: "accepted", summary: `Sent: ${draft.subject}`, voice });
    setSent(true);
  }

  const learnedThisVoice = model.preferredVoice === voice && model.voiceRates[voice].n > 0;

  return (
    <>
      <div className="section-title">Proposed message · next step</div>
      <div className="draft">
        <div className="draft-voices">
          <button className={"voice" + (voice === "values-led" ? " on" : "")} onClick={() => setVoice("values-led")}>
            Values-led
          </button>
          <button className={"voice" + (voice === "data-driven" ? " on" : "")} onClick={() => setVoice("data-driven")}>
            Data-driven
          </button>
        </div>
        {learnedThisVoice && (
          <p className="draft-learned">★ Pre-selected — {client.name} accepts this tone most often.</p>
        )}
        <div className="draft-subject">
          <span className="k">Subject</span> {draft.subject}
        </div>
        <textarea className="draft-body" value={body} readOnly rows={Math.min(14, body.split("\n").length + 2)} />
        <div className="draft-actions">
          <a className="draft-send" href={mailto} onClick={send}>✉️ Send to {client.name}</a>
          <button className="draft-copy" onClick={copy}>{copied ? "✓ Copied" : "Copy draft"}</button>
        </div>
        {sent ? (
          <p className="draft-note" style={{ color: "var(--green)" }}>✓ Logged as accepted ({voice}) — the copilot will favour this tone next time.</p>
        ) : (
          <p className="draft-note">AI drafts only — you review and approve before anything is sent.</p>
        )}
      </div>
    </>
  );
}
