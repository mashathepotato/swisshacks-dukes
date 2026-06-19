import { useMemo } from "react";
import { CLIENTS } from "../data/clients";
import { THEME_BY_ID } from "../data/themes";
import { AXIS_LABELS, valueCoords } from "../lib/valueMap";
import type { Client } from "../types";

const W = 1000, H = 680, M = 70;

interface Props {
  selectedId: string | null;
  onSelect: (client: Client) => void;
}

interface Placed { client: Client; x: number; y: number; r: number; color: string; }

export function WorldMap({ selectedId, onSelect }: Props) {
  const toX = (x: number) => W / 2 + x * (W / 2 - M);
  const toY = (y: number) => H / 2 - y * (H / 2 - M);

  // Lay clients out by value coords, then push overlapping dots apart so
  // labels stay legible where clients cluster in similar value space.
  const placed = useMemo<Placed[]>(() => {
    const nodes: Placed[] = CLIENTS.map((c) => {
      const { x, y } = valueCoords(c);
      const dominant = [...c.affinities].sort((a, b) => b.weight - a.weight)[0];
      return {
        client: c,
        x: toX(x),
        y: toY(y),
        r: 7 + c.priorityScore / 11,
        color: dominant ? THEME_BY_ID[dominant.theme].color : "#4f8ff7",
      };
    });
    for (let iter = 0; iter < 60; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r + 30; // room for labels below dots
          if (dist < min) {
            const push = (min - dist) / 2;
            const ux = dx / dist, uy = dy / dist;
            a.x -= ux * push; a.y -= uy * push;
            b.x += ux * push; b.y += uy * push;
          }
        }
      }
    }
    for (const n of nodes) {
      n.x = Math.max(M, Math.min(W - M, n.x));
      n.y = Math.max(M, Math.min(H - M, n.y));
    }
    return nodes;
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div className="graph-hint">Position = client's value orientation · size = priority · click to open profile</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* quadrant tint */}
        <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="#3182ce0c" />
        <rect x={0} y={0} width={W / 2} height={H / 2} fill="#38a1690c" />
        <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="#805ad50c" />
        <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="#d69e2e0c" />

        {/* axes */}
        <line x1={W / 2} y1={M / 2} x2={W / 2} y2={H - M / 2} stroke="#2b3445" strokeWidth={1} strokeDasharray="5 5" />
        <line x1={M / 2} y1={H / 2} x2={W - M / 2} y2={H / 2} stroke="#2b3445" strokeWidth={1} strokeDasharray="5 5" />

        {/* axis labels */}
        <text x={W / 2} y={24} fill="#7da3d9" fontSize={13} fontWeight={600} textAnchor="middle">▲ {AXIS_LABELS.top}</text>
        <text x={W / 2} y={H - 12} fill="#7da3d9" fontSize={13} fontWeight={600} textAnchor="middle">▼ {AXIS_LABELS.bottom}</text>
        <text x={14} y={H / 2 - 8} fill="#7da3d9" fontSize={13} fontWeight={600} textAnchor="start">◀ {AXIS_LABELS.left}</text>
        <text x={W - 14} y={H / 2 - 8} fill="#7da3d9" fontSize={13} fontWeight={600} textAnchor="end">{AXIS_LABELS.right} ▶</text>

        {/* clients */}
        {placed.map(({ client: c, x: cx, y: cy, r, color }) => {
          const selected = c.id === selectedId;
          return (
            <g key={c.id} style={{ cursor: "pointer" }} onClick={() => onSelect(c)}>
              {selected && <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.7} />}
              <circle
                cx={cx} cy={cy} r={r}
                fill={color}
                stroke={c.isPersona ? "#fff" : "#0b0f17"}
                strokeWidth={c.isPersona ? 2 : 1}
                opacity={c.isPersona ? 1 : 0.82}
              />
              <text
                x={cx} y={cy + r + 14}
                fill={c.isPersona ? "#e6edf6" : "#9fb0c3"}
                fontSize={c.isPersona ? 14 : 12}
                fontWeight={c.isPersona ? 600 : 400}
                textAnchor="middle"
              >
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
