// Shared Event Registry request shape + a stable batch key, so the live server
// and the fixture-capture script build identical requests and agree on keys.

export function buildBody(apiKey, { q, mode, count } = {}) {
  const base = {
    apiKey,
    lang: "eng",
    articlesSortBy: "date",
    articlesCount: Math.min(Number(count) || 30, 100),
    resultType: "articles",
    dataType: ["news"],
    includeArticleSentiment: true,
    includeArticleConcepts: true,
    includeArticleCategories: true,
  };
  if (mode === "business") return { ...base, categoryUri: "dmoz/Business" };
  return { ...base, keyword: q || "markets", keywordOper: "and" };
}

// Identifies a stored batch. Business ignores the keyword; keyword defaults to
// "markets" so an empty box maps to the saved default batch.
export function batchKey({ q, mode } = {}) {
  if (mode === "business") return "business";
  return `keyword:${(q || "markets").trim().toLowerCase()}`;
}
