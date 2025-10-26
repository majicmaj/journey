import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function ResponsiveContainer({
  height,
  className,
  children,
}: {
  height:
    | number
    | "fill"
    | ((width: number, containerHeight: number) => number);
  className?: string;
  children: (width: number, height: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        setWidth(Math.max(1, Math.floor(w)));
        setContainerHeight(Math.max(1, Math.floor(h)));
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setWidth(Math.max(1, Math.floor(rect.width)));
    setContainerHeight(Math.max(1, Math.floor(rect.height)));
    return () => ro.disconnect();
  }, []);

  const computedH =
    typeof height === "function"
      ? height(width, containerHeight)
      : height === "fill"
      ? containerHeight
      : height;

  return (
    <div
      ref={ref}
      className={cn("w-full", className, height === "fill" && "h-full")}
      style={height === "fill" ? { height: "100%" } : undefined}
    >
      {width > 0 ? (
        children(width, computedH)
      ) : (
        <div style={{ height: computedH }} />
      )}
    </div>
  );
}
