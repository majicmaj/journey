import Fullscreen, { FullScreenButton } from "./Fullscreen";
import ResponsiveContainer from "./ResponsiveContainer";
import PanZoom from "./PanZoom";

export default function ChartFrame({
  controls,
  height,
  enablePanZoom = true,
  className,
  children,
}: {
  controls?: React.ReactNode;
  height: number | ((w: number) => number);
  enablePanZoom?: boolean;
  className?: string;
  children: (w: number, h: number) => React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="relative mb-2">
        <div className="pr-12 flex flex-wrap items-center gap-2">
          {controls}
        </div>
        <div className="absolute top-0 right-0">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <div className="w-full h-full relative">
                {enablePanZoom ? (
                  <PanZoom className="w-full h-full bg-background">
                    <ResponsiveContainer height="fill" className="h-full">
                      {(vw, vh) => children(vw, vh)}
                    </ResponsiveContainer>
                    <div className="absolute -top-6 -right-6 translate-x-1/2">
                      <button
                        className="pixel-frame px-2 py-1 bg-card"
                        onClick={close}
                      >
                        Close
                      </button>
                    </div>
                  </PanZoom>
                ) : (
                  <ResponsiveContainer height="fill" className="h-full">
                    {(vw, vh) => children(vw, vh)}
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </Fullscreen>
        </div>
      </div>

      {enablePanZoom ? (
        <PanZoom className="w-full h-full bg-background">
          <ResponsiveContainer height={height}>
            {(vw, vh) => children(vw, vh)}
          </ResponsiveContainer>
        </PanZoom>
      ) : (
        <ResponsiveContainer height={height}>
          {(vw, vh) => children(vw, vh)}
        </ResponsiveContainer>
      )}
    </div>
  );
}
