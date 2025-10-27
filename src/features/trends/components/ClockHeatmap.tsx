import { cn } from "@/lib/utils";
import { useState } from "react";

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function colorForValue(baseVar: string, pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `color-mix(in srgb, var(${baseVar}) ${p}%, var(--background))`;
}

export default function ClockHeatmap({
  width,
  height,
  values,
  showHourLabels = true,
}: {
  width: number;
  height: number;
  values: number[]; // 24 values, 0..100
  showHourLabels?: boolean;
}) {
  const [pinnedHour, setPinnedHour] = useState<number | null>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const size = Math.min(width, height);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.48;
  const innerR = outerR * 0.6;
  const full = 2 * Math.PI;
  const step = full / 24;
  const gap = (2 * Math.PI) / 360; // ~1 degree

  const hour = pinnedHour ?? hoverHour;
  const pctAtHour =
    hour != null
      ? Math.round(Math.max(0, Math.min(100, values[hour] ?? 0)))
      : null;

  return (
    <svg
      width={width}
      height={height}
      className={cn("bg-card w-full h-auto rounded-md")}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* base ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="var(--background)" />

      {/* slices */}
      {new Array(24).fill(0).map((_, h) => {
        const rawStart = -Math.PI / 2 + h * step;
        const rawEnd = rawStart + step;
        const start = rawStart + gap / 2;
        const end = rawEnd - gap / 2;
        const fill = colorForValue("--chart-1", values[h] ?? 0);
        const d = arcPath(cx, cy, innerR, outerR, start, end);
        const isActive = (pinnedHour ?? hoverHour) === h;
        return (
          <path
            key={h}
            d={d}
            fill={fill}
            stroke="var(--border)"
            strokeWidth={2}
            shapeRendering="crispEdges"
            style={{
              filter: isActive ? "url(#soft-shadow)" : undefined,
              cursor: "pointer",
            }}
            onMouseEnter={() => setHoverHour(h)}
            onMouseLeave={() => setHoverHour(null)}
            onClick={() => setPinnedHour((ph) => (ph === h ? null : h))}
          />
        );
      })}

      {/* hour labels */}
      {showHourLabels && (
        <g
          fontSize={10}
          fill="var(--muted-foreground)"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {new Array(24).fill(0).map((_, h) => {
            const a = -Math.PI / 2 + (h + 0.5) * step;
            const r = (innerR + outerR) / 2;
            const p = polarToCartesian(cx, cy, r, a);
            return (
              <text key={h} x={p.x} y={p.y} style={{ userSelect: "none" }}>
                {h}
              </text>
            );
          })}
        </g>
      )}

      {/* center donut */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth={2}
      />

      {/* center labels */}
      <g>
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize={14}
          fontWeight={600}
        >
          {hour != null ? `${String(hour).padStart(2, "0")}:00` : "All Hours"}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize={12}
        >
          {hour != null ? `${pctAtHour}%` : "avg per hour"}
        </text>
      </g>

      {/* cardinal ticks */}
      {([0, 6, 12, 18] as const).map((h) => {
        const a = -Math.PI / 2 + h * step;
        const p1 = polarToCartesian(cx, cy, innerR - 6, a);
        const p2 = polarToCartesian(cx, cy, innerR - 12, a);
        return (
          <line
            key={h}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="var(--border)"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
