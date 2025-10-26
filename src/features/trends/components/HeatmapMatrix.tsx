import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type HeatmapProps = {
  width: number;
  height: number;
  rows: number; // e.g., 7 for Mon..Sun (or Sun..Sat)
  cols: number; // number of weeks
  valueAt: (r: number, c: number) => number; // 0..100
  labelForCol: (c: number) => string; // e.g., week label
  labelForRow: (r: number) => string; // weekday label

  // NEW (optional) ways to provide exact dates:
  /** If provided, used directly to display the cell's actual date (YYYY-MM-DD). */
  dateForCell?: (r: number, c: number) => string | undefined;

  /** If you have week starts, we can derive dates as start + r days. (YYYY-MM-DD) */
  startOfWeekForCol?: (c: number) => string | undefined;

  /** Set to 0 if r=0 corresponds to Sunday; 1 if r=0 is Monday, etc. (default 0) */
  weekdayIndexStartsAt?: number;

  /** Show alternating week bands for readability (default true) */
  showWeekBands?: boolean;

  /** Show grid lines (default true) */
  showGrid?: boolean;

  /** Optional click */
  onCellClick?: (r: number, c: number) => void;

  /** For “today” marker/highlight; default: auto-detect via today’s ISO date if available */
  todayKey?: string;
};

export default function HeatmapMatrix({
  width,
  height,
  rows,
  cols,
  valueAt,
  labelForCol,
  labelForRow,
  dateForCell,
  startOfWeekForCol,
  weekdayIndexStartsAt = 0,
  showWeekBands = true,
  showGrid = true,
  onCellClick,
  todayKey,
}: HeatmapProps) {
  const padding = { top: 16, right: 12, bottom: 28, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const cellW = innerW / Math.max(1, cols);
  const cellH = innerH / Math.max(1, rows);

  // ---- date helpers (no libs) ----
  const toDate = (iso: string) => new Date(iso + "T00:00:00");
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (iso: string, days: number) => {
    const d = toDate(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
  };

  // If dateForCell not provided, try deriving from startOfWeekForCol + row offset
  const computeDateForCell = (r: number, c: number): string | undefined => {
    if (dateForCell) return dateForCell(r, c);
    const start = startOfWeekForCol?.(c);
    if (!start) return undefined;
    // Row r represents weekday offset from start (consider weekdayIndexStartsAt)
    // If r=0 means Monday and start is Monday, offset=r; if r=0 means Sunday, offset=r, etc.
    return addDays(start, r - weekdayIndexStartsAt);
  };

  // Today detection (for subtle cell outline)
  const todayISO = todayKey ?? toISO(new Date());

  // value → color bucket (square edges; map to your theme tokens)
  const colorFor = (v: number) =>
    `color-mix(in srgb, var(--chart-1) ${v}%, var(--background))`;

  // Tooltip state: we keep cell (r,c) AND a cursor position that follows anywhere
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Keep edges crisp
  const crisp = { shapeRendering: "crispEdges" as const };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseMove={handleMouseMove}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Weekday performance heatmap"
        className={cn("bg-card w-full h-auto")} // no rounded corners
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Optional alternating week bands */}
          {showWeekBands &&
            Array.from({ length: cols }).map((_, c) => (
              <rect
                key={`wb-${c}`}
                x={c * cellW}
                y={0}
                width={cellW}
                height={innerH}
                fill={c % 2 === 0 ? "var(--muted)" : "transparent"}
                opacity={c % 2 === 0 ? 0.2 : 1}
                {...crisp}
              />
            ))}

          {/* Row labels (weekdays) */}
          {Array.from({ length: rows }).map((_, r) => (
            <text
              key={`r${r}`}
              x={-6}
              y={r * cellH + cellH / 2 + 3}
              fontSize={10}
              textAnchor="end"
              className="fill-muted-foreground select-none"
            >
              {labelForRow(r)}
            </text>
          ))}

          {/* Column labels (weeks) */}
          {Array.from({ length: cols }).map((_, c) => (
            <text
              key={`c${c}`}
              x={c * cellW + cellW / 2}
              y={innerH + 16}
              fontSize={10}
              textAnchor="middle"
              className="fill-muted-foreground select-none"
            >
              {labelForCol(c)}
            </text>
          ))}

          {/* Cells */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const v = Math.max(0, Math.min(100, valueAt(r, c)));
              const iso = computeDateForCell(r, c);
              const isToday = iso === todayISO;

              const x = c * cellW + 2;
              const y = r * cellH + 2;
              const w = Math.max(1, cellW - 6);
              const h = Math.max(1, cellH - 6);

              return (
                <g key={`${r}-${c}`}>
                  {isToday && (
                    <rect
                      x={x - 1}
                      y={y - 1}
                      width={w + 2}
                      height={h + 2}
                      fill="transparent"
                      stroke="var(--foreground)"
                      strokeWidth={1}
                      opacity={0.7}
                      pointerEvents="none"
                      {...crisp}
                    />
                  )}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={colorFor(v)}
                    stroke="var(--border)"
                    strokeWidth={2}
                    tabIndex={0}
                    aria-label={`${labelForRow(r)} ${labelForCol(c)}${
                      iso ? ` (${iso})` : ""
                    }: ${Math.round(v)}%`}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ r, c })}
                    onBlur={() => setHover(null)}
                    onClick={() => onCellClick?.(r, c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onCellClick?.(r, c);
                      }
                    }}
                    {...crisp}
                  />
                </g>
              );
            })
          )}
        </g>
      </svg>

      {/* HTML tooltip that follows the cursor ANYWHERE (within container) */}
      {hover && mousePos && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border"
          style={{
            left: Math.min(mousePos.x + 12, width - 170), // keep on canvas
            top: Math.min(mousePos.y + 12, height - 60),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          {(() => {
            const { r, c } = hover;
            const v = Math.round(Math.max(0, Math.min(100, valueAt(r, c))));
            const iso = computeDateForCell(r, c);
            return (
              <>
                <div className="font-medium mb-0.5">
                  {labelForRow(r)} • {iso ?? labelForCol(c)}
                </div>
                {iso && (
                  <div className="opacity-80 mb-0.5">{labelForCol(c)}</div>
                )}
                <div className="opacity-90">{v}%</div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
