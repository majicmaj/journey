import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type LinePoint = { x: string; y: number };
export type LineSeries = { name: string; color: string; points: LinePoint[] };

export default function LineChart({
  width,
  height,
  series,
  goalBands,
  onBrush,
}: {
  width: number;
  height: number;
  series: LineSeries[];
  goalBands?: Array<{ from: number; to: number; colorVar?: string }>;
  onBrush?: (fromX: string, toX: string) => void;
}) {
  const padding = { top: 12, right: 12, bottom: 22, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const allX = useMemo(
    () =>
      Array.from(
        new Set(series.flatMap((s) => s.points.map((p) => p.x)))
      ).sort(),
    [series]
  );
  const xDomain = allX;

  const allY = useMemo(
    () => series.flatMap((s) => s.points.map((p) => p.y)),
    [series]
  );
  const yMin = Math.min(0, ...allY);
  const yMax = Math.max(100, ...allY);

  function xToPx(x: string): number {
    const i = xDomain.indexOf(x);
    return i < 0 || xDomain.length <= 1
      ? 0
      : (i / (xDomain.length - 1)) * innerW;
  }
  function yToPx(y: number): number {
    const t = (y - yMin) / Math.max(1e-6, yMax - yMin);
    return innerH - t * innerH;
  }

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    const bounds = svgRef.current?.getBoundingClientRect();
    const x = e.clientX - (bounds?.left ?? 0) - padding.left;
    setDrag({
      x0: Math.max(0, Math.min(innerW, x)),
      x1: Math.max(0, Math.min(innerW, x)),
    });
  }
  function onMouseMove(e: React.MouseEvent) {
    const bounds = svgRef.current?.getBoundingClientRect();
    const x = e.clientX - (bounds?.left ?? 0) - padding.left;
    const clamped = Math.max(0, Math.min(innerW, x));
    setHoverX(clamped);
    if (drag) {
      setDrag((d) => (d ? { ...d, x1: clamped } : d));
    }
  }
  function onMouseUp() {
    if (!drag) return;
    const [a, b] = [Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)];
    if (b - a > 8) {
      const i0 = Math.round((a / innerW) * (xDomain.length - 1));
      const i1 = Math.round((b / innerW) * (xDomain.length - 1));
      const fromX = xDomain[Math.max(0, Math.min(i0, i1))];
      const toX = xDomain[Math.max(0, Math.max(i0, i1))];
      onBrush?.(fromX, toX);
    }
    setDrag(null);
  }
  function onMouseLeave() {
    setHoverX(null);
    if (drag) setDrag(null);
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <g transform={`translate(${padding.left},${padding.top})`}>
        {goalBands?.map((b, i) => (
          <rect
            key={i}
            x={0}
            y={yToPx(b.to)}
            width={innerW}
            height={Math.max(0, yToPx(b.from) - yToPx(b.to))}
            fill={`color-mix(in srgb, var(${
              b.colorVar ?? "--secondary"
            }) 12%, var(--background))`}
          />
        ))}

        {series.map((s, idx) => {
          const path = s.points
            .filter((p) => xDomain.includes(p.x))
            .map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.x)},${yToPx(p.y)}`)
            .join(" ");
          return (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}

        {/* simple x/y axes ticks */}
        <line
          x1={0}
          x2={innerW}
          y1={innerH}
          y2={innerH}
          stroke="var(--border)"
        />
        <line x1={0} x2={0} y1={0} y2={innerH} stroke="var(--border)" />

        {xDomain.map((x) => (
          <text
            key={x}
            x={xToPx(x)}
            y={innerH + 16}
            fontSize={10}
            textAnchor="middle"
            className="fill-muted-foreground"
          >
            {x.slice(5)}
          </text>
        ))}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={-4}
              x2={0}
              y1={yToPx(v)}
              y2={yToPx(v)}
              stroke="var(--border)"
            />
            <text
              x={-8}
              y={yToPx(v) + 3}
              fontSize={10}
              textAnchor="end"
              className="fill-muted-foreground"
            >
              {v}
            </text>
          </g>
        ))}

        {drag && (
          <rect
            x={Math.min(drag.x0, drag.x1)}
            y={0}
            width={Math.abs(drag.x1 - drag.x0)}
            height={innerH}
            fill="color-mix(in srgb, var(--secondary) 16%, transparent)"
          />
        )}

        {/* Hover crosshair and tooltip */}
        {hoverX != null &&
          xDomain.length > 0 &&
          (() => {
            const i = Math.round((hoverX / innerW) * (xDomain.length - 1));
            const idx = Math.max(0, Math.min(xDomain.length - 1, i));
            const xKey = xDomain[idx];
            const xPx = xToPx(xKey);
            const seriesAtX = series.map((s) => {
              const pt = s.points.find((p) => p.x === xKey);
              return { name: s.name, color: s.color, y: pt ? pt.y : NaN };
            });
            const markers = seriesAtX.filter((v) => Number.isFinite(v.y));
            const tooltipLines = [
              xKey,
              ...seriesAtX.map((v) => `${v.name}: ${Math.round(v.y)}%`),
            ];
            const boxW = 180;
            const boxH = 18 * tooltipLines.length + 10;
            const boxX = Math.max(0, Math.min(innerW - boxW, xPx + 8));
            const boxY = 8;
            return (
              <g>
                {/* vertical line */}
                <line
                  x1={xPx}
                  x2={xPx}
                  y1={0}
                  y2={innerH}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                {/* markers */}
                {markers.map((m, mi) => (
                  <circle
                    key={mi}
                    cx={xPx}
                    cy={yToPx(m.y)}
                    r={3}
                    fill={m.color}
                  />
                ))}
                {/* tooltip */}
                <g transform={`translate(${boxX},${boxY})`}>
                  <rect
                    width={boxW}
                    height={boxH}
                    rx={4}
                    fill="var(--popover)"
                    stroke="var(--border)"
                  />
                  {tooltipLines.map((t, ti) => (
                    <text
                      key={ti}
                      x={8}
                      y={16 + ti * 18}
                      fontSize={12}
                      fill="var(--foreground)"
                    >
                      {t}
                    </text>
                  ))}
                </g>
              </g>
            );
          })()}
      </g>
    </svg>
  );
}
