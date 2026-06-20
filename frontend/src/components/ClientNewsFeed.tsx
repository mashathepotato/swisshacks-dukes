import { RANKED_NEWS, newsImpacts } from "../data/news";
import { scoreColor, SIGNAL_META } from "../lib/format";
import type { NewsItem } from "../types";
import { NewsViewToggle } from "./NewsViewToggle";
import type { NewsView } from "./NewsViewToggle";

interface Props {
  view: NewsView;
  onView: (v: NewsView) => void;
  selectedId: string | null;
  onSelect: (news: NewsItem) => void;
}

export function ClientNewsFeed({ view, onView, selectedId, onSelect }: Props) {
  return (
    <div className="queue">
      <div className="news-head-row">
        <h1>Live news — by client impact</h1>
        <NewsViewToggle view={view} onView={onView} />
      </div>
      <p className="lead">
        {RANKED_NEWS.length} curated stories · ranked by severity, hardest client hit and reach across your
        book. Click a story for why it matters and a map of who it touches.
      </p>

      {RANKED_NEWS.map(({ news, priority }) => {
        const meta = SIGNAL_META[news.type];
        const reach = newsImpacts(news).length;
        return (
          <div
            key={news.id}
            className={"qrow" + (selectedId === news.id ? " selected" : "")}
            onClick={() => onSelect(news)}
          >
            <span
              className="score-pill"
              style={{ background: scoreColor(priority) + "22", color: scoreColor(priority) }}
            >
              <span className="n">{priority}</span>
            </span>
            <div className="who" style={{ minWidth: 96 }}>
              <div className="at" style={{ fontWeight: 700, color: "var(--text)" }}>{news.source}</div>
              <div className="at">{news.publishedAt}</div>
            </div>
            <div className="reason">
              {meta && (
                <span className="badge" style={{ background: meta.color + "22", color: meta.color }}>
                  {meta.label} · sev {news.severity}
                </span>
              )}
              <div style={{ fontWeight: 600, color: "var(--text)" }}>{news.headline}</div>
              <div className="recs-inline">
                <span className="r">Affects {reach} client{reach === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
