import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

export type LinePoint = { x: string; y: number };
export type LineSeries = { name: string; color: string; points: LinePoint[] };

type TipState = {
  containerX: number; // container-local (for tooltip positioning)
  containerY: number;
  localX: number; // inner-chart local X for index mapping
  xKey: string | null;
  idx: number | null;
} | null;

export default function LineChart({
  width,
  height,
  series,
  goalBands,
  onBrush,
  compactXAxis,
  yDomain,
  yTicks,
}: {
  width: number;
  height: number;
  series: LineSeries[];
  goalBands?: Array<{ from: number; to: number; colorVar?: string }>;
  onBrush?: (fromX: string, toX: string) => void;
  compactXAxis?: boolean;
  yDomain?: { min?: number; max?: number };
  yTicks?: number[];
}) {
  const padding = { top: 12, right: 12, bottom: 22, left: 28 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  // x domain (sorted unique)
  const allX = useMemo(
    () =>
      Array.from(
        new Set(series.flatMap((s) => s.points.map((p) => p.x)))
      ).sort(),
    [series]
  );
  const xDomain = allX;

  // y domain
  const allY = useMemo(
    () => series.flatMap((s) => s.points.map((p) => p.y)),
    [series]
  );
  const yMinDefault = Math.min(0, ...allY);
  const yMaxDefault = Math.max(100, ...allY);
  const yMin = yDomain?.min ?? yMinDefault;
  const yMax = yDomain?.max ?? yMaxDefault;

  // scales
  const xToPx = (x: string): number => {
    const i = xDomain.indexOf(x);
    return i <= 0
      ? 0
      : xDomain.length <= 1
      ? 0
      : (i / (xDomain.length - 1)) * innerW;
  };
  const yToPx = (y: number): number => {
    const t = (y - yMin) / Math.max(1e-6, yMax - yMin);
    return innerH - t * innerH;
  };

  // snap to pixel grid for crisp edges (strokes)
  const snap = (n: number) => Math.round(n) + 0.5; // centers odd stroke widths nicely

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const [tip, setTip] = useState<TipState>(null);

  // rAF throttle pointermove
  const rafRef = useRef<number | null>(null);
  const queuedRef = useRef<PointerEvent | null>(null);

  const localFromClient = (clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const gx = (rect?.left ?? 0) + padding.left;
    const gy = (rect?.top ?? 0) + padding.top;
    const lx = Math.max(0, Math.min(innerW, clientX - gx));
    const ly = Math.max(0, Math.min(innerH, clientY - gy));
    const cx = clientX - (rect?.left ?? 0);
    const cy = clientY - (rect?.top ?? 0);
    return { lx, ly, cx, cy };
  };

  const idxFromLocalX = (lx: number) => {
    const denom = Math.max(1, xDomain.length - 1);
    const t = innerW <= 0 ? 0 : lx / innerW;
    const i = Math.round(t * denom);
    return Math.max(0, Math.min(xDomain.length - 1, i));
  };

  const handlePointerMoveThrottled = (e: React.PointerEvent) => {
    const native = e.nativeEvent as PointerEvent;
    queuedRef.current = native;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const p = queuedRef.current;
        if (!p) return;
        const { lx, cx, cy } = localFromClient(p.clientX, p.clientY);
        const idx = idxFromLocalX(lx);
        setTip({
          containerX: cx,
          containerY: cy,
          localX: lx,
          xKey: xDomain[idx] ?? null,
          idx,
        });
      });
    }
  };

  useLayoutEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // brush
  function onPointerDown(e: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const x = e.clientX - ((rect?.left ?? 0) + padding.left);
    const clamped = Math.max(0, Math.min(innerW, x));
    setDrag({ x0: clamped, x1: clamped });
  }
  function onPointerMove(e: React.PointerEvent) {
    handlePointerMoveThrottled(e);
    if (drag) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const x = e.clientX - ((rect?.left ?? 0) + padding.left);
      const clamped = Math.max(0, Math.min(innerW, x));
      setDrag((d) => (d ? { ...d, x1: clamped } : d));
    }
  }
  function endBrush() {
    if (!drag) return;
    const [a, b] = [Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)];
    if (b - a > 8) {
      const i0 = idxFromLocalX(a);
      const i1 = idxFromLocalX(b);
      const fromX = xDomain[Math.min(i0, i1)];
      const toX = xDomain[Math.max(i0, i1)];
      onBrush?.(fromX, toX);
    }
    setDrag(null);
  }
  function onPointerUp() {
    endBrush();
  }
  function onPointerLeave() {
    setTip(null);
    endBrush();
  }

  // NEW: step-mid path with edge extension & pixel snapping
  const buildStepPathMid = (pts: LinePoint[]) => {
    const usable = pts.filter((p) => xDomain.includes(p.x));
    if (usable.length === 0) return "";

    // precompute pixel x/y (snapped)
    const xs = usable.map((p) => snap(xToPx(p.x)));
    const ys = usable.map((p) => snap(yToPx(p.y)));

    // midpoints between consecutive x’s
    const mids: number[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      mids.push(snap((xs[i] + xs[i + 1]) / 2));
    }

    // edge half-steps so first/last plateaus are centered too
    const firstHalf =
      xs.length > 1
        ? Math.max(0, Math.min(innerW, snap(xs[0] - (mids[0] - xs[0]))))
        : xs[0];
    const lastHalf =
      xs.length > 1
        ? Math.max(
            0,
            Math.min(
              innerW,
              snap(
                xs[xs.length - 1] + (xs[xs.length - 1] - mids[mids.length - 1])
              )
            )
          )
        : xs[0];

    // build path:
    // start at left edge-extended point (center the first plateau),
    // then H to first mid, V to next y, repeat… finally H to right edge-extended end
    let d = `M${firstHalf},${ys[0]}`;
    if (mids.length === 0) {
      // only one point -> draw a centered tiny plateau
      d += ` H${lastHalf}`;
      return d;
    }

    // first half-plateau to mid between 0 and 1
    d += ` H${mids[0]} V${ys[1]}`;

    // interior mids
    for (let i = 1; i < mids.length; i++) {
      d += ` H${mids[i]} V${ys[i + 1]}`;
    }

    // final half-plateau out to the right edge extension
    d += ` H${lastHalf}`;
    return d;
  };

  // value lookup at an xKey for tooltip/markers
  const valuesAtX = (xKey: string) =>
    series.map((s) => {
      const pt = s.points.find((p) => p.x === xKey);
      return { name: s.name, color: s.color, y: pt?.y, has: pt != null };
    });

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={cn("bg-card w-full h-auto rounded-md")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* goal bands */}
          {goalBands?.map((b, i) => (
            <rect
              key={i}
              x={0}
              y={snap(yToPx(b.to))}
              width={innerW}
              height={Math.max(0, snap(yToPx(b.from)) - snap(yToPx(b.to)))}
              fill={`color-mix(in srgb, var(${
                b.colorVar ?? "--secondary"
              }) 12%, var(--background))`}
              shapeRendering="crispEdges"
            />
          ))}

          {/* stepped pixel paths */}
          {series.map((s, idx) => {
            const d = buildStepPathMid(s.points);
            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={3}
                strokeLinejoin="miter"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            );
          })}

          {/* pixel markers at exact points (tiny squares) */}
          {series.map((s, si) =>
            s.points
              .filter((p) => xDomain.includes(p.x))
              .map((p, pi) => {
                const x = snap(xToPx(p.x));
                const y = snap(yToPx(p.y));
                const r = 2; // half-size of the square
                return (
                  <rect
                    key={`${si}-${pi}`}
                    x={x - r}
                    y={y - r}
                    width={2 * r}
                    height={2 * r}
                    fill={s.color}
                    shapeRendering="crispEdges"
                  />
                );
              })
          )}

          {/* axes */}
          <line
            x1={0}
            x2={innerW}
            y1={snap(innerH)}
            y2={snap(innerH)}
            stroke="var(--border)"
            shapeRendering="crispEdges"
          />
          <line
            x1={snap(0)}
            x2={snap(0)}
            y1={0}
            y2={innerH}
            stroke="var(--border)"
            shapeRendering="crispEdges"
          />

          {/* x ticks/labels */}
          {xDomain.map((x) => {
            let label: string | null = x.slice(5);
            if (compactXAxis) {
              if (x.endsWith("-01")) {
                const mm = Number(x.slice(5, 7));
                const abbr = [
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
                label = abbr;
              } else label = null;
            }
            if (!label) return null;
            return (
              <text
                key={x}
                x={xToPx(x)}
                y={innerH + 16}
                fontSize={10}
                textAnchor="middle"
                className="fill-muted-foreground select-none"
              >
                {label}
              </text>
            );
          })}

          {/* y ticks */}
          {(yTicks ?? [0, 25, 50, 75, 100]).map((v) => (
            <g key={v}>
              <line
                x1={-4}
                x2={0}
                y1={snap(yToPx(v))}
                y2={snap(yToPx(v))}
                stroke="var(--border)"
              />
              <text
                x={-8}
                y={yToPx(v) + 3}
                fontSize={10}
                textAnchor="end"
                className="fill-muted-foreground select-none"
              >
                {v}
              </text>
            </g>
          ))}

          {/* brush overlay */}
          {drag && (
            <rect
              x={Math.min(drag.x0, drag.x1)}
              y={0}
              width={Math.abs(drag.x1 - drag.x0)}
              height={innerH}
              fill="color-mix(in srgb, var(--secondary) 16%, transparent)"
              shapeRendering="crispEdges"
            />
          )}

          {/* hover crosshair + in-chart markers; tooltip handled outside as fixed HTML */}
          {tip?.xKey && (
            <>
              <line
                x1={snap(xToPx(tip.xKey))}
                x2={snap(xToPx(tip.xKey))}
                y1={0}
                y2={innerH}
                stroke="var(--border)"
                strokeDasharray="4 4"
                shapeRendering="crispEdges"
              />
              {valuesAtX(tip.xKey)
                .filter((v) => Number.isFinite(v.y))
                .map((v, i) => (
                  <rect
                    key={i}
                    x={snap(xToPx(tip?.xKey ?? "")) - 1}
                    y={snap(yToPx(v.y!)) - 2}
                    width={4}
                    height={4}
                    fill={v.color}
                    shapeRendering="crispEdges"
                  />
                ))}
            </>
          )}
        </g>
      </svg>

      {/* Container-relative, bounds-aware tooltip */}
      {tip?.xKey && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md"
          style={{
            left: Math.min(tip.containerX + 12, width - 220),
            top: Math.min(tip.containerY + 12, height - 120),
            whiteSpace: "nowrap",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-0.5">{tip.xKey}</div>
          {valuesAtX(tip.xKey).map((v, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                aria-hidden
                style={{ background: v.color, width: 8, height: 8 }}
                className="inline-block"
              />
              <span className="opacity-90">{v.name}:</span>{" "}
              <span>{Number.isFinite(v.y) ? Math.round(v.y!) : "—"}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
