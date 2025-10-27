import { cn } from "@/lib/utils";

export type StackedPoint = {
  x: string; // categorical x (e.g., date)
  segments: Array<{ key: string; value: number; color: string }>;
};

export default function StackedBarChart({
  width,
  height,
  data,
}: {
  width: number;
  height: number;
  data: StackedPoint[];
}) {
  const padding = { top: 12, right: 12, bottom: 28, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const totals = data.map((d) =>
    Math.max(
      0,
      d.segments.reduce((a, s) => a + (s.value || 0), 0)
    )
  );
  const max = Math.max(1, ...totals);

  const n = Math.max(1, data.length);
  const gap = 1;
  const bw = Math.floor((innerW - (n - 1) * gap) / n);
  const totalUsed = bw * n + gap * (n - 1);
  const xOffset = Math.floor((innerW - totalUsed) / 2);

  const iToX = (i: number) => xOffset + i * (bw + gap);
  const valToH = (v: number) => Math.round((v / max) * innerH);
  const snap = (v: number) => Math.round(v) + 0.5;

  return (
    <svg
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
    >
      <g transform={`translate(${padding.left},${padding.top})`}>
        {/* x-axis */}
        <line
          x1={snap(0)}
          x2={snap(innerW)}
          y1={snap(innerH)}
          y2={snap(innerH)}
          stroke="var(--border)"
          shapeRendering="crispEdges"
        />

        {/* bars */}
        {data.map((d, i) => {
          const x = iToX(i);
          let acc = 0;
          return (
            <g key={d.x}>
              {d.segments.map((s, j) => {
                const h = valToH(s.value || 0);
                const y = innerH - (acc + h);
                acc += h;
                return (
                  <rect
                    key={`${d.x}-${s.key}-${j}`}
                    x={Math.round(x)}
                    y={Math.round(y)}
                    width={Math.max(0, Math.round(bw))}
                    height={Math.max(0, Math.round(h))}
                    fill={s.color}
                    shapeRendering="crispEdges"
                  />
                );
              })}

              {/* x label */}
              <text
                x={x + bw / 2}
                y={innerH + 16}
                fontSize={10}
                textAnchor="middle"
                className="fill-muted-foreground select-none"
              >
                {d.x.slice(5)}
              </text>
            </g>
          );
        })}

        {/* y ticks */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = innerH - (v / Math.max(1, 100)) * innerH;
          return (
            <g key={v}>
              <line
                x1={snap(-4)}
                x2={snap(0)}
                y1={snap(y)}
                y2={snap(y)}
                stroke="var(--border)"
                shapeRendering="crispEdges"
              />
              <text
                x={-8}
                y={y + 3}
                fontSize={10}
                textAnchor="end"
                className="fill-muted-foreground select-none"
              >
                {v}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
