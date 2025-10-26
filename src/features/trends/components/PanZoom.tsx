import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function PanZoom({
  className,
  children,
  minScale = 0.5,
  maxScale = 4,
}: {
  className?: string;
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState({ scale: 1, x: 0, y: 0 });
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const pinchRef = useRef<{
    active: boolean;
    d0: number;
    s0: number;
    cx: number;
    cy: number;
  } | null>(null);

  const clampScale = useCallback(
    (s: number) => Math.max(minScale, Math.min(maxScale, s)),
    [minScale, maxScale]
  );

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = e.clientX - (rect?.left ?? 0) - state.x;
    const cy = e.clientY - (rect?.top ?? 0) - state.y;
    const factor = Math.exp(-e.deltaY * 0.001);
    const nextScale = clampScale(state.scale * factor);
    const k = nextScale / state.scale;
    setState((s) => ({
      scale: nextScale,
      x: s.x - cx * (k - 1),
      y: s.y - cy * (k - 1),
    }));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: state.x,
      origY: state.y,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current?.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setState((s) => ({
        ...s,
        x: panRef.current!.origX + dx,
        y: panRef.current!.origY + dy,
      }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    panRef.current = null;
  }

  function touchDist(
    t0: { clientX: number; clientY: number },
    t1: { clientX: number; clientY: number }
  ) {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const d0 = touchDist(e.touches[0], e.touches[1]);
      const rect = containerRef.current?.getBoundingClientRect();
      const cx =
        (e.touches[0].clientX + e.touches[1].clientX) / 2 -
        (rect?.left ?? 0) -
        state.x;
      const cy =
        (e.touches[0].clientY + e.touches[1].clientY) / 2 -
        (rect?.top ?? 0) -
        state.y;
      pinchRef.current = { active: true, d0, s0: state.scale, cx, cy };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (pinchRef.current?.active && e.touches.length === 2) {
      e.preventDefault();
      const d1 = touchDist(e.touches[0], e.touches[1]);
      const factor = d1 / pinchRef.current.d0;
      const nextScale = clampScale(pinchRef.current.s0 * factor);
      const k = nextScale / state.scale;
      setState((s) => ({
        scale: nextScale,
        x: s.x - pinchRef.current!.cx * (k - 1),
        y: s.y - pinchRef.current!.cy * (k - 1),
      }));
    }
  }
  function onTouchEnd() {
    pinchRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden touch-pan-y", className)}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        style={{
          transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}
