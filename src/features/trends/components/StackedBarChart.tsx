import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

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

  // Tooltip state
  type Tip = {
    screenX: number;
    screenY: number;
    i: number; // bar index
    segIndex: number | null; // hovered segment index within bar
  } | null;
  const [tip, setTip] = useState<Tip>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // rAF throttle pointer move
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
        const gy = (rect?.top ?? 0) + padding.top;
        const lx = p.clientX - gx;
        const ly = p.clientY - gy;
        // hit-test bar index
        let idx = -1;
        for (let i = 0; i < n; i++) {
          const x = iToX(i);
          if (lx >= x && lx <= x + bw) {
            idx = i;
            break;
          }
        }
        if (idx < 0) {
          setHoverIdx(null);
          setTip(null);
          return;
        }
        setHoverIdx(idx);
        // hit-test segment by vertical stack
        const d = data[idx];
        let acc = 0;
        let segIndex: number | null = null;
        for (let s = 0; s < d.segments.length; s++) {
          const h = valToH(d.segments[s].value || 0);
          const yTop = innerH - (acc + h);
          const yBot = innerH - acc;
          if (ly >= yTop && ly <= yBot) {
            segIndex = s;
            break;
          }
          acc += h;
        }
        setTip({ screenX: p.clientX, screenY: p.clientY, i: idx, segIndex });
      });
    }
  };
  useLayoutEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        className={cn("bg-card w-full h-auto rounded-md")}
        onPointerMove={handleMove}
        onPointerLeave={() => {
          setHoverIdx(null);
          setTip(null);
        }}
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
            const isHover = hoverIdx === i;
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

                {/* 1px outline on hover */}
                {isHover && (
                  <rect
                    x={Math.round(x)}
                    y={snap(0)}
                    width={Math.max(0, Math.round(bw))}
                    height={innerH}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1}
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

      {/* Fixed tooltip with segment breakdown */}
      {tip && data[tip.i] && (
        <div
          className="pointer-events-none fixed z-50 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md"
          style={{
            left: Math.min(tip.screenX + 16, window.innerWidth - 260),
            top: Math.min(tip.screenY + 16, window.innerHeight - 160),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{data[tip.i].x}</div>
          <div className="mb-0.5">Total: {totals[tip.i]}</div>
          {data[tip.i].segments.map((s, j) => (
            <div key={j} className="flex items-center gap-3">
              <span
                aria-hidden
                style={{ background: s.color, width: 8, height: 8 }}
                className="inline-block"
              />
              <span className="opacity-90">{s.key}:</span>
              <span>{Math.round(s.value)}</span>
              {tip.segIndex === j && (
                <span className="opacity-70">(hover)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
