import { useEffect, useMemo, useState } from "react";
import type { Client, EvidenceKind } from "../types";
import { PORTFOLIOS, CIO, STRATEGIES } from "../data/portfolio";
import { computeDrift, proposeSwap, simulateSwap, PERSONA_PLAY } from "../lib/portfolio";
import { EVIDENCE_META } from "../lib/explain";
import { formatMoney } from "../lib/format";

/** A source receipt, reusing the dev prototype's receipt style. */
function Receipt({ kind, sourceId, quote }: { kind: EvidenceKind; sourceId: string; quote: string }) {
  const em = EVIDENCE_META[kind];
  return (
    <div className="receipt">
      <div className="rcpt-meta">
        <span className="kindtag" style={{ background: em.color }}>{em.icon} {em.label}</span>
        <span className="rcpt-src">{sourceId}</span>
      </div>
      <blockquote className="rcpt-quote">“{quote}”</blockquote>
    </div>
  );
}

/**
 * Mandate & compliance desk — grounds the copilot in the real CIO list and the
 * ±2.0pp drift rule (Phase A–C engines). Computes live drift, an explainable
 * CIO-constrained swap, and a what-if checker the RM can run before proposing.
 */
export function ComplianceDesk({ client }: { client: Client }) {
  const play = PERSONA_PLAY[client.id];
  const holdings = PORTFOLIOS[play.mandate];

  const drift = useMemo(() => computeDrift(holdings, STRATEGIES, play.mandate), [holdings, play.mandate]);
  const breaches = drift.filter((d) => d.breached);
  const rec = useMemo(() => proposeSwap(play.sellIsin, holdings, CIO), [holdings, play.sellIsin]);

  const heldIsins = useMemo(() => new Set(holdings.map((h) => h.isin)), [holdings]);
  // For aversion personas, the CIO's cross-sector rotation targets become what-if buys.
  const pushed = useMemo(
    () =>
      play.aversionTerms?.length
        ? CIO.filter(
            (c) => c.rating === "BUY" && play.aversionTerms!.some((t) => c.industryGroup.toLowerCase().includes(t)) && !heldIsins.has(c.isin)
          ).slice(0, 3)
        : [],
    [heldIsins, play.aversionTerms]
  );

  const [sellIsin, setSellIsin] = useState(play.sellIsin);
  const candidates = useMemo(() => {
    const sw = proposeSwap(sellIsin, holdings, CIO);
    const list: { isin: string; label: string; reason?: string }[] = [];
    if (sellIsin === play.sellIsin)
      pushed.forEach((c) => list.push({ isin: c.isin, label: `${c.issuer} · CIO-pushed (${c.industryGroup})`, reason: "A CIO tactical-rotation target the client is averse to." }));
    if (sw.chosen) list.push({ isin: sw.chosen.isin, label: `${sw.chosen.issuer} · recommended`, reason: sw.chosen.reason });
    sw.alternatives.forEach((a) => list.push({ isin: a.isin, label: `${a.issuer} · alternative`, reason: a.reason }));
    sw.rejected.forEach((r) => list.push({ isin: r.isin, label: `${r.issuer} · ${r.reason}` }));
    return list;
  }, [sellIsin, holdings, pushed, play.sellIsin]);

  const [buyIsin, setBuyIsin] = useState(candidates[0]?.isin ?? "");
  useEffect(() => {
    // Intentional: when the sell changes, reset the buy to the new top candidate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!candidates.find((c) => c.isin === buyIsin)) setBuyIsin(candidates[0]?.isin ?? "");
  }, [candidates, buyIsin]);

  const sim = useMemo(
    () =>
      buyIsin
        ? simulateSwap({
            holdings, strategies: STRATEGIES, cio: CIO, mandate: play.mandate, sellIsin, buyIsin,
            aversionTerms: play.aversionTerms,
            sellResolvesConflict: play.resolvesConflict && sellIsin === play.sellIsin,
          })
        : null,
    [holdings, sellIsin, buyIsin, play]
  );
  const why = candidates.find((c) => c.isin === buyIsin)?.reason;
  const mk = (ok: boolean) => <span className={"mk " + (ok ? "y" : "n")}>{ok ? "✓" : "✗"}</span>;

  return (
    <>
      <div className="section-title">
        Mandate &amp; compliance desk <span className="learn-tag" style={{ color: "var(--accent)", background: "#4f8ff722", borderColor: "#4f8ff755" }}>LIVE ENGINE</span>
      </div>
      <p className="thread-intro">{play.scenario} Checked against the real CIO recommendation list and the ±2.0pp mandate-drift rule.</p>

      <div className="card">
        <h4>Mandate drift · {play.mandate} (computed from holdings)</h4>
        {breaches.length ? (
          breaches.map((d) => (
            <div className="drift-row breach" key={d.subAssetClass}>
              <span className="sa">{d.subAssetClass}</span>
              <span className="dv">{d.deltaPct > 0 ? "+" : ""}{d.deltaPct.toFixed(1)}pp vs target</span>
            </div>
          ))
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-dim)" }}>All sub-asset sleeves within ±2.0pp of target.</p>
        )}
      </div>

      {play.resolvesConflict && rec.chosen && (
        <div className="card">
          <h4>Recommended swap · SELL {rec.sell.issuer} → BUY {rec.chosen.issuer}</h4>
          <p>{rec.chosen.reason}</p>
          <div className="receipts" style={{ marginTop: 9 }}>
            <Receipt kind="cio" sourceId={`CIO list · ${rec.chosen.issuer} rated BUY`} quote={rec.chosen.cioView} />
          </div>
          {rec.alternatives.length > 0 && (
            <div className="alts">
              {rec.alternatives.slice(0, 3).map((a) => (
                <div className="alt-row" key={a.isin}><span className="ai">{a.issuer}</span> — {a.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h4>What-if · test a trade before you propose it</h4>
        <div className="cdesk-controls">
          <label>Sell
            <select value={sellIsin} onChange={(e) => setSellIsin(e.target.value)}>
              {holdings.map((h) => <option key={h.isin} value={h.isin}>{h.issuer}</option>)}
            </select>
          </label>
          <label>Buy
            <select value={buyIsin} onChange={(e) => setBuyIsin(e.target.value)}>
              {candidates.map((c) => <option key={c.isin} value={c.isin}>{c.label}</option>)}
            </select>
          </label>
        </div>
        {why && <p className="cdesk-why">{why}</p>}
        {sim && (
          <>
            <div className={"verdict " + (sim.compliant ? "ok" : "no")}>
              {sim.compliant ? "✓ Mandate-compliant swap" : "✗ Not mandate-compliant"}
            </div>
            <div className="stamp">{mk(sim.sameSector)} Same sector{sim.buy.industryGroup ? ` (${sim.buy.industryGroup})` : ""}</div>
            <div className="stamp">{mk(sim.buyRatingOk)} Buy is CIO-rated BUY{sim.buy.rating && sim.buy.rating !== "BUY" ? ` — it's ${sim.buy.rating}` : ""}</div>
            <div className="stamp">{mk(sim.newBreaches.length === 0)} No new ±2.0pp drift breach{sim.newBreaches.length ? ` — ${sim.newBreaches.join(", ")}` : ""}</div>
            <div className="cdesk-moved"><b>{formatMoney(sim.amountCHF)}</b> would move from {sim.sell.issuer} to {sim.buy.issuer}.</div>
            <div className={"dverdict " + sim.dna.verdict}><b>Client values: {sim.dna.verdict}</b> — {sim.dna.reason}</div>
          </>
        )}
      </div>
    </>
  );
}
