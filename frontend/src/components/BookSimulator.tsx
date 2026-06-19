import { useEffect, useMemo, useRef, useState } from "react";
import { CLIENTS, CLIENT_BY_ID } from "../data/clients";
import { THEMES, THEME_BY_ID } from "../data/themes";
import { ADVICE, STEPS, dominantTheme, simulateBook } from "../data/bookSim";
import { Sparkline } from "./Sparkline";

const W = 1000, H = 640, CX = 500, CY = 320, RING = 235;

interface Pos { id: string; x: number; y: number; r: number; theme: string; }

function trustColor(t: number) {
  return t >= 60 ? "#38a169" : t >= 45 ? "#d69e2e" : "#e53e3e";
}

export function BookSimulator() {
  const [adviceId, setAdviceId] = useState(ADVICE[0].id);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const advice = ADVICE.find((a) => a.id === adviceId)!;

  const frames = useMemo(() => simulateBook(advice), [adviceId]);
  const frame = frames[step];

  // static layout: clients grouped into non-empty value clusters around a ring
  const { positions, edges } = useMemo(() => {
    const groups = new Map<string, typeof CLIENTS>();
    for (const c of CLIENTS) {
      const t = dominantTheme(c) ?? "none";
      groups.set(t, [...(groups.get(t) ?? []), c]);
    }
    const themesPresent = THEMES.filter((t) => groups.has(t.id));
    const N = themesPresent.length;
    const positions: Pos[] = [];
    const edges: { a: Pos; b: Pos }[] = [];
    themesPresent.forEach((t, i) => {
      const ang = (-90 + (i * 360) / N) * (Math.PI / 180);
      const cx = CX + RING * Math.cos(ang);
      const cy = CY + RING * Math.sin(ang);
      const members = groups.get(t.id)!;
      const subR = members.length === 1 ? 0 : 30 + members.length * 5;
      const local: Pos[] = members.map((c, j) => {
        const a = (j / members.length) * 2 * Math.PI;
        return {
          id: c.id,
          x: cx + subR * Math.cos(a),
          y: cy + subR * Math.sin(a),
          r: 7 + (c.priorityScore / 22),
          theme: t.id,
        };
      });
      positions.push(...local);
      for (let m = 0; m < local.length; m++)
        for (let n = m + 1; n < local.length; n++) edges.push({ a: local[m], b: local[n] });
    });
    return { positions, edges };
  }, []);

  // playback
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= STEPS) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 750);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing]);

  function play() {
    if (step >= STEPS) setStep(0);
    setPlaying(true);
  }
  function selectAdvice(id: string) {
    setAdviceId(id);
    setStep(0);
    setPlaying(false);
  }

  // narrative counts vs baseline
  const gained = CLIENTS.filter((c) => frame.states[c.id].trust > frames[0].states[c.id].trust + 0.5).length;
  const lost = CLIENTS.filter((c) => frame.states[c.id].trust < frames[0].states[c.id].trust - 0.5).length;

  const series = (sel: (f: typeof frames[number]) => number) => frames.map(sel);
  const adoptSeries = series((f) => f.adoptionPct);
  const trustSeries = series((f) => f.avgTrust);
  const aumSeries = series((f) => f.totalAum);
  const riskSeries = series((f) => f.bookRisk);

  return (
    <div className="booksim">
      <div className="bs-head">
        <div>
          <h1>Book simulator — what happens if the whole book follows this advice</h1>
          <p className="lead">Pick an advice, press play, and watch clients adopt it through their value-clusters. Peers nudge peers; trust rises where it fits and erodes where it doesn't.</p>
        </div>
      </div>

      <div className="bs-advice">
        {ADVICE.map((a) => (
          <button key={a.id} className={"adv" + (a.id === adviceId ? " on" : "")} onClick={() => selectAdvice(a.id)} title={a.detail}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="bs-body">
        <div className="bs-canvas">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {/* cluster labels */}
            {THEMES.filter((t) => positions.some((p) => p.theme === t.id)).map((t, i, arr) => {
              const ang = (-90 + (i * 360) / arr.length) * (Math.PI / 180);
              const lx = CX + (RING + 78) * Math.cos(ang);
              const ly = CY + (RING + 78) * Math.sin(ang);
              return (
                <text key={t.id} x={lx} y={ly} fill={t.color} fontSize={14} fontWeight={600} textAnchor="middle">
                  {t.emoji} {t.label}
                </text>
              );
            })}
            {/* peer edges */}
            {edges.map((e, i) => {
              const aAdopt = frame.states[e.a.id].adopted, bAdopt = frame.states[e.b.id].adopted;
              const active = aAdopt && bAdopt;
              return (
                <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                  stroke={active ? "#4f8ff7" : "#222c3d"} strokeWidth={active ? 1.6 : 1} opacity={active ? 0.7 : 0.5} />
              );
            })}
            {/* client nodes */}
            {positions.map((p) => {
              const s = frame.states[p.id];
              const c = CLIENT_BY_ID[p.id];
              const theme = THEME_BY_ID[p.theme as keyof typeof THEME_BY_ID] ?? THEMES[0];
              const justAdopted = s.adoptedStep === step && step > 0;
              return (
                <g key={p.id}>
                  {justAdopted && <circle cx={p.x} cy={p.y} r={p.r + 8} fill="none" stroke={theme.color} strokeWidth={2} opacity={0.6} />}
                  <circle cx={p.x} cy={p.y} r={p.r + 3} fill="none" stroke={trustColor(s.trust)} strokeWidth={2} opacity={0.9} />
                  <circle cx={p.x} cy={p.y} r={p.r}
                    fill={s.adopted ? theme.color : "#0f1623"}
                    stroke={theme.color} strokeWidth={1.5}
                    opacity={s.adopted ? 1 : 0.85} />
                  {c.isPersona && (
                    <text x={p.x} y={p.y + p.r + 13} fill="#cdd9e8" fontSize={11.5} textAnchor="middle">{c.name}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="bs-legend">
            <span><i style={{ background: "#4f8ff7" }} /> adopted link</span>
            <span><i style={{ border: "2px solid #38a169" }} /> trust ↑</span>
            <span><i style={{ border: "2px solid #e53e3e" }} /> trust ↓</span>
            <span>ring = trust · fill = adopted</span>
          </div>
        </div>

        <div className="bs-side">
          <Metric label="Adoption" value={`${Math.round(frame.adoptionPct)}%`} sub={`${CLIENTS.filter((c) => frame.states[c.id].adopted).length} of ${CLIENTS.length} clients`}
            series={adoptSeries} upTo={step} color="#4f8ff7" min={0} max={100} />
          <Metric label="Avg relationship trust" value={frame.avgTrust.toFixed(1)} sub={delta(frame.avgTrust, frames[0].avgTrust)}
            series={trustSeries} upTo={step} color="#38a169" min={30} max={90} />
          <Metric label="Total AUM" value={`CHF ${frame.totalAum.toFixed(0)}m`} sub={delta(frame.totalAum, frames[0].totalAum, "m")}
            series={aumSeries} upTo={step} color="#d69e2e" min={Math.min(...aumSeries) - 2} max={Math.max(...aumSeries) + 2} />
          <Metric label="Book risk exposure" value={frame.bookRisk.toFixed(0)} sub={delta(frame.bookRisk, frames[0].bookRisk)}
            series={riskSeries} upTo={step} color="#805ad5" min={Math.min(...riskSeries) - 5} max={Math.max(...riskSeries) + 5} />

          <div className="bs-callout">
            <div><b style={{ color: "#38a169" }}>{gained}</b> gained trust · <b style={{ color: "#e53e3e" }}>{lost}</b> lost trust</div>
            <p>A single broadcast advice fits some clients and not others — the case for asset-level personalisation.</p>
          </div>
        </div>
      </div>

      <div className="bs-controls">
        <button className="play" onClick={() => (playing ? setPlaying(false) : play())}>
          {playing ? "⏸ Pause" : step >= STEPS ? "↻ Replay" : "▶ Play"}
        </button>
        <button className="reset" onClick={() => { setStep(0); setPlaying(false); }}>Reset</button>
        <input type="range" min={0} max={STEPS} value={step}
          onChange={(e) => { setPlaying(false); setStep(+e.target.value); }} />
        <span className="steplabel">{frame.label}{step === 0 ? " (baseline)" : ""}</span>
      </div>
    </div>
  );
}

function delta(now: number, base: number, unit = "") {
  const d = now - base;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}${unit} vs start`;
}

function Metric({ label, value, sub, series, upTo, color, min, max }: {
  label: string; value: string; sub: string; series: number[]; upTo: number; color: string; min: number; max: number;
}) {
  return (
    <div className="bs-metric">
      <div className="bs-metric-top">
        <span className="lbl">{label}</span>
        <span className="val" style={{ color }}>{value}</span>
      </div>
      <Sparkline values={series} upTo={upTo} color={color} min={min} max={max} />
      <div className="sub">{sub}</div>
    </div>
  );
}
