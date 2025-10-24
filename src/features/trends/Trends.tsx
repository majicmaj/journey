import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
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

  const isSmall = useMediaQuery("(max-width: 480px)");
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
            <span
              className={cn("pixel-frame w-4 h-4 bg-secondary")}
              style={{ opacity: 0 }}
            />
            <span
              className={cn("pixel-frame w-4 h-4 bg-secondary")}
              style={{ opacity: 0.25 }}
            />
            <span
              className={cn("pixel-frame w-4 h-4 bg-secondary")}
              style={{ opacity: 0.5 }}
            />
            <span
              className={cn("pixel-frame w-4 h-4 bg-secondary")}
              style={{ opacity: 0.75 }}
            />
            <span
              className={cn("pixel-frame w-4 h-4 bg-secondary")}
              style={{ opacity: 1 }}
            />
          </div>
        </div>
      </header>

      <div className="pixel-frame bg-card p-3">
        <div className="w-full overflow-hidden">
          <div className="min-w-full min-h-max">
            <CalendarHeatmap
              startDate={from}
              endDate={to}
              values={data}
              classForValue={() => ""}
              transformDayElement={(element, v) => {
                type HeatmapValue = {
                  date: string | number | Date;
                  [key: string]: unknown;
                };
                const hv = v as HeatmapValue | undefined;
                const maybe = hv?.["count"];
                const raw = typeof maybe === "number" ? maybe : 0;
                const opacity = Math.max(0, Math.min(1, raw / 100));

                type DayElProps = { style?: CSSProperties; className?: string };
                const el = element as ReactElement<DayElProps>;
                const nextStyle: CSSProperties = {
                  ...(el.props?.style ?? {}),
                  fill: `color-mix(in srgb, var(--secondary) ${
                    opacity * 100
                  }%, var(--background))`,
                };
                const nextClassName = cn(el.props?.className);
                return cloneElement(el, {
                  style: nextStyle,
                  className: nextClassName,
                });
              }}
              titleForValue={(v) => {
                type HeatmapValue = {
                  date: string | number | Date;
                  [key: string]: unknown;
                };
                const hv = v as HeatmapValue | undefined;
                const dateVal = hv?.date;
                if (!dateVal) return "";
                const dateStr =
                  typeof dateVal === "string"
                    ? dateVal
                    : typeof dateVal === "number"
                    ? new Date(dateVal).toISOString().slice(0, 10)
                    : dateVal.toISOString().slice(0, 10);
                const maybe = hv?.["count"];
                const count = typeof maybe === "number" ? maybe : 0;
                return `${count} score on ${dateStr}`;
              }}
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
