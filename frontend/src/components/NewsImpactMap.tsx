import { useMemo } from "react";
import { THEMES } from "../data/themes";
import { scoreColor } from "../lib/format";
import type { NewsItem, NewsImpact, ThemeId } from "../types";

interface Props {
  news: NewsItem;
  impacts: NewsImpact[];
  onPick?: (impact: NewsImpact) => void;
}

const SIZE = 300;
const C = SIZE / 2;
const R = SIZE / 2 - 52;

const themeIndex = (id: ThemeId) => THEMES.findIndex((t) => t.id === id);
// same hexagon geometry as the client ValueRadar: axis 0 at top, clockwise
const angle = (i: number) => (-90 + i * (360 / THEMES.length)) * (Math.PI / 180);
const pt = (i: number, radius: number) => ({
  x: C + radius * Math.cos(angle(i)),
  y: C + radius * Math.sin(angle(i)),
});

/**
 * The news-impact map: the same value hexagon clients are profiled on, but here
 * the highlighted polygon is the *story's* theme footprint and the dots are the
 * clients it reaches — placed on the theme they're hit through, pushed out by
 * impact. The shared geometry lets an RM read news and clients in one language.
 */
export function NewsImpactMap({ news, impacts, onPick }: Props) {
  const ringPoly = (frac: number) =>
    THEMES.map((_, i) => { const p = pt(i, R * frac); return `${p.x},${p.y}`; }).join(" ");

  // story footprint: full reach on the themes it touches, near-zero elsewhere
  const footprint = THEMES.map((t) => (news.themes.includes(t.id) ? 1 : 0.06));
  const footprintPoly = footprint
    .map((w, i) => { const p = pt(i, R * w); return `${p.x},${p.y}`; })
    .join(" ");

  // place each affected client around its theme axis, spreading ties apart
  const dots = useMemo(() => {
    const byTheme = new Map<ThemeId, NewsImpact[]>();
    for (const im of impacts) {
      const arr = byTheme.get(im.theme) ?? [];
      arr.push(im);
      byTheme.set(im.theme, arr);
    }
    const placed: { im: NewsImpact; x: number; y: number }[] = [];
    for (const [theme, group] of byTheme) {
      const base = themeIndex(theme);
      const spread = 0.34; // radians of angular jitter between tied clients
      group.forEach((im, k) => {
        const off = (k - (group.length - 1) / 2) * spread;
        const a = angle(base) + off;
        const radius = R * (0.32 + 0.62 * (im.impact / 100));
        placed.push({ im, x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) });
      });
    }
    return placed;
  }, [impacts]);

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
      {/* story footprint */}
      <polygon points={footprintPoly} fill="#dd6b2022" stroke="#dd6b20" strokeWidth={1.5} strokeLinejoin="round" />
      {/* connectors from centre to each client */}
      {dots.map(({ im, x, y }) => (
        <line key={"l" + im.client.id} x1={C} y1={C} x2={x} y2={y} stroke="#2b3c5e" strokeWidth={1} opacity={0.5} />
      ))}
      {/* affected clients */}
      {dots.map(({ im, x, y }) => {
        const col = scoreColor(im.impact);
        const r = 5 + (im.impact / 100) * 6;
        return (
          <g key={im.client.id} onClick={() => onPick?.(im)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <circle cx={x} cy={y} r={r} fill={col + "cc"} stroke={col} strokeWidth={1.5} />
            <text x={x} y={y - r - 4} fill="#cdd8e6" fontSize={11} fontWeight={600} textAnchor="middle">
              {im.client.name}
            </text>
          </g>
        );
      })}
      {/* theme labels */}
      {THEMES.map((t, i) => {
        const p = pt(i, R + 24);
        const lit = news.themes.includes(t.id);
        return (
          <text
            key={t.id}
            x={p.x}
            y={p.y}
            fill={lit ? "#e6edf6" : "#5a6678"}
            fontSize={lit ? 16 : 13}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {t.emoji}
          </text>
        );
      })}
    </svg>
  );
}
