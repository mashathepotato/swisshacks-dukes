import { THEMES } from "../data/themes";
import type { Client } from "../types";

interface Props { client: Client; }

const SIZE = 260;
const PAD = 30;           // breathing room so axis labels don't clip at the viewBox edge
const C = SIZE / 2;
const R = SIZE / 2 - 38;

// angle for axis i (start at top, clockwise), 6 axes = hexagon
const angle = (i: number) => (-90 + i * (360 / THEMES.length)) * (Math.PI / 180);
const pt = (i: number, radius: number) => ({
  x: C + radius * Math.cos(angle(i)),
  y: C + radius * Math.sin(angle(i)),
});

export function ValueRadar({ client }: Props) {
  const weights = THEMES.map(
    (t) => client.affinities.find((a) => a.theme === t.id)?.weight ?? 0
  );

  const valuePoly = weights
    .map((w, i) => { const p = pt(i, R * w); return `${p.x},${p.y}`; })
    .join(" ");

  const ringPoly = (frac: number) =>
    THEMES.map((_, i) => { const p = pt(i, R * frac); return `${p.x},${p.y}`; }).join(" ");

  return (
    <svg viewBox={`${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`} width="100%" height={SIZE + PAD * 2} style={{ display: "block" }}>
      {/* grid rings */}
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ringPoly(f)} fill="none" stroke="#d7d4cc" strokeWidth={1} />
      ))}
      {/* spokes */}
      {THEMES.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke="#e7e4dc" strokeWidth={1} />;
      })}
      {/* value polygon */}
      <polygon points={valuePoly} fill="#de39191f" stroke="#de3919" strokeWidth={2} strokeLinejoin="round" />
      {weights.map((w, i) => {
        const p = pt(i, R * w);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill={THEMES[i].color} />;
      })}
      {/* corner labels */}
      {THEMES.map((t, i) => {
        const p = pt(i, R + 22);
        return (
          <text key={t.id} x={p.x} y={p.y} fill="#545861" fontSize={10.5} fontWeight={600} letterSpacing=".02em" textAnchor="middle" dominantBaseline="middle">
            {t.short}
          </text>
        );
      })}
    </svg>
  );
}
