export type NewsView = "funnel" | "client";

export function NewsViewToggle({ view, onView }: { view: NewsView; onView: (v: NewsView) => void }) {
  return (
    <div className="news-toggle">
      <button className={"nt-opt" + (view === "funnel" ? " on" : "")} onClick={() => onView("funnel")}>📰 Relevance funnel</button>
      <button className={"nt-opt" + (view === "client" ? " on" : "")} onClick={() => onView("client")}>👥 By client</button>
    </div>
  );
}
