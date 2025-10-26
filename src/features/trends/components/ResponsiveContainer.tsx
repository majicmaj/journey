import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function ResponsiveContainer({
  height,
  className,
  children,
}: {
  height: number | ((width: number) => number);
  className?: string;
  children: (width: number, height: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setWidth(Math.max(1, Math.floor(w)));
      }
    });
    ro.observe(el);
    setWidth(Math.max(1, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);

  const computedH = typeof height === "function" ? height(width) : height;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      {width > 0 ? (
        children(width, computedH)
      ) : (
        <div style={{ height: computedH }} />
      )}
    </div>
  );
}
