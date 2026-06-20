import feed from "./newsFeed.json";

// Shapes produced by the news-test pipeline (see news-test/bake.mjs). The live
// sidecar (server.mjs) emits the same per-article shape, so a live source can
// later replace this static import behind the same UI.

export interface AffectedHolding {
  isin: string;
  issuer: string;
  type: string;          // equity | bond | real-estate | alternative | other
  ticker: string | null;
  industryGroup: string;
  mandates: string[];
}
export interface Stage1Verdict { relevant: boolean; reason: string; }
export interface Stage2Verdict {
  themes: string[];
  marketMovement: boolean;
  confidence: number;
  reason: string;
  engine: string;
}
// One entry per client value-axis (from news-test/values.mjs scoreValues).
export interface ValueScore {
  key: string;
  label: string;
  short: string;
  overlap: number;
  score: number;   // 0..1 — share of the axis's themes the article hits
}
export interface FeedArticle {
  id: string;
  title: string;
  source: string;
  date: string | null;
  url: string;
  sentiment: number | null;
  summary: string;
  stage1: Stage1Verdict;
  stage2: Stage2Verdict | null;
  selected: boolean;
  affectedHoldings: AffectedHolding[];
  values: ValueScore[];
  importance: number;
}
export interface NewsFeedData {
  generatedAt: string;
  engine: { engine: string; model: string; llmReady: boolean };
  themes: string[];
  batches: string[];
  total: number;
  stage1Dropped: number;
  assessed: number;
  flagged: number;
  articles: FeedArticle[];
}

export const NEWS_FEED = feed as unknown as NewsFeedData;
