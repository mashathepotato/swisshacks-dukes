import type { TrajectoryPoint } from "../types";

interface Props { points: TrajectoryPoint[]; }

export function TrajectoryChart({ points }: Props) {
  const w = 268, h = 110, pad = 18;
  const xs = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const ys = (v: number) => h - pad - (v / 100) * (h - 2 * pad);

  const line = (key: "trust" | "alignment") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(p[key])}`).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {[0, 50, 100].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={ys(g)} y2={ys(g)} stroke="#1b2331" strokeWidth={1} />
      ))}
      <path d={line("alignment")} fill="none" stroke="#805ad5" strokeWidth={2} strokeDasharray="4 3" />
      <path d={line("trust")} fill="none" stroke="#4f8ff7" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.trust)} r={3} fill="#4f8ff7" />
          <text x={xs(i)} y={h - 4} fill="#6b7a8f" fontSize={9.5} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
