import { cn } from "@/lib/utils";

export default function BarChart({
  width,
  height,
  bars,
  onBarClick,
}: {
  width: number;
  height: number;
  bars: Array<{
    key: string;
    label: string;
    value: number;
    range?: { from: string; to: string };
  }>;
  onBarClick?: (range: { from: string; to: string }) => void;
}) {
  const padding = { top: 12, right: 12, bottom: 28, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const max = Math.max(1, ...bars.map((b) => b.value));
  const bw = bars.length > 0 ? innerW / bars.length : innerW;

  function valToH(v: number): number {
    return (v / max) * innerH;
  }

  return (
    <svg
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
    >
      <g transform={`translate(${padding.left},${padding.top})`}>
        <line
          x1={0}
          x2={innerW}
          y1={innerH}
          y2={innerH}
          stroke="var(--border)"
        />
        {bars.map((b, i) => {
          const x = i * bw + 4;
          const h = valToH(b.value);
          const y = innerH - h;
          return (
            <g key={b.key}>
              <rect
                x={x}
                y={y}
                width={bw - 8}
                height={h}
                fill="var(--secondary)"
                onClick={() => b.range && onBarClick?.(b.range)}
                style={{ cursor: b.range ? "pointer" : undefined }}
              />
              <text
                x={x + (bw - 8) / 2}
                y={innerH + 16}
                fontSize={10}
                textAnchor="middle"
                className="fill-muted-foreground"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
