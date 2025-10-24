import { cloneElement, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css"; // base styles; we'll override with our theme classes
import { useEntriesRange, useHabits, useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { computeDaySummary } from "@/lib/score";
import type { DailyEntry } from "@/types/habit";

type RangePreset =
  | "this-year"
  | "this-month"
  | "last-12-months"
  | "last-6-months"
  | "last-90-days"
  | "last-30-days"
  | "custom";

type HabitFilterMode = "all" | "one" | "many";

function calcRange(
  preset: Exclude<RangePreset, "custom">,
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

function enumerateDateKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const start = new Date(fromKey + "T00:00:00");
  const end = new Date(toKey + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    out.push(key);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function Trends() {
  const settings = useSettings();
  const dayStart = settings.data?.dayStart ?? "00:00";
  const habitsQ = useHabits();
  const [preset, setPreset] = useState<RangePreset>("last-90-days");
  const [customRange, setCustomRange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const computed = useMemo(() => {
    if (preset === "custom") {
      return customRange ?? calcRange("last-90-days", dayStart);
    }
    return calcRange(preset, dayStart);
  }, [preset, customRange, dayStart]);

  const from = computed.from;
  const to = computed.to;

  // Habit filtering state
  const [habitMode, setHabitMode] = useState<HabitFilterMode>("all");
  const [habitId, setHabitId] = useState<string | null>(null);
  const [habitIds, setHabitIds] = useState<string[]>([]);

  const activeHabits = useMemo(() => {
    const all = (habitsQ.data ?? []).filter((h) => !h.archivedAt);
    if (habitMode === "all") return all;
    if (habitMode === "one")
      return habitId ? all.filter((h) => h.id === habitId) : [];
    return all.filter((h) => habitIds.includes(h.id));
  }, [habitsQ.data, habitMode, habitId, habitIds]);

  // Compute summaries for filtered habits from entries
  const entriesQ = useEntriesRange(from, to);
  const summaries = useMemo(() => {
    if (!entriesQ.data) return undefined;
    const entriesByDate = new Map<string, DailyEntry[]>();
    for (const e of entriesQ.data) {
      const arr = entriesByDate.get(e.date) ?? [];
      arr.push(e);
      entriesByDate.set(e.date, arr);
    }
    const out: Array<{ date: string; totalScore: number }> = [];
    for (const d of enumerateDateKeys(from, to)) {
      const list = entriesByDate.get(d) ?? [];
      const { totalScore } = computeDaySummary(d, activeHabits, list);
      out.push({ date: d, totalScore });
    }
    return out;
  }, [entriesQ.data, activeHabits, from, to]);

  const data = useMemo(
    () => (summaries ?? []).map((s) => ({ date: s.date, count: s.totalScore })),
    [summaries]
  );

  const selectedCount =
    habitMode === "many"
      ? habitIds.length
      : habitMode === "one"
      ? habitId
        ? 1
        : 0
      : habitsQ.data?.length ?? 0;

  return (
    <div className="p-3 flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="grid w-full sm:flex gap-3 items-center flex-wrap">
          <span className="opacity-70 text-sm">Range</span>
          <div className="pixel-frame">
            <Select
              value={preset}
              onValueChange={(v: RangePreset) => {
                if (v === "custom") {
                  setCustomRange({ from, to });
                }
                setPreset(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-48 bg-card">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
                <SelectItem value="last-30-days">Last 30 days</SelectItem>
                <SelectItem value="last-90-days">Last 90 days</SelectItem>
                <SelectItem value="last-6-months">Last 6 months</SelectItem>
                <SelectItem value="last-12-months">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <div className="sm:flex items-center gap-3 grid">
              <span className="opacity-70 text-sm">From</span>
              <div className="pixel-frame">
                <Input
                  type="date"
                  className="w-full sm:w-[11rem] bg-card"
                  value={from}
                  onChange={(e) =>
                    setCustomRange((r) => ({
                      from: e.target.value,
                      to: r?.to ?? to,
                    }))
                  }
                />
              </div>

              <span className="opacity-70 text-sm">To</span>
              <div className="pixel-frame">
                <Input
                  type="date"
                  className="w-full sm:w-[11rem] bg-card"
                  value={to}
                  onChange={(e) =>
                    setCustomRange((r) => ({
                      from: r?.from ?? from,
                      to: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          <span className="opacity-70 text-sm">Habits</span>
          <div className="pixel-frame">
            <Select
              value={habitMode}
              onValueChange={(v: HabitFilterMode) => {
                setHabitMode(v);
                if (v === "one") {
                  const first = (habitsQ.data ?? []).find((h) => !h.archivedAt);
                  setHabitId(first?.id ?? null);
                }
                if (v === "many") {
                  setHabitIds(
                    (habitsQ.data ?? [])
                      .filter((h) => !h.archivedAt)
                      .map((h) => h.id)
                  );
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48 bg-card">
                <SelectValue placeholder="Habits" />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                <SelectItem value="all">All habits</SelectItem>
                <SelectItem value="one">Just one</SelectItem>
                <SelectItem value="many">Certain habits</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {habitMode === "one" && (
            <div className="pixel-frame">
              <Select
                value={habitId ?? ""}
                onValueChange={(v: string) => setHabitId(v)}
              >
                <SelectTrigger className="w-full sm:w-48 bg-card">
                  <SelectValue placeholder="Select habit" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  {(habitsQ.data ?? [])
                    .filter((h) => !h.archivedAt)
                    .map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {habitMode === "many" && (
            <Popover>
              <PopoverTrigger asChild>
                <div className="pixel-frame px-3 py-2 cursor-pointer bg-card">
                  {selectedCount} selected
                </div>
              </PopoverTrigger>
              <PopoverContent className="pixel-frame w-64 bg-card">
                <div className="max-h-64 overflow-auto p-2">
                  {(habitsQ.data ?? [])
                    .filter((h) => !h.archivedAt)
                    .map((h) => {
                      const checked = habitIds.includes(h.id);
                      return (
                        <label
                          key={h.id}
                          className="flex items-center gap-2 py-1"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              setHabitIds((ids) =>
                                val
                                  ? [...ids, h.id]
                                  : ids.filter((x) => x !== h.id)
                              );
                            }}
                          />
                          <span className="text-sm">{h.title}</span>
                        </label>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </header>

      <div className="pixel-frame bg-card p-3">
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
          showWeekdayLabels
          gutterSize={3}
        />
      </div>

      <div className="text-sm opacity-70">
        Scores are daily weighted completion (0–100).
      </div>
    </div>
  );
}
