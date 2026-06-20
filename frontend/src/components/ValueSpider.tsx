import { useState } from "react";
import type { ValueScore } from "../data/newsFeed";

/**
 * Radar over the client value-axes an article implicates (news-test scoreValues).
 * Optionally overlays a second series (`overlay`, aligned 1:1 to `values`) — used
 * to plot the client's own value profile so the overlap is visible.
 */
export function ValueSpider({
  values,
  overlay,
  overlayColor = "#d69e2e",
  size = 280,
}: {
  values: ValueScore[];
  overlay?: number[];
  overlayColor?: string;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const N = values.length;
  const c = size / 2;
  const R = c - 58;

  const ang = (i: number) => (-90 + (i * 360) / N) * (Math.PI / 180);
  const pt = (i: number, r: number): [number, number] => [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  const ring = (f: number) => values.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const poly = values.map((v, i) => pt(i, R * Math.max(0.015, v.score)).join(",")).join(" ");
  const polyOverlay = overlay ? overlay.map((s, i) => pt(i, R * Math.max(0.015, s)).join(",")).join(" ") : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: "block" }}>
      {[0.5, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#232c3d" strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#1b2331" strokeWidth={1} />;
      })}

      {/* client profile (behind) */}
      {polyOverlay && <polygon points={polyOverlay} fill={overlayColor + "1f"} stroke={overlayColor} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />}
      {/* this story's implicated axes (front) */}
      <polygon points={poly} fill="#4f8ff733" stroke="#4f8ff7" strokeWidth={2} strokeLinejoin="round" />

      {overlay && overlay.map((s, i) => {
        if (s <= 0) return null;
        const [px, py] = pt(i, R * s);
        return <circle key={"o" + i} cx={px} cy={py} r={3} fill={overlayColor} />;
      })}
      {values.map((v, i) => {
        const [px, py] = pt(i, R * Math.max(0.015, v.score));
        const [lx, ly] = pt(i, R + 22);
        const on = v.score > 0;
        const clientOn = overlay ? overlay[i] > 0 : false;
        return (
          <g key={v.key} style={{ cursor: "default" }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {on && <circle cx={px} cy={py} r={hover === i ? 4.6 : 3.4} fill="#4f8ff7" />}
            <text x={lx} y={ly} fill={hover === i ? "#e6edf6" : on || clientOn ? "#cfe0f5" : "#6b7a8f"} fontSize={10.5} textAnchor="middle" dominantBaseline="middle">
              {v.short}
            </text>
            <title>{v.label} · {Math.round(v.score * 100)}%</title>
          </g>
        );
      })}
    </svg>
  );
}
