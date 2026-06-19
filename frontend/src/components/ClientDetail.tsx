import type { Client } from "../types";
import { THEME_BY_ID } from "../data/themes";
import { scoreColor, SIGNAL_META } from "../lib/format";
import { ValueRadar } from "./ValueRadar";

interface Props {
  client: Client | null;
  onSimulate?: (client: Client) => void;
}

export function ClientDetail({ client, onSimulate }: Props) {
  if (!client) {
    return (
      <div className="drawer">
        <p className="empty">Select a client to see their DNA, signals, and recommendations.</p>
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

      {onSimulate && (
        <button
          onClick={() => onSimulate(client)}
          style={{
            marginTop: 16, width: "100%", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 9, padding: "11px", fontWeight: 700, fontSize: 13.5,
          }}
        >
          Rehearse a proposal with {client.name} →
        </button>
      )}
    </div>
  );
}
