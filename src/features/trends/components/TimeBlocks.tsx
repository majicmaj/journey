import { cn } from "@/lib/utils";

export type TimeBlock = {
  row: number; // 0-based row index
  fromMin: number; // 0..1440
  toMin: number; // 0..1440, >= fromMin
  color?: string; // CSS color
  label?: string; // optional aria label
};

export default function TimeBlocks({
  width,
  height,
  rows,
  rowLabelAt,
  blocks,
}: {
  width: number;
  height: number;
  rows: number;
  rowLabelAt: (r: number) => string;
  blocks: TimeBlock[];
}) {
  const padding = { top: 12, right: 12, bottom: 28, left: 80 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const rowH = innerH / Math.max(1, rows);

  // minute → x (0..1440)
  const minToX = (m: number) =>
    (Math.max(0, Math.min(1440, m)) / 1440) * innerW;
  const snap = (v: number) => Math.round(v) + 0.5;

  // hours labels (every 3h to reduce clutter on small screens)
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <svg
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
    >
      <g transform={`translate(${padding.left},${padding.top})`}>
        {/* axes */}
        <line
          x1={snap(0)}
          x2={snap(innerW)}
          y1={snap(innerH)}
          y2={snap(innerH)}
          stroke="var(--border)"
          shapeRendering="crispEdges"
        />

        {/* hour grid */}
        {Array.from({ length: 25 }).map((_, i) => (
          <line
            key={`hg-${i}`}
            x1={snap(minToX(i * 60))}
            x2={snap(minToX(i * 60))}
            y1={0}
            y2={innerH}
            stroke="var(--border)"
            strokeOpacity={i % 3 === 0 ? 0.6 : 0.25}
            shapeRendering="crispEdges"
          />
        ))}

        {/* row separators */}
        {Array.from({ length: rows + 1 }).map((_, r) => (
          <line
            key={`rs-${r}`}
            x1={0}
            x2={innerW}
            y1={snap(r * rowH)}
            y2={snap(r * rowH)}
            stroke="var(--border)"
            shapeRendering="crispEdges"
          />
        ))}

        {/* row labels */}
        {Array.from({ length: rows }).map((_, r) => (
          <text
            key={`rl-${r}`}
            x={-8}
            y={r * rowH + rowH / 2 + 3}
            fontSize={10}
            textAnchor="end"
            className="fill-muted-foreground select-none"
          >
            {rowLabelAt(r)}
          </text>
        ))}

        {/* hour labels */}
        {hourTicks.map((h) => (
          <text
            key={`hl-${h}`}
            x={minToX(h * 60)}
            y={innerH + 16}
            fontSize={10}
            textAnchor="middle"
            className="fill-muted-foreground select-none"
          >
            {String(h).padStart(2, "0")}
          </text>
        ))}

        {/* blocks */}
        {blocks.map((b, i) => {
          const x = Math.round(minToX(b.fromMin));
          const x2 = Math.round(minToX(b.toMin));
          const w = Math.max(1, x2 - x);
          const y = Math.round(b.row * rowH + 2);
          const h = Math.max(1, Math.round(rowH - 4));
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={b.color ?? "var(--secondary)"}
              shapeRendering="crispEdges"
              tabIndex={0}
              aria-label={
                b.label ??
                `Row ${b.row}, ${Math.round((b.toMin - b.fromMin) / 60)}h`
              }
            />
          );
        })}
      </g>
    </svg>
  );
}
