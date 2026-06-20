import { useMemo } from "react";
import type { Client, NewsItem } from "../types";
import { THEME_BY_ID } from "../data/themes";
import { newsImpacts, newsPriority } from "../data/news";
import { scoreColor, SIGNAL_META } from "../lib/format";
import { NewsImpactMap } from "./NewsImpactMap";

interface Props {
  news: NewsItem | null;
  onOpenClient?: (client: Client) => void;
}

export function NewsDetail({ news, onOpenClient }: Props) {
  if (!news) {
    return (
      <div className="drawer">
        <p className="empty">Select a story to see its impact across your book.</p>
      </div>
    );
  }
  return <NewsDetailBody news={news} onOpenClient={onOpenClient} />;
}

function NewsDetailBody({ news, onOpenClient }: { news: NewsItem; onOpenClient?: (client: Client) => void }) {
  const meta = SIGNAL_META[news.type];
  const priority = useMemo(() => newsPriority(news), [news]);
  const impacts = useMemo(() => newsImpacts(news), [news]);

  return (
    <div className="drawer">
      <span
        className="badge"
        style={{ background: meta.color + "22", color: meta.color, fontSize: 10, padding: "2px 7px", borderRadius: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}
      >
        {meta.label} · sev {news.severity}
      </span>
      <h2 style={{ marginTop: 8 }}>{news.headline}</h2>
      <div className="archetype">{news.source} · {news.publishedAt}</div>

      <span
        className="score-pill"
        style={{ background: scoreColor(priority) + "22", color: scoreColor(priority) }}
      >
        <span className="n">{priority}</span>
        <span className="d">/100 desk priority</span>
      </span>

      <div className="section-title" style={{ marginTop: 18 }}>The story</div>
      <p className="news-text">{news.summary}</p>

      <div className="section-title">Why this matters</div>
      <p className="news-text">{news.whyItMatters}</p>
      <ul className="evidence" style={{ marginTop: 4 }}>
        {news.drivers.map((d, i) => <li key={i}>{d}</li>)}
      </ul>

      <div className="section-title">Value themes touched</div>
      <div className="chips">
        {news.themes.map((id) => {
          const t = THEME_BY_ID[id];
          return (
            <span key={id} className="chip theme" style={{ background: t.color }}>
              {t.label}
            </span>
          );
        })}
      </div>

      <div className="section-title">Who it affects — impact map</div>
      <NewsImpactMap news={news} impacts={impacts} onPick={(im) => onOpenClient?.(im.client)} />

      <div className="section-title">Affected clients · {impacts.length}</div>
      {impacts.length === 0 && <p className="news-text">No clients in your book are materially exposed.</p>}
      {impacts.map((im) => {
        const col = scoreColor(im.impact);
        return (
          <div
            className="impact-row"
            key={im.client.id}
            onClick={() => onOpenClient?.(im.client)}
            role={onOpenClient ? "button" : undefined}
          >
            <div className="impact-head">
              <span className="impact-name">{im.client.name}</span>
              <span className="impact-score" style={{ color: col }}>{im.impact}</span>
            </div>
            <div className="impact-via">{im.via}</div>
            <div className="bar"><div style={{ width: `${im.impact}%`, background: col }} /></div>
          </div>
        );
      })}
    </div>
  );
}
