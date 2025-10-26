import { cn } from "@/lib/utils";

export default function StreakTimeline({
  width,
  height,
  rows,
  dates,
  segmentsByRow,
  labelForRow,
}: {
  width: number;
  height: number;
  rows: number;
  dates: string[]; // ordered date keys
  segmentsByRow: Array<Array<{ start: string; end: string }>>;
  labelForRow: (r: number) => string;
}) {
  const padding = { top: 16, right: 12, bottom: 28, left: 100 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const rowH = innerH / Math.max(1, rows);

  const idxByDate = new Map<string, number>();
  dates.forEach((d, i) => idxByDate.set(d, i));

  function dateToX(dateKey: string): number {
    const i = idxByDate.get(dateKey) ?? 0;
    return (i / Math.max(1, dates.length - 1)) * innerW;
  }

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
            x={-8}
            y={r * rowH + rowH / 2 + 3}
            fontSize={11}
            textAnchor="end"
          >
            {labelForRow(r)}
          </text>
        ))}

        {segmentsByRow.map((segs, r) =>
          segs.map((s, i) => {
            const x1 = dateToX(s.start);
            const x2 = dateToX(s.end);
            const y = r * rowH + rowH * 0.25;
            const h = rowH * 0.5;
            return (
              <rect
                key={`${r}-${i}`}
                x={Math.min(x1, x2)}
                y={y}
                width={Math.max(2, Math.abs(x2 - x1))}
                height={h}
                rx={2}
                fill="var(--secondary)"
              />
            );
          })
        )}
      </g>
    </svg>
  );
}
