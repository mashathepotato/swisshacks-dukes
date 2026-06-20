import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import { NEWS_FEED } from "../data/newsFeed";
import { THEME_BY_ID } from "../data/themes";
import { scoreColor } from "../lib/format";
import { articlesForClient } from "../lib/newsRelevance";

function fmtDate(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return d; }
}

const PERSONAS = CLIENTS.filter((c) => c.isPersona);

export function ClientNewsFeed() {
  const [clientId, setClientId] = useState(PERSONAS[0]?.id ?? "");
  const client = useMemo(() => CLIENTS.find((c) => c.id === clientId) ?? PERSONAS[0], [clientId]);

  const items = useMemo(() => articlesForClient(NEWS_FEED.articles, client), [client]);
  const peopleTops = useMemo(
    () => PERSONAS.map((c) => ({ c, top: articlesForClient(NEWS_FEED.articles, c, 1)[0] })),
    [],
  );

  return (
    <div className="cnews">
      <h1>News by client</h1>
      <p className="lead">Real headlines from the relevance funnel, scored against each client's own value-axes — the relevance is the overlap, shown component by component, so it's fully traceable.</p>

      <div className="cnews-people">
        {peopleTops.map(({ c, top }) => (
          <button key={c.id} className={"cnews-person" + (c.id === clientId ? " on" : "")} onClick={() => setClientId(c.id)}>
            <span className="nm">{c.name}</span>
            <span className="md">{c.mandate}{top ? ` · top ${top.rel.score}` : ""}</span>
          </button>
        ))}
      </div>

      <div className="cnews-values">
        <span className="lbl">{client.name}'s values</span>
        {client.affinities.map((a) => {
          const t = THEME_BY_ID[a.theme];
          return (
            <span key={a.theme} className="chip theme" style={{ background: t.color }}>
              {t.emoji} {t.label} · {Math.round(a.weight * 100)}{a.polarity === -1 ? " ⊘" : ""}
            </span>
          );
        })}
      </div>

      <div className="cnews-list">
        {items.length ? items.map(({ article, rel }) => (
          <div className="cnews-card" key={article.id}>
            <div className="cnews-top">
              <span className="cnews-score" style={{ background: scoreColor(rel.score) + "22", color: scoreColor(rel.score) }}>{rel.score}</span>
              <div className="cnews-headwrap">
                <a className="cnews-title" href={article.url} target="_blank" rel="noopener">{article.title}</a>
                <div className="cnews-src">{article.source}{article.date ? ` · ${fmtDate(article.date)}` : ""}</div>
              </div>
            </div>

            <div className="cnews-why">
              {rel.holdingMatches.length > 0 && (
                <div className="cnews-bit hold">📌 Holds {rel.holdingMatches.map((h) => `${h.issuer} (${h.isin})`).join(", ")}</div>
              )}
              {rel.mandateMatch && (
                <div className="cnews-bit">🗂 {client.mandate} mandate holds an affected instrument</div>
              )}
              {rel.valueMatches.map((m) => (
                <div className="cnews-bit val" key={m.axis}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.emoji} {m.label}: story {Math.round(m.articleScore * 100)}% × {client.name} {Math.round(m.clientWeight * 100)}%
                  {m.polarity === -1 ? " (guards against)" : ""} → <b>{m.contribution.toFixed(2)}</b>
                </div>
              ))}
              {!rel.holdingMatches.length && !rel.mandateMatch && !rel.valueMatches.length && (
                <div className="cnews-bit">Broad / market-level signal.</div>
              )}
            </div>
          </div>
        )) : (
          <p className="nf-empty">No funnel stories are relevant to {client.name} right now.</p>
        )}
      </div>
    </div>
  );
}
