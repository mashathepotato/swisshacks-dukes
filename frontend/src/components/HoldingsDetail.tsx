import { useMemo, useState } from "react";
import type { Client } from "../types";
import { PERSONA_PLAY } from "../lib/portfolio";
import { PORTFOLIOS } from "../data/portfolio";
import { allocationBy, holdingsWithTarget, ALLOC_DIMS } from "../lib/allocation";
import type { AllocDim } from "../lib/allocation";
import { formatMoney } from "../lib/format";

/**
 * Full per-client holdings + allocation breakdown over the REAL portfolio data.
 * Allocation by asset class / sub-asset class / region, current-vs-target per
 * sleeve, and a positions table. Gated on PERSONA_PLAY (synthetic twins omit).
 */
export function HoldingsDetail({ client }: { client: Client }) {
  const play = PERSONA_PLAY[client.id];
  const [dim, setDim] = useState<AllocDim>("assetClass");
  const [open, setOpen] = useState(false);

  const holdings = useMemo(() => (play ? PORTFOLIOS[play.mandate] : []), [play]);
  const alloc = useMemo(() => (play ? allocationBy(holdings, dim) : null), [holdings, dim, play]);
  const rows = useMemo(() => (play ? holdingsWithTarget(holdings) : []), [holdings, play]);

  if (!play || !alloc) return null;

  return (
    <>
      <div className="section-title">
        Holdings &amp; allocation · {play.mandate} <span className="learn-tag">REAL PORTFOLIO</span>
      </div>

      <div className="card">
        <div className="pref-opts" style={{ marginBottom: 10 }}>
          {ALLOC_DIMS.map((d) => (
            <button key={d.id} className={"pref-opt" + (dim === d.id ? " on" : "")} onClick={() => setDim(d.id)}>
              {d.label}
            </button>
          ))}
        </div>

        {alloc.sleeves.map((s) => (
          <div className="drift-row" key={s.key} style={{ flexWrap: "wrap" }}>
            <span className="sa">{s.key}</span>
            <span className="dv">{s.currentPct.toFixed(1)}% · {formatMoney(s.currentCHF)}</span>
            <div className="bar" style={{ flexBasis: "100%", marginTop: 5 }}>
              <div style={{ width: `${Math.min(100, s.currentPct)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h4>Current vs target per sleeve (sub-asset class)</h4>
        {allocationBy(holdings, "subAssetClass").sleeves.map((s) => {
          const breached = Math.abs(s.deltaPct) > 2.0;
          return (
            <div className={"drift-row" + (breached ? " breach" : "")} key={s.key}>
              <span className="sa">{s.key}</span>
              <span className="dv">
                {s.currentPct.toFixed(1)}% → {s.targetPct.toFixed(1)}%
                {" "}({s.deltaPct >= 0 ? "+" : ""}{s.deltaPct.toFixed(1)}pp)
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <button className="ev-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "▾ Hide positions" : `▸ All ${rows.length} positions`}
        </button>
        {open && (
          <table className="holdings-table">
            <thead>
              <tr><th>Issuer</th><th>Sleeve</th><th>Region</th><th className="num">Current</th><th className="num">Target</th><th className="num">Δ</th></tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const cls = h.deltaCHF > 0 ? "pos" : h.deltaCHF < 0 ? "neg" : "";
                return (
                  <tr key={h.isin}>
                    <td>{h.issuer}</td>
                    <td className="dim">{h.subAssetClass}</td>
                    <td className="dim">{h.region}</td>
                    <td className="num">{formatMoney(h.currentCHF)}</td>
                    <td className="num">{formatMoney(h.targetCHF)}</td>
                    <td className={"num " + cls}>{h.deltaCHF >= 0 ? "+" : "−"}{formatMoney(Math.abs(h.deltaCHF))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
