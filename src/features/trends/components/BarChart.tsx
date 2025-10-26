import { useRef, useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

export default function BarChart({
  width,
  height,
  bars,
  onBarClick,
}: {
  width: number;
  height: number;
  bars: Array<{
    key: string;
    label: string;
    value: number;
    range?: { from: string; to: string };
  }>;
  onBarClick?: (range: { from: string; to: string }) => void;
}) {
  const padding = { top: 12, right: 12, bottom: 28, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const max = Math.max(1, ...bars.map((b) => b.value));
  const n = Math.max(1, bars.length);
  // pixel-friendly sizing: leave a 1px gap between bars when possible
  const gap = 1;
  const bw = Math.floor((innerW - (n - 1) * gap) / n);
  const totalUsed = bw * n + gap * (n - 1);
  const xOffset = Math.floor((innerW - totalUsed) / 2); // center bars

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // snap to pixel grid (half-pixel for crisp 1/3px strokes; we draw fills on integers)
  const snap = (v: number) => Math.round(v) + 0.5;
  const iToX = (i: number) => xOffset + i * (bw + gap);
  const valToH = (v: number) => Math.round((v / max) * innerH);

  type Tip = {
    screenX: number;
    screenY: number;
    i: number;
  } | null;
  const [tip, setTip] = useState<Tip>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // rAF throttle
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
        const gx = (rect?.left ?? 0) + padding.left;
        const lx = p.clientX - gx;
        // hit-test which bar we’re over
        let idx = -1;
        for (let i = 0; i < n; i++) {
          const x = iToX(i);
          if (lx >= x && lx <= x + bw) {
            idx = i;
            break;
          }
        }
        if (idx >= 0) {
          setHoverIdx(idx);
          setTip({ screenX: p.clientX, screenY: p.clientY, i: idx });
        } else {
          setHoverIdx(null);
          setTip(null);
        }
      });
    }
  };
  useLayoutEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onLeave = () => {
    setHoverIdx(null);
    setTip(null);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        className={cn("bg-card w-full h-auto rounded-md")}
        onPointerMove={handleMove}
        onPointerLeave={onLeave}
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
          {bars.map((b, i) => {
            const x = iToX(i);
            const h = valToH(b.value);
            const y = innerH - h;

            return (
              <g key={b.key}>
                {/* bar fill (aligned to integer pixels) */}
                <rect
                  x={Math.round(x)}
                  y={Math.round(y)}
                  width={Math.max(0, Math.round(bw))}
                  height={Math.max(0, Math.round(h))}
                  fill="var(--secondary)"
                  shapeRendering="crispEdges"
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.label}: ${Math.round(b.value)}${
                    Number.isFinite(b.value) ? "%" : ""
                  }`}
                  onClick={() => b.range && onBarClick?.(b.range)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (b.range) onBarClick?.(b.range);
                    }
                  }}
                  onPointerEnter={() => setHoverIdx(i)}
                />

                {/* 3px “pixel” outline on hover/focus */}
                {hoverIdx === i && (
                  <rect
                    x={snap(x) - 1}
                    y={snap(y) - 1}
                    width={Math.max(0, Math.round(bw)) + 1}
                    height={Math.max(0, Math.round(h)) + 1}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeLinejoin="miter"
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                    shapeRendering="crispEdges"
                    pointerEvents="none"
                  />
                )}

                {/* x label */}
                <text
                  x={x + bw / 2}
                  y={innerH + 16}
                  fontSize={10}
                  textAnchor="middle"
                  className="fill-muted-foreground select-none"
                >
                  {b.label}
                </text>
              </g>
            );
          })}

          {/* y ticks (0..100 like your other charts; change as needed) */}
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

      {/* Fixed, bounds-aware tooltip */}
      {tip && bars[tip.i] && (
        <div
          className="pointer-events-none fixed z-50 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md"
          style={{
            left: Math.min(tip.screenX + 16, window.innerWidth - 240),
            top: Math.min(tip.screenY + 16, window.innerHeight - 120),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{bars[tip.i].label}</div>
          <div>Avg: {Math.round(bars[tip.i].value)}%</div>
          {bars[tip.i].range && (
            <div className="opacity-80">
              {bars[tip.i].range!.from} → {bars[tip.i].range!.to}
            </div>
          )}
          {bars[tip.i].range && (
            <div className="opacity-70">(click to drill)</div>
          )}
        </div>
      )}
    </div>
  );
}
