import { cn } from "@/lib/utils";

export default function HeatmapMatrix({
  width,
  height,
  rows,
  cols,
  valueAt,
  labelForCol,
  labelForRow,
}: {
  width: number;
  height: number;
  rows: number; // e.g., 7 for weekdays
  cols: number; // number of weeks
  valueAt: (r: number, c: number) => number; // 0..100
  labelForCol: (c: number) => string;
  labelForRow: (r: number) => string;
}) {
  const padding = { top: 16, right: 12, bottom: 28, left: 24 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const cellW = innerW / Math.max(1, cols);
  const cellH = innerH / Math.max(1, rows);

  return (
    <svg
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
    >
      <g transform={`translate(${padding.left},${padding.top})`}>
        {Array.from({ length: rows }).map((_, r) => (
          <text
            key={`r${r}`}
            x={-6}
            y={r * cellH + cellH / 2 + 3}
            fontSize={10}
            textAnchor="end"
            className="fill-muted-foreground"
          >
            {labelForRow(r)}
          </text>
        ))}
        {Array.from({ length: cols }).map((_, c) => (
          <text
            key={`c${c}`}
            x={c * cellW + cellW / 2}
            y={innerH + 16}
            fontSize={10}
            textAnchor="middle"
            className="fill-muted-foreground"
          >
            {labelForCol(c)}
          </text>
        ))}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const v = Math.max(0, Math.min(100, valueAt(r, c)));
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellW + 2}
                y={r * cellH + 2}
                width={cellW - 8}
                height={cellH - 8}
                fill={`color-mix(in srgb, var(--secondary) ${v}%, var(--background))`}
                stroke="var(--border)"
                strokeWidth={3}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}
