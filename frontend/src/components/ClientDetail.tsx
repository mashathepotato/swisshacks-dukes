import { useMemo, useState } from "react";
import type { Client, Voice } from "../types";
import { THEME_BY_ID } from "../data/themes";
import { scoreColor, SIGNAL_META, formatMoney, relativeTime } from "../lib/format";
import { REASON_META, buildReasoningChain, buildDraftEmail } from "../lib/explain";
import { ValueRadar } from "./ValueRadar";

interface Props {
  client: Client | null;
  onSimulate?: (client: Client) => void;
}

export function ClientDetail({ client, onSimulate }: Props) {
  if (!client) {
    return (
      <div className="drawer">
        <p className="empty">Select a client to see their DNA, the reasoning chain behind their priority, and a ready-to-send message.</p>
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

      <ReasoningChain client={client} />

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

      {client.recommendations.length > 0 && (
        <>
          <div className="section-title">Recommendations</div>
          {client.recommendations.map((r) => (
            <div className="card" key={r.id}>
              <h4>{r.action}</h4>
              <p>{r.rationale}</p>
              <ul className="evidence">
                {r.evidence.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              <p style={{ marginTop: 8, color: "var(--accent)" }}>Confidence {Math.round(r.confidence * 100)}%</p>
            </div>
          ))}
        </>
      )}

      <DraftMessage client={client} />

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
  if (!chain.length) return null;

  return (
    <>
      <div className="section-title" style={{ marginTop: 16 }}>
        Why this priority — reasoning chain
      </div>
      <p className="thread-intro">
        How a combination of factors and a sequence of events led to this ranking:
      </p>
      <div className="thread">
        {chain.map((step, i) => {
          const meta = REASON_META[step.kind];
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
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The actionable next step: a proposed client message the RM can edit and send. */
function DraftMessage({ client }: { client: Client }) {
  const draft = useMemo(() => buildDraftEmail(client), [client]);
  const [voice, setVoice] = useState<Voice>("values-led");
  const [copied, setCopied] = useState(false);

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
        <div className="draft-subject">
          <span className="k">Subject</span> {draft.subject}
        </div>
        <textarea className="draft-body" value={body} readOnly rows={Math.min(14, body.split("\n").length + 2)} />
        <div className="draft-actions">
          <a className="draft-send" href={mailto}>✉️ Send to {client.name}</a>
          <button className="draft-copy" onClick={copy}>{copied ? "✓ Copied" : "Copy draft"}</button>
        </div>
        <p className="draft-note">AI drafts only — you review and approve before anything is sent.</p>
      </div>
    </>
  );
}
