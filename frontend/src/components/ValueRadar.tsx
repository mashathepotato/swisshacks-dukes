import { useState } from "react";
import { THEMES } from "../data/themes";
import type { Client } from "../types";

interface Props { client: Client; }

const SIZE = 260;
const C = SIZE / 2;
const R = SIZE / 2 - 38;

// angle for axis i (start at top, clockwise), 6 axes = hexagon
const angle = (i: number) => (-90 + i * (360 / THEMES.length)) * (Math.PI / 180);
const pt = (i: number, radius: number) => ({
  x: C + radius * Math.cos(angle(i)),
  y: C + radius * Math.sin(angle(i)),
});

export function ValueRadar({ client }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const weights = THEMES.map(
    (t) => client.affinities.find((a) => a.theme === t.id)?.weight ?? 0
  );

  const valuePoly = weights
    .map((w, i) => { const p = pt(i, R * w); return `${p.x},${p.y}`; })
    .join(" ");

  const ringPoly = (frac: number) =>
    THEMES.map((_, i) => { const p = pt(i, R * frac); return `${p.x},${p.y}`; }).join(" ");

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height={SIZE} style={{ display: "block" }}>
      {/* grid rings */}
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ringPoly(f)} fill="none" stroke="#232c3d" strokeWidth={1} />
      ))}
      {/* spokes */}
      {THEMES.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke="#1b2331" strokeWidth={1} />;
      })}
      {/* value polygon */}
      <polygon points={valuePoly} fill="#4f8ff733" stroke="#4f8ff7" strokeWidth={2} strokeLinejoin="round" />
      {weights.map((w, i) => {
        const p = pt(i, R * w);
        return <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 3} fill={THEMES[i].color} />;
      })}
      {/* corner labels (emoji) — hover to reveal the theme name */}
      {THEMES.map((t, i) => {
        const p = pt(i, R + 20);
        return (
          <g
            key={t.id}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
            <text x={p.x} y={p.y} fill={hover === i ? "#e6edf6" : "#9fb0c3"} fontSize={14} textAnchor="middle" dominantBaseline="middle">
              {t.emoji}
            </text>
            <title>{t.label} · {Math.round(weights[i] * 100)}</title>
          </g>
        );
      })}
      {/* immediate tooltip for the hovered axis */}
      {hover !== null && (() => {
        const t = THEMES[hover];
        const label = `${t.label} · ${Math.round(weights[hover] * 100)}`;
        const w = label.length * 6.2 + 18;
        const h = 22;
        const corner = pt(hover, R + 20);
        const x = Math.max(2, Math.min(SIZE - w - 2, corner.x - w / 2));
        const y = corner.y - 30 < 2 ? corner.y + 12 : corner.y - 30;
        return (
          <g pointerEvents="none">
            <rect x={x} y={y} width={w} height={h} rx={6} fill="#0b0f17" stroke={t.color} strokeWidth={1} />
            <text x={x + w / 2} y={y + h / 2 + 1} fill="#e6edf6" fontSize={11.5} fontWeight={600} textAnchor="middle" dominantBaseline="middle">
              {label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
