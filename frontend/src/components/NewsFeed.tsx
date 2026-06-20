import { useMemo, useState } from "react";
import { NEWS_FEED } from "../data/newsFeed";
import type { FeedArticle } from "../data/newsFeed";
import { NewsViewToggle } from "./NewsViewToggle";
import type { NewsView } from "./NewsViewToggle";
import { ValueSpider } from "./ValueSpider";

const TYPE_LABEL: Record<string, string> = {
  equity: "equity", bond: "bond", "real-estate": "real estate", alternative: "alt", other: "other",
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return d; }
}

function matchesTheme(a: FeedArticle, theme: string | null): boolean {
  if (!theme) return true;
  return Boolean(a.stage2?.themes.includes(theme)) || (theme === "market-movement" && Boolean(a.stage2?.marketMovement));
}

export function NewsFeed({ view, onView }: { view: NewsView; onView: (v: NewsView) => void }) {
  const feed = NEWS_FEED;
  const [marketOnly, setMarketOnly] = useState(false);
  const [theme, setTheme] = useState<string | null>(null);
  const [open, setOpen] = useState<FeedArticle | null>(null);

  const selected = useMemo(
    () => feed.articles
      .filter((a) => a.selected && matchesTheme(a, theme))
      .sort((a, b) =>
        (b.importance - a.importance) ||
        (b.affectedHoldings.length - a.affectedHoldings.length) ||
        ((b.stage2?.confidence || 0) - (a.stage2?.confidence || 0))),
    [feed, theme],
  );

  const incoming = useMemo(
    () => (marketOnly ? feed.articles.filter((a) => a.selected) : feed.articles).filter((a) => matchesTheme(a, theme)),
    [feed, marketOnly, theme],
  );

  const e = feed.engine;

  return (
    <div className="newsfeed">
      <div className="nf-head">
        <div>
          <h1>News desk</h1>
          <p className="lead">Every headline, filtered for investment relevance — drops the noise, themes the survivors, ranks by portfolio exposure &amp; client values, and labels the instruments each story touches.</p>
        </div>
        <div className="nf-head-right">
          <NewsViewToggle view={view} onView={onView} />
          <span className={"nf-eng " + (e.llmReady ? "llm" : "heur")} title={`Stage 2 engine: ${e.engine} (${e.model})`}>
            Stage 2 · {e.llmReady ? e.model : "heuristic"}
          </span>
        </div>
      </div>

      <div className="nf-funnel">
        <span><b>{feed.total}</b> fetched</span>
        <span className="arr">→</span>
        <span><b>{feed.total - feed.stage1Dropped}</b> investment-relevant <i>({feed.stage1Dropped} dropped)</i></span>
        <span className="arr">→</span>
        <span><b>{feed.flagged}</b> themed / market-moving</span>
      </div>

      <div className="nf-themes">
        <button className={"nf-chip" + (theme === null ? " on" : "")} onClick={() => setTheme(null)}>All themes</button>
        {feed.themes.map((t) => (
          <button key={t} className={"nf-chip" + (theme === t ? " on" : "")} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>
        ))}
      </div>

      <div className="nf-split">
        <section className="nf-col">
          <div className="nf-colhead">
            <h2>Incoming feed · <span className="n">{incoming.length}</span></h2>
            <label className="nf-toggle">
              <input type="checkbox" checked={marketOnly} onChange={(ev) => setMarketOnly(ev.target.checked)} /> relevant only
            </label>
          </div>
          <p className="nf-hint">Everything fetched. Greyed = dropped by the cheap relevance pre-filter (no LLM spent).</p>
          {incoming.map((a) => <IncomingCard key={a.id} a={a} />)}
        </section>

        <section className="nf-col">
          <div className="nf-colhead"><h2>Market-relevant · <span className="n">{selected.length}</span></h2></div>
          <p className="nf-hint">Ranked by importance (portfolio exposure + client values touched). Click a story for its value spider.</p>
          {selected.length
            ? selected.map((a, i) => <SelectedCard key={a.id} a={a} rank={i + 1} onOpen={() => setOpen(a)} />)
            : <p className="nf-empty">No themed / market-moving articles{theme ? ` for “${theme}”` : ""}.</p>}
        </section>
      </div>

      {open && <NewsArticleModal a={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function IncomingCard({ a }: { a: FeedArticle }) {
  const dropped = !a.stage1.relevant;
  const label = a.selected ? "selected" : a.stage1.relevant ? "no theme" : "not investment";
  return (
    <div className={"nf-card lite" + (dropped ? " drop" : "") + (a.selected ? " sel" : "")}>
      <div className="nf-meta">
        <span className={"nf-badge " + (a.selected ? "sel" : dropped ? "drop" : "none")}>{label}</span>
        <span className="nf-src">{a.source} · {fmtDate(a.date)}</span>
      </div>
      <a className="nf-title" href={a.url} target="_blank" rel="noopener">{a.title}</a>
      {dropped && <div className="nf-drop">dropped: {a.stage1.reason}</div>}
    </div>
  );
}

function SelectedCard({ a, rank, onOpen }: { a: FeedArticle; rank: number; onOpen: () => void }) {
  const v = a.stage2!;
  const pct = Math.round((v.confidence || 0) * 100);
  const touched = a.values.filter((x) => x.score > 0).length;
  return (
    <div className="nf-card sel-card clickable" onClick={onOpen}>
      <div className="nf-meta">
        <span className="nf-rank">#{rank}</span>
        <span className="nf-conf">conf <span className="nf-bar"><i style={{ width: pct + "%" }} /></span> {pct}%</span>
        <span className="nf-src">{a.source} · {fmtDate(a.date)}</span>
      </div>
      <a className="nf-title" href={a.url} target="_blank" rel="noopener" onClick={(ev) => ev.stopPropagation()}>{a.title}</a>
      {v.reason && <div className="nf-why">▸ {v.reason}</div>}
      <div className="nf-chips">
        {v.marketMovement && <span className="nf-theme mkt">market-movement</span>}
        {v.themes.filter((t) => t !== "market-movement").map((t) => <span key={t} className="nf-theme">{t}</span>)}
      </div>
      {a.affectedHoldings.length > 0 ? (
        <div className="nf-holds">
          <div className="nf-holds-lbl">Instruments affected · {a.affectedHoldings.length}</div>
          {a.affectedHoldings.map((h) => (
            <div className="nf-hold" key={h.isin}>
              <span className={"nf-ty " + h.type}>{TYPE_LABEL[h.type] || h.type}</span>
              <span className="nf-isin">{h.isin}</span>
              <span className="nf-iss">{h.ticker ? h.ticker + " · " : ""}{h.issuer}</span>
              <span className="nf-mand">[{h.mandates.join(", ")}]</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="nf-nohold">No specific holding matched — broad / market-level signal.</div>
      )}
      <div className="nf-clickhint">▾ {touched ? `${touched} client value${touched === 1 ? "" : "s"} implicated` : "value spider"} · click</div>
    </div>
  );
}

function NewsArticleModal({ a, onClose }: { a: FeedArticle; onClose: () => void }) {
  const v = a.stage2;
  const touched = a.values.filter((x) => x.score > 0).sort((x, y) => y.score - x.score);
  return (
    <div className="nf-overlay" onClick={onClose}>
      <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
        <button className="nf-x" onClick={onClose}>✕</button>
        <div className="nf-src">{a.source} · {fmtDate(a.date)}</div>
        <a className="nf-m-title" href={a.url} target="_blank" rel="noopener">{a.title}</a>
        {v?.reason && <div className="nf-why">▸ {v.reason}</div>}
        <div className="nf-chips" style={{ marginTop: 8 }}>
          {v?.marketMovement && <span className="nf-theme mkt">market-movement</span>}
          {(v?.themes ?? []).filter((t) => t !== "market-movement").map((t) => <span key={t} className="nf-theme">{t}</span>)}
        </div>

        <div className="nf-m-section">Client values implicated</div>
        <ValueSpider values={a.values} />
        {touched.length ? (
          <div className="nf-vchips">
            {touched.map((x) => <span key={x.key} className="nf-vchip">{x.short} · {Math.round(x.score * 100)}%</span>)}
          </div>
        ) : (
          <div className="nf-nohold">No client value-axes implicated by this article.</div>
        )}

        {a.affectedHoldings.length > 0 && (
          <div className="nf-holds" style={{ marginTop: 14 }}>
            <div className="nf-holds-lbl">Instruments affected · {a.affectedHoldings.length}</div>
            {a.affectedHoldings.map((h) => (
              <div className="nf-hold" key={h.isin}>
                <span className={"nf-ty " + h.type}>{TYPE_LABEL[h.type] || h.type}</span>
                <span className="nf-isin">{h.isin}</span>
                <span className="nf-iss">{h.ticker ? h.ticker + " · " : ""}{h.issuer}</span>
                <span className="nf-mand">[{h.mandates.join(", ")}]</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
