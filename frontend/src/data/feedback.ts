import type { FeedbackEvent } from "../types";

/**
 * Historical RM decisions per client — the training signal the preference
 * model starts from, so the copilot arrives already tuned to each relationship.
 * New in-session feedback is appended on top of this (see lib/learningStore).
 */
export const SEED_FEEDBACK: FeedbackEvent[] = [
  // ---- Ammann: reputation-led, decisive, prefers data-driven framing ----
  { id: "fb-amm-1", clientId: "ammann", date: "2025-09-08", theme: "tech-innovation", decision: "declined", summary: "Passed on an AI-momentum add", voice: "data-driven" },
  { id: "fb-amm-2", clientId: "ammann", date: "2025-11-12", theme: "governance", decision: "accepted", summary: "Exited a supplier-flagged apparel name", voice: "data-driven" },
  { id: "fb-amm-3", clientId: "ammann", date: "2026-01-20", theme: "governance", decision: "accepted", summary: "Pre-empted an ESG headline on a held bank", voice: "data-driven" },
  { id: "fb-amm-4", clientId: "ammann", date: "2026-02-14", theme: "governance", decision: "accepted", summary: "Rotated out of a controversy-watchlist brand", voice: "values-led" },
  { id: "fb-amm-5", clientId: "ammann", date: "2026-03-03", theme: "governance", decision: "tweaked", summary: "Reworded a divestment note before sending", voice: "data-driven" },

  // ---- Schneider: values-led, warm; cold/transactional notes fall flat ----
  { id: "fb-sch-1", clientId: "schneider", date: "2025-08-21", theme: "healthcare", decision: "declined", summary: "Declined a data-only summary as too transactional", voice: "data-driven" },
  { id: "fb-sch-2", clientId: "schneider", date: "2025-10-05", theme: "healthcare", decision: "accepted", summary: "Swapped a pharma name after an R&D cut", voice: "values-led" },
  { id: "fb-sch-3", clientId: "schneider", date: "2025-12-02", theme: "healthcare", decision: "tweaked", summary: "Softened the tone on a swap note", voice: "values-led" },
  { id: "fb-sch-4", clientId: "schneider", date: "2026-01-11", theme: "healthcare", decision: "accepted", summary: "Added a rare-disease research leader", voice: "values-led" },
  { id: "fb-sch-5", clientId: "schneider", date: "2026-03-19", theme: "consumer", decision: "accepted", summary: "Trimmed a volatile holding", voice: "values-led" },

  // ---- Huber: mission-first; ideas with no impact angle get declined ----
  { id: "fb-hub-1", clientId: "huber", date: "2025-09-30", theme: "environment", decision: "accepted", summary: "Reinforced a reforestation-aligned holding", voice: "values-led" },
  { id: "fb-hub-2", clientId: "huber", date: "2025-11-25", theme: "financials", decision: "declined", summary: "Passed on a pure-yield idea with no impact angle", voice: "data-driven" },
  { id: "fb-hub-3", clientId: "huber", date: "2026-02-02", theme: "environment", decision: "accepted", summary: "Exited a greenwashing-flagged name", voice: "values-led" },
  { id: "fb-hub-4", clientId: "huber", date: "2026-04-10", theme: "environment", decision: "tweaked", summary: "Added impact metrics to a note", voice: "values-led" },

  // ---- Räber: conservative; repeatedly declines US-tech tilts ----
  { id: "fb-rae-1", clientId: "raeber", date: "2025-10-18", theme: "consumer", decision: "accepted", summary: "Kept allocation in blue-chip staples", voice: "values-led" },
  { id: "fb-rae-2", clientId: "raeber", date: "2025-12-14", theme: "tech-innovation", decision: "declined", summary: "Declined the standard CIO AI tilt", voice: "data-driven" },
  { id: "fb-rae-3", clientId: "raeber", date: "2026-01-30", theme: "financials", decision: "accepted", summary: "Reinvested a maturing coupon", voice: "data-driven" },
  { id: "fb-rae-4", clientId: "raeber", date: "2026-02-08", theme: "consumer", decision: "accepted", summary: "Chose a dividend-quality alternative", voice: "values-led" },
  { id: "fb-rae-5", clientId: "raeber", date: "2026-03-22", theme: "tech-innovation", decision: "declined", summary: "Declined a second AI-momentum nudge", voice: "values-led" },
];
