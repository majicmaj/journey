// components/ChartFrame.tsx
import type { ReactNode } from "react";
import PanZoom from "./PanZoom";
import ResponsiveContainer from "./ResponsiveContainer";
import Fullscreen, { FullScreenButton } from "./Fullscreen";
import { cn } from "@/lib/utils";

type ChartFrameProps = {
  className?: string;
  /** Put any dropdowns/toggles here. Shown above the chart. */
  controls?: ReactNode;
  /** If true, wraps with PanZoom */
  pannable?: boolean;
  /** If true, shows fullscreen affordance and renders children into a fullscreen pane when opened */
  fullscreenable?: boolean;
  /** Height for the inline (non-fullscreen) chart. Can be a number or function(w)->h like ResponsiveContainer. */
  height: number | ((width: number) => number);
  /** Optional class for the inner container that holds the chart */
  innerClassName?: string;
  /** Your chart renderer receives the responsive width/height */
  children: (vw: number, vh: number) => ReactNode;
};

export default function ChartFrame({
  className,
  controls,
  pannable = true,
  fullscreenable = true,
  height,
  innerClassName,
  children,
}: ChartFrameProps) {
  const ChartBody = ({ full }: { full: boolean }) => {
    const Wrapper = pannable ? PanZoom : "div";
    const wrapperProps = pannable
      ? { className: cn("w-full h-full bg-background", innerClassName) }
      : { className: cn("w-full h-full", innerClassName) };

    return (
      <Wrapper {...wrapperProps}>
        <ResponsiveContainer height={full ? "fill" : height} className="h-full">
          {(vw, vh) => children(vw, vh)}
        </ResponsiveContainer>
      </Wrapper>
    );
  };

  if (!fullscreenable) {
    // Inline-only
    return (
      <div className={cn("pixel-frame bg-card p-3", className)}>
        {controls ? <div className="mb-3">{controls}</div> : null}
        <ChartBody full={false} />
      </div>
    );
  }

  // With fullscreen affordance
  return (
    <div className={cn("pixel-frame bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {controls ? <div className="min-w-0">{controls}</div> : <div />}
        <Fullscreen
          affordance={({ open }) => <FullScreenButton onClick={open} />}
        >
          {() => (
            <div className="relative w-full h-full">
              <ChartBody full />
            </div>
          )}
        </Fullscreen>
      </div>

      {/* Inline */}
      <ChartBody full={false} />
    </div>
  );
}
