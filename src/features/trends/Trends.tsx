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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import MultiSelect from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { computeDaySummary } from "@/lib/score";
import type { DailyEntry } from "@/types/habit";
import LineChart, { type LineSeries } from "./components/LineChart";
import BarChart from "./components/BarChart";
import HeatmapMatrix from "./components/HeatmapMatrix";
import StreakTimeline from "./components/StreakTimeline";
import {
  enumerateDateKeys as enumKeys,
  rollingAverage,
  groupByISOWeek,
  computeStreakSegments,
  endOfISOWeek,
} from "./utils";

type RangePreset =
  | "this-year"
  | "this-month"
  | "last-12-months"
  | "last-6-months"
  | "last-90-days"
  | "last-30-days"
  | "custom";

type HabitFilterMode = "all" | "one" | "many" | "tags";

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

type ViewMode =
  | "heatmap"
  | "trend"
  | "adherence"
  | "streaks"
  | "cadence"
  | "weekday";

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const h of habitsQ.data ?? []) {
      if (h.archivedAt) continue;
      for (const t of h.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [habitsQ.data]);

  const activeHabits = useMemo(() => {
    const all = (habitsQ.data ?? []).filter((h) => !h.archivedAt);
    if (habitMode === "all") return all;
    if (habitMode === "one")
      return habitId ? all.filter((h) => h.id === habitId) : [];
    if (habitMode === "many") return all.filter((h) => habitIds.includes(h.id));
    // tags mode: include habits that have ANY of the selected tags
    const tagSet = new Set(selectedTags);
    return all.filter((h) => (h.tags ?? []).some((t) => tagSet.has(t)));
  }, [habitsQ.data, habitMode, habitId, habitIds, selectedTags]);

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

  // selectedCount no longer needed; MultiSelect renders its own label

  // New view selection
  const [view, setView] = useState<ViewMode>("heatmap");

  // Derived series for visualizations
  const totalScoreSeries: Array<{ x: string; y: number }> = useMemo(
    () => (summaries ?? []).map((s) => ({ x: s.date, y: s.totalScore })),
    [summaries]
  );
  const ma7 = useMemo(
    () => rollingAverage(totalScoreSeries, 7),
    [totalScoreSeries]
  );
  const ma28 = useMemo(
    () => rollingAverage(totalScoreSeries, 28),
    [totalScoreSeries]
  );

  // Map entries by date for other aggregations
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyEntry[]>();
    for (const e of entriesQ.data ?? []) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [entriesQ.data]);

  // Adherence series (rolling 7-day)
  const adherenceSeries = useMemo(() => {
    const days = enumKeys(from, to);
    const chartColors = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ];

    function habitDayCompleted(habitId: string, day: string): number {
      const list = entriesByDate.get(day) ?? [];
      const e = list.find((x) => x.habitId === habitId);
      return e?.completed ? 100 : 0;
    }

    if (habitMode === "one") {
      const h = activeHabits[0];
      if (!h) return [] as LineSeries[];
      const raw = days.map((d) => ({ x: d, y: habitDayCompleted(h.id, d) }));
      return [
        {
          name: h.title,
          color: chartColors[0 % chartColors.length],
          points: rollingAverage(raw, 7),
        },
      ] as LineSeries[];
    }

    if (habitMode === "many") {
      return activeHabits.map((h, i) => {
        const raw = days.map((d) => ({ x: d, y: habitDayCompleted(h.id, d) }));
        return {
          name: h.title,
          color: chartColors[i % chartColors.length],
          points: rollingAverage(raw, 7),
        } as LineSeries;
      });
    }

    if (habitMode === "tags") {
      // For each selected tag, average completion across habits with that tag
      return selectedTags.map((tag, i) => {
        const habitsWithTag = activeHabits.filter((h) =>
          (h.tags ?? []).includes(tag)
        );
        const raw = days.map((d) => {
          const vals = habitsWithTag.map((h) => habitDayCompleted(h.id, d));
          const avg =
            vals.length === 0
              ? 0
              : vals.reduce((a, b) => a + b, 0) / vals.length;
          return { x: d, y: avg };
        });
        return {
          name: `#${tag}`,
          color: chartColors[i % chartColors.length],
          points: rollingAverage(raw, 7),
        } as LineSeries;
      });
    }

    // habitMode === "all": average across all active habits
    if (activeHabits.length === 0) return [] as LineSeries[];
    const raw = days.map((d) => {
      const vals = activeHabits.map((h) => habitDayCompleted(h.id, d));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { x: d, y: avg };
    });
    return [
      {
        name: "All habits",
        color: chartColors[0],
        points: rollingAverage(raw, 7),
      },
    ] as LineSeries[];
  }, [from, to, entriesByDate, habitMode, activeHabits, selectedTags]);

  // Weekly cadence bars
  const weeklyBars = useMemo(() => {
    const days = enumKeys(from, to);
    const byWeek = groupByISOWeek(days);
    const out: Array<{
      key: string;
      label: string;
      value: number;
      range: { from: string; to: string };
    }> = [];
    for (const [weekStart, dks] of byWeek) {
      const vals: number[] = [];
      for (const dk of dks) {
        const { totalScore } = computeDaySummary(
          dk,
          activeHabits,
          entriesByDate.get(dk) ?? []
        );
        vals.push(totalScore);
      }
      const avg =
        vals.length === 0
          ? 0
          : Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      out.push({
        key: weekStart,
        label: weekStart.slice(5),
        value: avg,
        range: { from: weekStart, to: endOfISOWeek(weekStart) },
      });
    }
    return out.sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [from, to, activeHabits, entriesByDate]);

  // Streak segments per habit
  const streakRows = useMemo(() => {
    const days = enumKeys(from, to);
    const byHabit = new Map<string, Map<string, DailyEntry>>();
    for (const e of entriesQ.data ?? []) {
      const m = byHabit.get(e.habitId) ?? new Map<string, DailyEntry>();
      m.set(e.date, e);
      byHabit.set(e.habitId, m);
    }
    const segs: Array<Array<{ start: string; end: string }>> = [];
    const labels: string[] = [];
    for (const h of activeHabits) {
      const m = byHabit.get(h.id) ?? new Map<string, DailyEntry>();
      segs.push(computeStreakSegments(h, m, days));
      labels.push(h.title);
    }
    return { segs, labels, dates: days };
  }, [from, to, activeHabits, entriesQ.data]);

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
                if (v === "tags") {
                  setSelectedTags(allTags);
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
                <SelectItem value="tags">By tag(s)</SelectItem>
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
                      <SelectItem
                        key={h.id}
                        value={h.id}
                        className="line-clamp-2"
                      >
                        <span className="line-clamp-2">{h.title}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {habitMode === "many" && (
            <MultiSelect
              options={(habitsQ.data ?? [])
                .filter((h) => !h.archivedAt)
                .map((h) => ({ value: h.id, label: h.title }))}
              value={habitIds}
              onChange={(next) => setHabitIds(next)}
              placeholder="Select habits"
              renderTriggerLabel={(count) =>
                count === 0 ? "Select habits" : `${count} selected`
              }
            />
          )}

          {habitMode === "tags" && (
            <MultiSelect
              options={allTags.map((t) => ({ value: t, label: t }))}
              value={selectedTags}
              onChange={(next) => setSelectedTags(next)}
              placeholder="Select tags"
              renderTriggerLabel={(count) =>
                count === 0 ? "Select tags" : `${count} selected`
              }
            />
          )}

          {/* View selector */}
          <span className="opacity-70 text-sm">View</span>
          <div className="pixel-frame">
            <Select value={view} onValueChange={(v: ViewMode) => setView(v)}>
              <SelectTrigger className="w-full sm:w-48 bg-card">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                <SelectItem value="heatmap">Calendar heatmap</SelectItem>
                <SelectItem value="trend">Trend line</SelectItem>
                <SelectItem value="adherence">Adherence</SelectItem>
                <SelectItem value="streaks">Streak timeline</SelectItem>
                <SelectItem value="cadence">Cadence</SelectItem>
                <SelectItem value="weekday">Weekday heatmap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {view === "heatmap" && (
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
      )}

      {view === "trend" && (
        <div className="pixel-frame bg-card p-3">
          <LineChart
            width={960}
            height={240}
            series={
              [
                {
                  name: "Total",
                  color: "var(--secondary)",
                  points: totalScoreSeries,
                },
                { name: "MA7", color: "var(--chart-1)", points: ma7 },
                { name: "MA28", color: "var(--chart-2)", points: ma28 },
              ] as LineSeries[]
            }
            goalBands={[{ from: 80, to: 100, colorVar: "--chart-1" }]}
            onBrush={(fromX, toX) => {
              setPreset("custom");
              setCustomRange({ from: fromX, to: toX });
            }}
            compactXAxis={
              preset === "last-90-days" ||
              preset === "last-6-months" ||
              preset === "last-12-months"
            }
          />
        </div>
      )}

      {view === "cadence" && (
        <div className="pixel-frame bg-card p-3">
          <BarChart
            width={960}
            height={220}
            bars={weeklyBars}
            onBarClick={(range) => {
              setPreset("custom");
              setCustomRange(range);
            }}
          />
        </div>
      )}

      {view === "streaks" && (
        <div className="pixel-frame bg-card p-3">
          <StreakTimeline
            width={960}
            height={Math.max(140, streakRows.labels.length * 24)}
            rows={streakRows.labels.length}
            dates={streakRows.dates}
            segmentsByRow={streakRows.segs}
            labelForRow={(r) => streakRows.labels[r] ?? ""}
          />
        </div>
      )}

      {view === "weekday" && (
        <div className="pixel-frame bg-card p-3">
          {(() => {
            const days = enumKeys(from, to);
            const weeks = Array.from(groupByISOWeek(days).keys()).sort();
            const rowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            function valueAt(r: number, c: number): number {
              const weekStart = weeks[c];
              if (!weekStart) return 0;
              const weekDays = enumKeys(weekStart, endOfISOWeek(weekStart));
              const dk = weekDays[(r + 0) % 7];
              if (!dk) return 0;
              const { totalScore } = computeDaySummary(
                dk,
                activeHabits,
                entriesByDate.get(dk) ?? []
              );
              return totalScore;
            }
            return (
              <HeatmapMatrix
                width={960}
                height={220}
                rows={7}
                cols={weeks.length}
                valueAt={valueAt}
                labelForCol={(c) => (weeks[c] ?? "").slice(5)}
                labelForRow={(r) => rowLabels[r]}
              />
            );
          })()}
        </div>
      )}

      {view === "adherence" && (
        <div className="pixel-frame bg-card p-3">
          <LineChart
            width={960}
            height={240}
            series={adherenceSeries}
            goalBands={[{ from: 80, to: 100, colorVar: "--chart-1" }]}
            onBrush={(fromX, toX) => {
              setPreset("custom");
              setCustomRange({ from: fromX, to: toX });
            }}
            compactXAxis={
              preset === "last-90-days" ||
              preset === "last-6-months" ||
              preset === "last-12-months"
            }
          />
        </div>
      )}

      <div className="text-sm opacity-70">
        Scores are daily weighted completion (0–100).
      </div>
    </div>
  );
}
