import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

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

  // Tooltip state (container-relative like HeatmapMatrix)
  type Tip = {
    row: number;
    fromMin: number;
    toMin: number;
    label?: string;
    color?: string;
  } | null;
  const [tip, setTip] = useState<Tip>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const queuedRef = useRef<PointerEvent | null>(null);

  const handleMove = (e: React.PointerEvent) => {
    const ev = e.nativeEvent as PointerEvent;
    queuedRef.current = ev;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const p = queuedRef.current;
        if (!p) return;
        const rect = wrapperRef.current?.getBoundingClientRect();
        const cx = p.clientX - (rect?.left ?? 0);
        const cy = p.clientY - (rect?.top ?? 0);
        setMousePos({ x: cx, y: cy });
      });
    }
  };
  useLayoutEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toTime = (m: number) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        className={cn("bg-card w-full h-auto rounded-md")}
        onPointerMove={handleMove}
        onPointerLeave={() => {
          setTip(null);
          setMousePos(null);
        }}
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
              <g key={i}>
                <rect
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
                  onPointerEnter={(e) => {
                    const target = e.currentTarget as SVGRectElement;
                    target.setAttribute("stroke", "var(--border)");
                    target.setAttribute("stroke-width", "1");
                    const native = e.nativeEvent as PointerEvent;
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    const cx = native.clientX - (rect?.left ?? 0);
                    const cy = native.clientY - (rect?.top ?? 0);
                    setMousePos({ x: cx, y: cy });
                    setTip({
                      row: b.row,
                      fromMin: b.fromMin,
                      toMin: b.toMin,
                      ...(b.label != null ? { label: b.label } : {}),
                      ...(b.color != null ? { color: b.color } : {}),
                    });
                  }}
                  onPointerLeave={(e) => {
                    const target = e.currentTarget as SVGRectElement;
                    target.removeAttribute("stroke");
                    target.removeAttribute("stroke-width");
                    setTip(null);
                    setMousePos(null);
                  }}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Container-relative, bounds-aware tooltip */}
      {tip && mousePos && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md"
          style={{
            left: Math.min(mousePos.x + 12, width - 240),
            top: Math.min(mousePos.y + 12, height - 120),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{rowLabelAt(tip.row)}</div>
          <div className="flex items-center gap-3">
            {tip.color && (
              <span
                aria-hidden
                style={{ background: tip.color, width: 8, height: 8 }}
                className="inline-block"
              />
            )}
            <span>
              {toTime(tip.fromMin)} – {toTime(tip.toMin)}
            </span>
            <span className="opacity-80">
              ({Math.max(0, tip.toMin - tip.fromMin)}m)
            </span>
          </div>
          {tip.label && <div className="opacity-80 mt-0.5">{tip.label}</div>}
        </div>
      )}
    </div>
  );
}
