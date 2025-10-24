import { useEffect, useMemo, useRef, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css"; // base styles; we'll override with our theme classes
import { useDailySummariesRange, useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
// Button not needed here
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RangePreset =
  | "this-year"
  | "this-month"
  | "last-12-months"
  | "last-6-months"
  | "last-90-days"
  | "last-30-days";

function calcRange(
  preset: RangePreset,
  dayStart: string
): { from: string; to: string } {
  const today = new Date();
  const to = toDayKey(today, dayStart);
  const d = new Date(today);
  switch (preset) {
    case "this-year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { from: toDayKey(yearStart, dayStart), to };
    }
    case "this-month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDayKey(monthStart, dayStart), to };
    }
    case "last-12-months": {
      d.setFullYear(d.getFullYear() - 1);
      return { from: toDayKey(d, dayStart), to };
    }
    case "last-6-months": {
      d.setMonth(d.getMonth() - 6);
      return { from: toDayKey(d, dayStart), to };
    }
    case "last-90-days": {
      d.setDate(d.getDate() - 90);
      return { from: toDayKey(d, dayStart), to };
    }
    case "last-30-days":
    default: {
      d.setDate(d.getDate() - 30);
      return { from: toDayKey(d, dayStart), to };
    }
  }
}

export default function Trends() {
  const settings = useSettings();
  const dayStart = settings.data?.dayStart ?? "00:00";
  const [preset, setPreset] = useState<RangePreset>("last-90-days");

  const { from, to } = useMemo(
    () => calcRange(preset, dayStart),
    [preset, dayStart]
  );
  const { summaries } = useDailySummariesRange(from, to);

  const data = useMemo(
    () => (summaries ?? []).map((s) => ({ date: s.date, count: s.totalScore })),
    [summaries]
  );

  // Map 0..100 score -> 0..4 bucket for color scale
  function classForValue(v?: number) {
    if (v == null) return "color-empty";
    if (v <= 0) return "color-empty";
    if (v < 25) return "color-scale-1";
    if (v < 50) return "color-scale-2";
    if (v < 75) return "color-scale-3";
    return "color-scale-4";
  }

  // Responsive autoscaling for the heatmap SVG
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [scale, setScale] = useState(1);
  const [svgNaturalHeight, setSvgNaturalHeight] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setContainerW(el.clientWidth);
      const svg = el.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const vb = svg.viewBox?.baseVal;
      const svgWidth = vb?.width || svg.getBoundingClientRect().width || 0;
      const svgHeight = vb?.height || svg.getBoundingClientRect().height || 0;
      if (svgWidth > 0 && svgHeight > 0) {
        const nextScale = Math.min(1, el.clientWidth / svgWidth);
        setScale(nextScale);
        setSvgNaturalHeight(svgHeight);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    const id = window.setInterval(update, 250);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.clearInterval(id);
    };
  }, [from, to, data.length]);

  const isSmall = containerW < 480;

  return (
    <div className="p-3 flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold">Trends</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="pixel-frame">
            <Select
              value={preset}
              onValueChange={(v: RangePreset) => setPreset(v)}
            >
              <SelectTrigger className="w-48 bg-card">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
                <SelectItem value="last-30-days">Last 30 days</SelectItem>
                <SelectItem value="last-90-days">Last 90 days</SelectItem>
                <SelectItem value="last-6-months">Last 6 months</SelectItem>
                <SelectItem value="last-12-months">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-70">Legend:</span>
            <span className={cn("pixel-frame w-4 h-4", "bg-heat-empty")} />
            <span className={cn("w-4 h-4 pixel-frame", "bg-heat-1")} />
            <span className={cn("w-4 h-4 pixel-frame", "bg-heat-2")} />
            <span className={cn("w-4 h-4 pixel-frame", "bg-heat-3")} />
            <span className={cn("w-4 h-4 pixel-frame", "bg-heat-4")} />
          </div>
        </div>
      </header>

      <div className="pixel-frame bg-card p-3">
        <div ref={containerRef} className="w-full overflow-hidden">
          <div
            className="min-w-full min-h-max"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "left top",
              height: svgNaturalHeight ? svgNaturalHeight * scale : undefined,
              width: "fit-content",
            }}
          >
            <CalendarHeatmap
              startDate={from}
              endDate={to}
              values={data}
              classForValue={(v) =>
                classForValue(v?.count as number | undefined)
              }
              titleForValue={(v) =>
                v?.date ? `${v.count ?? 0} score on ${v.date}` : undefined
              }
              showWeekdayLabels={!isSmall}
              gutterSize={isSmall ? 1 : 2}
            />
          </div>
        </div>
      </div>

      <div className="text-sm opacity-70">
        Scores are daily weighted completion (0–100). Darker = higher
        completion.
      </div>
    </div>
  );
}
