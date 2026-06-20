import { useMemo, useState } from "react";
import { CLIENTS } from "../data/clients";
import { NEWS_FEED } from "../data/newsFeed";
import { THEME_BY_ID } from "../data/themes";
import { articlesForClient, RELEVANCE_WEIGHTS } from "../lib/newsRelevance";
import type { Relevance } from "../lib/newsRelevance";
import type { Client } from "../types";
import type { FeedArticle } from "../data/newsFeed";
import { ValueSpider } from "./ValueSpider";
import { FormulaTip } from "./Formula";

const NF = {
  combined: String.raw`\text{score}=0.5\,\text{overlap}+0.3\,\text{sev}+0.2\,\text{rec}`,
  value: String.raw`\text{overlap}=\dfrac{1}{n}\sum_i \text{story}_i\cdot\text{client}_i`,
  severity: String.raw`\text{sev}=0.45\,\mathbb{1}_{\text{mkt}}+0.35\,\tfrac{|s|}{0.5}+0.20\,\tfrac{\#\text{themes}}{2}`,
  recency: String.raw`\text{rec}=0.5^{\,\Delta t_{\text{days}}/7}`,
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

const PERSONAS = CLIENTS.filter((c) => c.isPersona);

export function ClientNewsFeed() {
  const [clientId, setClientId] = useState(PERSONAS[0]?.id ?? "");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const client = useMemo(
    () => CLIENTS.find((c) => c.id === clientId) ?? PERSONAS[0],
    [clientId],
  );

  const items = useMemo(
    () => articlesForClient(NEWS_FEED.articles, client),
    [client],
  );
  const peopleCounts = useMemo(
    () =>
      PERSONAS.map((c) => ({
        c,
        count: articlesForClient(NEWS_FEED.articles, c).length,
      })),
    [],
  );

  const selected =
    items.find((x) => x.article.id === pickedId) ?? items[0] ?? null;

  return (
    <div className="cnews">
      <h1>News by client</h1>
      <p className="lead">
        Real headlines from the relevance funnel, matched to each client. Click
        a story for the concrete reasons it's relevant to them — a held
        instrument, or an overlap with their values.
      </p>

      <div className="cnews-people">
        {peopleCounts.map(({ c, count }) => (
          <button
            key={c.id}
            className={"cnews-person" + (c.id === clientId ? " on" : "")}
            onClick={() => {
              setClientId(c.id);
              setPickedId(null);
            }}
          >
            <span className="nm">{c.name}</span>
            <span className="md">
              {c.mandate}
              {count ? ` · ${count} relevant` : ""}
            </span>
          </button>
        ))}
      </div>

      <div className="cnews-values">
        <span className="lbl">{client.name}'s values</span>
        {client.affinities.map((a) => {
          const t = THEME_BY_ID[a.theme];
          return (
            <span
              key={a.theme}
              className="chip theme"
              style={{ background: t.color }}
            >
              {t.label} · {Math.round(a.weight * 100)}
              {a.polarity === -1 ? " (avoid)" : ""}
            </span>
          );
        })}
      </div>

      <div className="cnews-split">
        <div className="cnews-list">
          {items.length ? (
            items.map(({ article, rel }) => (
              <button
                key={article.id}
                className={
                  "cnews-row" +
                  (selected?.article.id === article.id ? " on" : "")
                }
                onClick={() => setPickedId(article.id)}
              >
                <span className="cnews-rowtitle">{article.title}</span>
                <span className="cnews-rowtags">
                  <span className="cnews-cnum" title="Combined priority score (out of 100)">{Math.round(rel.combined * 100)}</span>
                  {rel.holdings[0] && (
                    <span className="cnews-tag hold">
                      Holds {rel.holdings[0].issuer}
                    </span>
                  )}
                  {rel.valueMatches[0] && (
                    <span
                      className="cnews-tag val"
                      style={{ borderColor: rel.valueMatches[0].color }}
                    >
                      {rel.valueMatches[0].label}
                    </span>
                  )}
                  {!rel.holdings.length &&
                    !rel.valueMatches.length &&
                    rel.mandateMatch && (
                      <span className="cnews-tag">Mandate</span>
                    )}
                </span>
                <span className="cnews-src">
                  {article.source}
                  {article.date ? ` · ${fmtDate(article.date)}` : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="nf-empty">
              No funnel stories are relevant to {client.name} right now.
            </p>
          )}
        </div>

        <div className="cnews-detail">
          {selected ? (
            <OverlapDetail
              article={selected.article}
              rel={selected.rel}
              client={client}
            />
          ) : (
            <div className="cnews-empty">
              Select a story to see why it matters to {client.name}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverlapDetail({
  article,
  rel,
  client,
}: {
  article: FeedArticle;
  rel: Relevance;
  client: Client;
}) {
  const v = article.stage2;
  const axes = client.affinities.map((a) => {
    const m = rel.valueMatches.find((x) => x.axis === a.theme);
    return { a, t: THEME_BY_ID[a.theme], match: m };
  });

  return (
    <div className="cnews-detail-card">
      <a
        className="cnews-title"
        href={article.url}
        target="_blank"
        rel="noopener"
      >
        {article.title}
      </a>
      <div className="cnews-src">
        {article.source}
        {article.date ? ` · ${fmtDate(article.date)}` : ""}
      </div>
      <div className="nf-chips" style={{ marginTop: 8 }}>
        {v?.marketMovement && (
          <span className="nf-theme mkt">market-movement</span>
        )}
        {(v?.themes ?? [])
          .filter((t) => t !== "market-movement")
          .map((t) => (
            <span key={t} className="nf-theme">
              {t}
            </span>
          ))}
      </div>

      <div className="cnews-sec">Combined priority score</div>
      <div className="cnews-combined">
        <FormulaTip formula={NF.combined}><span className="cnews-cbig">{Math.round(rel.combined * 100)}</span></FormulaTip>
        <div className="cnews-cbreak">
          <div><FormulaTip formula={NF.value}><span>Value overlap</span></FormulaTip><span><b>{Math.round(rel.valueOverlap * 100)}</b> × {RELEVANCE_WEIGHTS.value}</span></div>
          <div><FormulaTip formula={NF.severity}><span>Severity</span></FormulaTip><span><b>{Math.round(rel.severity * 100)}</b> × {RELEVANCE_WEIGHTS.severity}</span></div>
          <div><FormulaTip formula={NF.recency}><span>Recency</span></FormulaTip><span><b>{Math.round(rel.recency * 100)}</b> × {RELEVANCE_WEIGHTS.recency}</span></div>
        </div>
      </div>
      <p className="cnews-overlap-cap" style={{ textAlign: "left", margin: "6px 0 0" }}>Weighted blend (out of 100) used to rank this client's feed · hover a row for its formula. Justification: docs/relevance-metric.md.</p>

      <div className="cnews-sec">Why it's relevant to {client.name}</div>
      <div className="cnews-reasons">
        {rel.reasons.map((r, i) => (
          <div className={"cnews-reason " + r.kind} key={i}>
            {r.text}
          </div>
        ))}
        {!rel.reasons.length && (
          <div className="cnews-reason">
            Broad / market-level signal — no direct holding or value link.
          </div>
        )}
      </div>

      <div className="cnews-sec">Value-axis overlap</div>
      <div className="cnews-overlap">
        <ValueSpider
          values={article.values}
          overlay={article.values.map(
            (vv) =>
              client.affinities.find((a) => a.theme === vv.key)?.weight ?? 0,
          )}
          size={220}
        />
        <p className="cnews-overlap-cap">
          <span className="cnews-leg story">▬ this story</span>
          <span className="cnews-leg client">▬ {client.name}'s values</span>
        </p>
      </div>
      <div className="cnews-axes">
        {axes.map(({ a, t, match }) => (
          <div className={"cnews-axis" + (match ? " hit" : "")} key={a.theme}>
            <span className="cnews-axis-name">
              <span className="dot" style={{ background: t.color }} />
              {t.label}
              {a.polarity === -1 ? " (avoid)" : ""}
            </span>
            {match ? (
              <span className="cnews-axis-math">touched</span>
            ) : (
              <span className="cnews-axis-math none">not touched</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
