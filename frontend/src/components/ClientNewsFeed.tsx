import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import { NEWS_FEED } from "../data/newsFeed";
import { THEME_BY_ID } from "../data/themes";
import { scoreColor } from "../lib/format";
import { articlesForClient } from "../lib/newsRelevance";
import type { Relevance } from "../lib/newsRelevance";
import type { Client } from "../types";
import type { FeedArticle } from "../data/newsFeed";
import { ValueSpider } from "./ValueSpider";

function fmtDate(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return d; }
}

const PERSONAS = CLIENTS.filter((c) => c.isPersona);

export function ClientNewsFeed() {
  const [clientId, setClientId] = useState(PERSONAS[0]?.id ?? "");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const client = useMemo(() => CLIENTS.find((c) => c.id === clientId) ?? PERSONAS[0], [clientId]);

  const items = useMemo(() => articlesForClient(NEWS_FEED.articles, client), [client]);
  const peopleTops = useMemo(
    () => PERSONAS.map((c) => ({ c, top: articlesForClient(NEWS_FEED.articles, c, 1)[0] })),
    [],
  );

  // selected story (falls back to the top one when the client changes)
  const selected = items.find((x) => x.article.id === pickedId) ?? items[0] ?? null;

  return (
    <div className="cnews">
      <h1>News by client</h1>
      <p className="lead">Real headlines from the relevance funnel, scored against each client's own value-axes. Click a story to see exactly which of their values it touches.</p>

      <div className="cnews-people">
        {peopleTops.map(({ c, top }) => (
          <button key={c.id} className={"cnews-person" + (c.id === clientId ? " on" : "")} onClick={() => { setClientId(c.id); setPickedId(null); }}>
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

      <div className="cnews-split">
        <div className="cnews-list">
          {items.length ? items.map(({ article, rel }) => (
            <button
              key={article.id}
              className={"cnews-row" + (selected?.article.id === article.id ? " on" : "")}
              onClick={() => setPickedId(article.id)}
            >
              <span className="cnews-score" style={{ background: scoreColor(rel.score) + "22", color: scoreColor(rel.score) }}>{rel.score}</span>
              <span className="cnews-rowwrap">
                <span className="cnews-rowtitle">{article.title}</span>
                <span className="cnews-src">{article.source}{article.date ? ` · ${fmtDate(article.date)}` : ""}</span>
              </span>
            </button>
          )) : (
            <p className="nf-empty">No funnel stories are relevant to {client.name} right now.</p>
          )}
        </div>

        <div className="cnews-detail">
          {selected
            ? <OverlapDetail article={selected.article} rel={selected.rel} client={client} />
            : <div className="cnews-empty">Select a story to see why it matters to {client.name}.</div>}
        </div>
      </div>
    </div>
  );
}

function OverlapDetail({ article, rel, client }: { article: FeedArticle; rel: Relevance; client: Client }) {
  const v = article.stage2;
  // the client's value-axes, annotated with this article's overlap
  const axes = client.affinities.map((a) => {
    const m = rel.valueMatches.find((x) => x.axis === a.theme);
    const t = THEME_BY_ID[a.theme];
    return { a, t, match: m };
  });

  return (
    <div className="cnews-detail-card">
      <div className="cnews-detail-top">
        <span className="cnews-score lg" style={{ background: scoreColor(rel.score) + "22", color: scoreColor(rel.score) }}>{rel.score}</span>
        <div className="cnews-headwrap">
          <a className="cnews-title" href={article.url} target="_blank" rel="noopener">{article.title}</a>
          <div className="cnews-src">{article.source}{article.date ? ` · ${fmtDate(article.date)}` : ""}</div>
        </div>
      </div>

      <div className="nf-chips" style={{ marginTop: 8 }}>
        {v?.marketMovement && <span className="nf-theme mkt">market-movement</span>}
        {(v?.themes ?? []).filter((t) => t !== "market-movement").map((t) => <span key={t} className="nf-theme">{t}</span>)}
      </div>

      <div className="cnews-overlap">
        <ValueSpider values={article.values} size={230} />
        <p className="cnews-overlap-cap">The story's implicated value-axes (blue). {client.name}'s own values are bordered below.</p>
      </div>

      <div className="cnews-sec">Overlap with {client.name}'s values</div>
      <div className="cnews-axes">
        {axes.map(({ a, t, match }) => (
          <div className={"cnews-axis" + (match ? " hit" : "")} key={a.theme}>
            <span className="cnews-axis-name"><span className="dot" style={{ background: t.color }} />{t.emoji} {t.label}{a.polarity === -1 ? " ⊘" : ""}</span>
            {match ? (
              <span className="cnews-axis-math">
                story {Math.round(match.articleScore * 100)}% × value {Math.round(a.weight * 100)}% → <b>{match.contribution.toFixed(2)}</b>
              </span>
            ) : (
              <span className="cnews-axis-math none">not touched by this story</span>
            )}
          </div>
        ))}
        {rel.valueScore > 0 && (
          <div className="cnews-axis total">
            <span className="cnews-axis-name">Value overlap</span>
            <span className="cnews-axis-math"><b>{rel.valueScore.toFixed(2)}</b></span>
          </div>
        )}
      </div>

      {(rel.holdingMatches.length > 0 || rel.mandateMatch) && (
        <>
          <div className="cnews-sec">Portfolio</div>
          {rel.holdingMatches.map((h) => (
            <div className="cnews-bit hold" key={h.isin}>📌 Holds {h.issuer} ({h.isin})</div>
          ))}
          {rel.mandateMatch && <div className="cnews-bit">🗂 {client.mandate} mandate holds an affected instrument</div>}
        </>
      )}

      <p className="cnews-summary">{rel.summary}</p>
    </div>
  );
}
