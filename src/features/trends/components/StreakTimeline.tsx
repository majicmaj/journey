import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Segment = { start: string; end: string };

export default function StreakTimeline({
  width,
  height,
  rows,
  dates, // ordered date keys (YYYY-MM-DD)
  segmentsByRow, // Array of rows → segments [{start,end}]
  labelForRow,
  // new optional knobs
  todayKey, // defaults to last item in `dates`
  showMonthBands = true,
  showGrid = true,
  onSegmentClick, // (rowIdx, segIdx, seg) => void
}: {
  width: number;
  height: number;
  rows: number;
  dates: string[];
  segmentsByRow: Array<Array<Segment>>;
  labelForRow: (r: number) => string;
  todayKey?: string;
  showMonthBands?: boolean;
  showGrid?: boolean;
  onSegmentClick?: (rowIndex: number, segIndex: number, seg: Segment) => void;
}) {
  const padding = { top: 16, right: 8, bottom: 24, left: 100 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const rowH = innerH / Math.max(1, rows);

  // Map date -> index (memoized)
  const idxByDate = useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  // helper: convert a dateKey to x-coord
  const denom = Math.max(1, dates.length - 1);
  const dateToX = (dateKey: string): number => {
    const i = idxByDate.get(dateKey) ?? 0;
    return (i / denom) * innerW;
  };

  // helper: inclusive streak length in "days" by index distance (not real time)
  const segLength = (s: Segment) =>
    Math.abs((idxByDate.get(s.end) ?? 0) - (idxByDate.get(s.start) ?? 0)) + 1;

  // map length → color token index 1..5 (tweak buckets as you like)
  const colorIndexForLength = (len: number) => {
    if (len >= 2) return 1;
    return 2;
  };

  const today =
    todayKey ?? (dates.length ? dates[dates.length - 1] : undefined);
  const todayX = today ? dateToX(today) : undefined;

  // Tooltip state
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    row: number;
    segIndex: number;
    seg: Segment;
    len: number;
  } | null>(null);

  const hideTip = () => setTip(null);

  // Month boundaries for bands & ticks
  const monthStarts = useMemo(() => {
    return dates.map((d, i) => ({ d, i })).filter(({ d }) => d.endsWith("-01"));
  }, [dates]);

  return (
    <div className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Habit streak timeline"
        className={cn("bg-card w-full h-auto")} // no rounded corners
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Month bands (alternating) */}
          {showMonthBands &&
            monthStarts.map(({ d, i }, idx) => {
              const x = (i / denom) * innerW;
              const nextI = monthStarts[idx + 1]?.i ?? dates.length - 1; // end of month or last day
              const x2 = (nextI / denom) * innerW;
              return (
                <rect
                  key={`mb-${d}`}
                  x={x}
                  y={0}
                  width={Math.max(0, x2 - x)}
                  height={innerH}
                  fill={idx % 2 === 0 ? "var(--muted)" : "transparent"}
                  opacity={idx % 2 === 0 ? 0.25 : 1}
                />
              );
            })}

          {/* Row labels */}
          {Array.from({ length: rows }).map((_, r) => (
            <text
              key={`r${r}`}
              x={-8}
              y={r * rowH + rowH / 2 + 3}
              fontSize={11}
              textAnchor="end"
              className="fill-muted-foreground select-none"
            >
              {labelForRow(r)}
            </text>
          ))}

          {/* Optional horizontal grid lines */}
          {showGrid &&
            Array.from({ length: rows + 1 }).map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={0}
                x2={innerW}
                y1={i * rowH}
                y2={i * rowH}
                shapeRendering="crispEdges"
                stroke="var(--border)"
                opacity={0.7}
              />
            ))}

          {/* Streak segments */}
          {segmentsByRow.map((segs, r) =>
            segs.map((s, i) => {
              const x1 = dateToX(s.start);
              const x2 = dateToX(s.end);
              const x = Math.min(x1, x2);
              const w = Math.max(10, Math.abs(x2 - x1) + 10); // ensure minimum visible width
              const y = r * rowH + rowH * 0.25;
              const h = rowH * 0.5;

              const len = segLength(s);
              const cIdx = colorIndexForLength(len);
              const fill = `var(--chart-${cIdx})`;

              return (
                <g key={`${r}-${i}`}>
                  {/* Hover/focus outline (kept square) */}
                  <rect
                    x={x - 1}
                    y={y - 1}
                    width={w + 2}
                    height={h + 2}
                    fill="transparent"
                    stroke={
                      tip && tip.row === r && tip.segIndex === i
                        ? "var(--foreground)"
                        : "transparent"
                    }
                    strokeWidth={1}
                    pointerEvents="none"
                    shapeRendering="crispEdges"
                  />
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={fill}
                    shapeRendering="crispEdges" // keeps sharp corners
                    tabIndex={0}
                    aria-label={`Row ${r + 1} streak: ${s.start} to ${
                      s.end
                    }, length ${len} days`}
                    onClick={() => onSegmentClick?.(r, i, s)}
                    onMouseEnter={(e) =>
                      setTip({
                        x: e.clientX,
                        y: e.clientY,
                        row: r,
                        segIndex: i,
                        seg: s,
                        len,
                      })
                    }
                    onMouseMove={(e) =>
                      setTip((t) =>
                        t ? { ...t, x: e.clientX, y: e.clientY } : t
                      )
                    }
                    onMouseLeave={hideTip}
                    onFocus={(e) =>
                      setTip({
                        x: e.currentTarget.getBoundingClientRect().x + w / 2,
                        y: e.currentTarget.getBoundingClientRect().y,
                        row: r,
                        segIndex: i,
                        seg: s,
                        len,
                      })
                    }
                    onBlur={hideTip}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSegmentClick?.(r, i, s);
                      }
                    }}
                  />
                </g>
              );
            })
          )}

          {/* Baseline axis */}
          <line
            x1={0}
            x2={innerW}
            y1={innerH}
            y2={innerH}
            stroke="var(--border)"
            shapeRendering="crispEdges"
          />

          {/* Month ticks + labels */}
          {monthStarts.map(({ d }) => {
            const x = dateToX(d);
            const mm = Number(d.slice(5, 7));
            const mon = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ][Math.max(0, Math.min(11, mm - 1))];
            const showYear = d.endsWith("-01"); // we already know it does; add year label every Jan
            const year = d.slice(0, 4);
            return (
              <g key={`tick-${d}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={innerH}
                  stroke="var(--border)"
                  opacity={0.4}
                  shapeRendering="crispEdges"
                />
                <line
                  x1={x}
                  x2={x}
                  y1={innerH}
                  y2={innerH + 4}
                  stroke="var(--border)"
                  shapeRendering="crispEdges"
                />
                <text
                  x={x}
                  y={innerH + 16}
                  fontSize={10}
                  textAnchor="middle"
                  className="fill-muted-foreground select-none"
                >
                  {mon}
                </text>
                {mon === "Jan" && (
                  <text
                    x={x + 14}
                    y={innerH + 16}
                    fontSize={10}
                    className="fill-muted-foreground select-none"
                  >
                    {year}
                  </text>
                )}
              </g>
            );
          })}

          {/* Today marker (last date by default) */}
          {todayX != null && (
            <g>
              <line
                x1={todayX}
                x2={todayX}
                y1={0}
                y2={innerH}
                stroke="var(--foreground)"
                strokeDasharray="3,3"
                shapeRendering="crispEdges"
                opacity={0.7}
              />
              <text
                x={todayX + 4}
                y={10}
                fontSize={10}
                className="fill-foreground select-none"
              >
                Today
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Tooltip (HTML overlay for clarity & wrapping) */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border"
          style={{
            left: tip.x + 8,
            top: tip.y + 8,
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{labelForRow(tip.row)}</div>
          <div>
            {tip.seg.start} → {tip.seg.end}
          </div>
          <div className="opacity-80">
            {tip.len} day{tip.len === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
