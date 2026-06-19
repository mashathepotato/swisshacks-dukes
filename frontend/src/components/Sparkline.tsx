interface Props {
  values: number[];
  upTo: number; // draw up to this index (inclusive)
  color: string;
  min: number;
  max: number;
  width?: number;
  height?: number;
}

export function Sparkline({ values, upTo, color, min, max, width = 240, height = 54 }: Props) {
  const pad = 4;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - 2 * pad);
  const shown = values.slice(0, upTo + 1);
  const d = shown.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const lastX = x(upTo), lastY = y(values[upTo]);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`${d} L${lastX},${height - pad} L${pad},${height - pad} Z`} fill={color + "1f"} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}
