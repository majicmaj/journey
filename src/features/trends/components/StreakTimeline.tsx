import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { FireIcon } from "@/components/pixel/icons";

type Segment = { start: string; end: string };

type TipState = {
  // container-local (for tooltip and date mapping)
  localX: number;
  localY: number;
  row: number;
  segIndex: number;
  seg: Segment;
  len: number;
  hoveredDate: string | null;
  hoveredIndex: number | null;
  dayIndexInStreak: number | null; // 0-based within this segment, if inside
} | null;

export default function StreakTimeline({
  width,
  height,
  rows,
  dates, // ordered YYYY-MM-DD
  segmentsByRow, // Array<row -> Segment[]>
  labelForRow,
  todayKey, // defaults to last date
  showMonthBands = true,
  showGrid = true,
  onSegmentClick,
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
  const padding = { top: 16, right: 36, bottom: 24, left: 100 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const rowH = innerH / Math.max(1, rows);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Map date -> index
  const idxByDate = useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  const denom = Math.max(1, dates.length - 1);
  const dateToX = (dateKey: string): number => {
    const i = idxByDate.get(dateKey) ?? 0;
    return (i / denom) * innerW;
  };

  // index distance + 1 (visual day count)
  const segLength = (s: Segment) =>
    Math.abs((idxByDate.get(s.end) ?? 0) - (idxByDate.get(s.start) ?? 0)) + 1;

  const colorIndexForLength = (len: number) => (len >= 2 ? 1 : 2);

  const today =
    todayKey ?? (dates.length ? dates[dates.length - 1] : undefined);
  const todayX = today ? dateToX(today) : undefined;

  // month starts (YYYY-MM-01)
  const monthStarts = useMemo(
    () => dates.map((d, i) => ({ d, i })).filter(({ d }) => d.endsWith("-01")),
    [dates]
  );

  // Tooltip state
  const [tip, setTip] = useState<TipState>(null);

  // rAF throttle for pointermove
  const pendingRef = useRef<number | null>(null);
  const queuedRef = useRef<{
    e: PointerEvent;
    r: number;
    i: number;
    s: Segment;
  } | null>(null);

  const computeLocal = (clientX: number, clientY: number) => {
    const gLeft =
      (wrapperRef.current?.getBoundingClientRect().left ?? 0) + padding.left;
    const gTop =
      (wrapperRef.current?.getBoundingClientRect().top ?? 0) + padding.top;
    // local coords inside inner chart area
    const x = Math.max(0, Math.min(innerW, clientX - gLeft));
    const y = Math.max(0, Math.min(innerH, clientY - gTop));
    return { x, y };
  };

  const xToDateIndex = (x: number) => {
    const t = innerW <= 0 ? 0 : x / innerW;
    const idx = Math.round(t * denom);
    return Math.max(0, Math.min(dates.length - 1, idx));
  };

  const updateTipFromEvent = (
    e: PointerEvent,
    r: number,
    i: number,
    s: Segment
  ) => {
    const { x: localX, y: localY } = computeLocal(e.clientX, e.clientY);
    const hoveredIndex = xToDateIndex(localX);
    const hoveredDate = dates[hoveredIndex] ?? null;

    const startIdx = idxByDate.get(s.start) ?? null;
    const endIdx = idxByDate.get(s.end) ?? null;
    let dayIndexInStreak: number | null = null;
    if (
      startIdx != null &&
      endIdx != null &&
      hoveredIndex != null &&
      hoveredDate != null
    ) {
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      if (hoveredIndex >= lo && hoveredIndex <= hi) {
        dayIndexInStreak = hoveredIndex - lo; // 0-based within streak
      }
    }

    setTip({
      localX,
      localY,
      row: r,
      segIndex: i,
      seg: s,
      len: segLength(s),
      hoveredDate,
      hoveredIndex,
      dayIndexInStreak,
    });
  };

  const onPointerMoveThrottled = (
    e: React.PointerEvent,
    r: number,
    i: number,
    s: Segment
  ) => {
    const native = e.nativeEvent as PointerEvent;
    queuedRef.current = { e: native, r, i, s };
    if (pendingRef.current == null) {
      pendingRef.current = requestAnimationFrame(() => {
        pendingRef.current = null;
        const q = queuedRef.current;
        if (q) updateTipFromEvent(q.e, q.r, q.i, q.s);
      });
    }
  };

  useLayoutEffect(() => {
    return () => {
      if (pendingRef.current != null) cancelAnimationFrame(pendingRef.current);
    };
  }, []);

  const hideTip = () => setTip(null);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Habit streak timeline"
        className={cn("bg-card w-full h-auto")}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Month bands */}
          {showMonthBands &&
            monthStarts.map(({ d, i }, idx) => {
              const x = (i / denom) * innerW;
              const nextI = monthStarts[idx + 1]?.i ?? dates.length - 1;
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

          {/* Grid */}
          {showGrid &&
            Array.from({ length: rows + 1 }).map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={0}
                x2={innerW + 16}
                y1={i * rowH}
                y2={i * rowH}
                shapeRendering="crispEdges"
                stroke="var(--border)"
                opacity={0.7}
              />
            ))}

          {/* Segments */}
          {segmentsByRow.map((segs, r) =>
            segs.map((s, i) => {
              const x1 = dateToX(s.start);
              const x2 = dateToX(s.end);
              const x = Math.min(x1, x2);
              const w = Math.max(10, Math.abs(x2 - x1) + 10);
              const y = r * rowH + rowH * 0.25;
              const h = rowH * 0.5;

              const len = segLength(s);
              const cIdx = colorIndexForLength(len);
              const fill = `var(--chart-${cIdx})`;

              return (
                <g key={`${r}-${i}`}>
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
                    shapeRendering="crispEdges"
                    tabIndex={0}
                    aria-label={`Row ${r + 1} streak: ${s.start} to ${
                      s.end
                    }, length ${len} days`}
                    onClick={() => onSegmentClick?.(r, i, s)}
                    onPointerEnter={(e) => {
                      (e.currentTarget as Element).setPointerCapture?.(
                        e.pointerId
                      );
                      updateTipFromEvent(e.nativeEvent, r, i, s);
                    }}
                    onPointerMove={(e) => onPointerMoveThrottled(e, r, i, s)}
                    onPointerLeave={(e) => {
                      (e.currentTarget as Element).releasePointerCapture?.(
                        e.pointerId
                      );
                      hideTip();
                    }}
                    onFocus={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      // center-top of segment for keyboard
                      const cx = rect.left + rect.width / 2;
                      const cy = rect.top + 2;
                      updateTipFromEvent(
                        // synthesize a PointerEvent-like bag
                        { clientX: cx, clientY: cy } as PointerEvent,
                        r,
                        i,
                        s
                      );
                    }}
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

          {/* Month ticks/labels */}
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

          {/* Today marker */}
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
                x={todayX - 12}
                y={-8}
                fontSize={10}
                className="fill-foreground select-none"
              >
                Today
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Tooltip — container-relative like HeatmapMatrix */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md"
          style={{
            left: Math.min(padding.left + tip.localX + 12, width - 220),
            top: Math.min(padding.top + tip.localY + 12, height - 80),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{labelForRow(tip.row)}</div>
          <div className="opacity-90">
            {tip.hoveredDate ? `Date: ${tip.hoveredDate}` : `Date: —`}
          </div>
          <div className="flex items-center gap-1">
            <FireIcon className="size-4 text-chart-1" />
            {tip.seg.start} → {tip.seg.end}
          </div>
          <div className="opacity-80">
            {tip.len} day{tip.len === 1 ? "" : "s"}
            {tip.dayIndexInStreak != null &&
              ` • Day ${tip.dayIndexInStreak + 1} in this streak`}
          </div>
        </div>
      )}
    </div>
  );
}
