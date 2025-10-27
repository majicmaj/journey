import { useMemo, useState } from "react";
import { useEntriesRange, useHabits, useSettings } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
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
import { computeDaySummary } from "@/lib/score";
import type { DailyEntry } from "@/types/habit";
import LineChart, { type LineSeries } from "./components/LineChart";
import BarChart from "./components/BarChart";
import HeatmapMatrix from "./components/HeatmapMatrix";
import ClockHeatmap from "./components/ClockHeatmap";
import TimeBlocks, { type TimeBlock } from "./components/TimeBlocks";
import StackedBarChart, {
  type StackedPoint,
} from "./components/StackedBarChart";
import StreakTimeline from "./components/StreakTimeline";
import ResponsiveContainer from "./components/ResponsiveContainer";
import PanZoom from "./components/PanZoom";
import Fullscreen, { FullScreenButton } from "./components/Fullscreen";
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
  | "last-7-days"
  | "last-24-hours"
  | "last-90-days"
  | "last-30-days"
  | "all-time"
  | "custom";

type HabitFilterMode = "all" | "one" | "many" | "tags";

function calcRange(
  preset: Exclude<RangePreset, "custom" | "all-time">,
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
    case "last-7-days": {
      d.setDate(d.getDate() - 7);
      return { from: toDayKey(d, dayStart), to };
    }
    case "last-24-hours": {
      d.setDate(d.getDate() - 1);
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
  | "trend"
  | "streaks"
  | "cadence"
  | "weekday"
  | "quantities"
  | "blocks"
  | "hours";

type QuantityScope = "per-habit" | "aggregated";
type BlocksLayout = "by-day" | "by-habit";

export default function Trends() {
  const settings = useSettings();
  const dayStart = settings.data?.dayStart ?? "00:00";
  const habitsQ = useHabits();
  const [preset, setPreset] = useState<RangePreset>("all-time");
  const [customRange, setCustomRange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Earliest entry date for "all-time" preset
  const earliestQ = useQuery({
    queryKey: ["entries-first-date"],
    queryFn: async () => {
      const first = await db.entries.orderBy("date").first();
      return first?.date as string | undefined;
    },
  });
  const earliestDate = earliestQ.data;

  const computed = useMemo(() => {
    if (preset === "custom") {
      return customRange ?? calcRange("last-90-days", dayStart);
    }
    if (preset === "all-time") {
      const today = toDayKey(new Date(), dayStart);
      const from = earliestDate ?? today;
      return { from, to: today };
    }
    return calcRange(
      preset as Exclude<RangePreset, "custom" | "all-time">,
      dayStart
    );
  }, [preset, customRange, dayStart, earliestDate]);

  const from = computed.from;
  const to = computed.to;

  // Habit filtering state
  const [habitMode, setHabitMode] = useState<HabitFilterMode>("all");
  const [habitId, setHabitId] = useState<string | null>(null);
  const [habitIds, setHabitIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Local view-specific toggles
  const [quantityScope, setQuantityScope] =
    useState<QuantityScope>("per-habit");
  const [blocksLayout, setBlocksLayout] = useState<BlocksLayout>("by-day");
  const [quantityChartType, setQuantityChartType] = useState<
    "line" | "stacked"
  >("line");
  const [hourView, setHourView] = useState<"flat" | "clock">("flat");

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

  // selectedCount no longer needed; MultiSelect renders its own label

  // New view selection
  const [view, setView] = useState<ViewMode>("weekday");

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

  // Determine if X axis should be compact based on range length and device
  const trendCompact = useMemo(() => {
    const days = enumKeys(from, to);
    const threshold =
      typeof window !== "undefined" && window.innerWidth <= 640 ? 30 : 90;
    return days.length >= threshold;
  }, [from, to]);

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

  // Adherence view removed

  // Weekly cadence bars
  const weeklyBars = useMemo(() => {
    const days = enumKeys(from, to);
    const byWeek = groupByISOWeek(days);
    const threshold =
      typeof window !== "undefined" && window.innerWidth <= 640 ? 30 : 90;
    const compact = days.length >= threshold;
    function weekMonthAbbr(weekStartStr: string): string | null {
      const ws = new Date(weekStartStr + "T00:00:00");
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws.getTime() + i * 24 * 60 * 60 * 1000);
        if (d.getDate() === 1) {
          const mm = d.getMonth();
          return [
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
          ][mm];
        }
      }
      return null;
    }
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
        label: compact ? weekMonthAbbr(weekStart) ?? "" : weekStart.slice(5),
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

  // ---------- Quantities (per-day) ----------
  const dateKeys = useMemo(() => enumKeys(from, to), [from, to]);
  const entriesByHabitByDate = useMemo(() => {
    const map = new Map<string, Map<string, DailyEntry>>(); // habitId -> (date -> entry)
    for (const e of entriesQ.data ?? []) {
      const byDate = map.get(e.habitId) ?? new Map<string, DailyEntry>();
      byDate.set(e.date, e);
      map.set(e.habitId, byDate);
    }
    return map;
  }, [entriesQ.data]);

  function habitColorAt(index: number, fallback?: string): string {
    const varIdx = (index % 5) + 1;
    return fallback ?? `var(--chart-${varIdx})`;
  }

  const quantityOverlaySeries: LineSeries[] = useMemo(() => {
    const series: LineSeries[] = [];
    activeHabits.forEach((h, i) => {
      const byDate = entriesByHabitByDate.get(h.id) ?? new Map();
      const pts = dateKeys.map((dk) => {
        const q = byDate.get(dk)?.quantity;
        return { x: dk, y: Number.isFinite(q as number) ? (q as number) : 0 };
      });
      series.push({
        name: h.title,
        color: habitColorAt(i, h.color),
        points: pts,
      });
    });
    return series;
  }, [activeHabits, entriesByHabitByDate, dateKeys]);

  const quantityAggregatedSeries: LineSeries[] = useMemo(() => {
    const pts = dateKeys.map((dk) => {
      let sum = 0;
      for (let i = 0; i < activeHabits.length; i++) {
        const h = activeHabits[i];
        const q = entriesByHabitByDate.get(h.id)?.get(dk)?.quantity ?? 0;
        if (Number.isFinite(q)) sum += q as number;
      }
      return { x: dk, y: sum };
    });
    return [
      {
        name: "Sum",
        color: "var(--secondary)",
        points: pts,
      },
    ];
  }, [activeHabits, entriesByHabitByDate, dateKeys]);

  const quantityStacked: StackedPoint[] = useMemo(() => {
    return dateKeys.map((dk) => {
      const segments = activeHabits.map((h, i) => {
        const q = entriesByHabitByDate.get(h.id)?.get(dk)?.quantity ?? 0;
        return {
          key: h.id,
          value: Number.isFinite(q) ? (q as number) : 0,
          color: habitColorAt(i, h.color),
        };
      });
      return { x: dk, segments };
    });
  }, [dateKeys, activeHabits, entriesByHabitByDate]);

  // ---------- Time blocks ----------
  const blocksByDay: {
    rows: number;
    blocks: TimeBlock[];
    rowLabelAt: (r: number) => string;
  } = useMemo(() => {
    const rows = dateKeys.length;
    const blocks: TimeBlock[] = [];
    // For each day row, add blocks for ALL selected habits that have start/end
    dateKeys.forEach((dk, r) => {
      for (let i = 0; i < activeHabits.length; i++) {
        const h = activeHabits[i];
        const e = entriesByHabitByDate.get(h.id)?.get(dk);
        const s =
          typeof e?.startMinutes === "number"
            ? (e!.startMinutes as number)
            : null;
        const t =
          typeof e?.endMinutes === "number" ? (e!.endMinutes as number) : null;
        if (s != null && t != null && t > s) {
          blocks.push({
            row: r,
            fromMin: s,
            toMin: t,
            color: h.color ?? habitColorAt(i),
            label: `${dk} • ${h.title}`,
          });
        }
      }
    });
    return { rows, blocks, rowLabelAt: (r) => dateKeys[r] ?? "" };
  }, [dateKeys, activeHabits, entriesByHabitByDate]);

  function median(nums: number[]): number | null {
    if (nums.length === 0) return null;
    const a = [...nums].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    if (a.length % 2 === 0) return (a[m - 1] + a[m]) / 2;
    return a[m];
  }

  const blocksByHabit: {
    rows: number;
    blocks: TimeBlock[];
    rowLabelAt: (r: number) => string;
  } = useMemo(() => {
    const rows = activeHabits.length;
    const blocks: TimeBlock[] = [];
    activeHabits.forEach((h, r) => {
      const entries = entriesQ.data?.filter((e) => e.habitId === h.id) ?? [];
      const starts: number[] = [];
      const ends: number[] = [];
      for (const e of entries) {
        const s = typeof e.startMinutes === "number" ? e.startMinutes : null;
        const t = typeof e.endMinutes === "number" ? e.endMinutes : null;
        if (s != null && t != null && t > s) {
          starts.push(s);
          ends.push(t);
        }
      }
      const ms = median(starts);
      const me = median(ends);
      if (ms != null && me != null && me > ms) {
        blocks.push({
          row: r,
          fromMin: ms,
          toMin: me,
          color: h.color ?? habitColorAt(r),
          label: h.title,
        });
      }
    });
    return { rows, blocks, rowLabelAt: (r) => activeHabits[r]?.title ?? "" };
  }, [activeHabits, entriesQ.data]);

  const blocksResolved =
    blocksLayout === "by-day" ? blocksByDay : blocksByHabit;

  // ---------- Hourly heat (24 columns) ----------
  const hourlyBinsPct: number[] = useMemo(() => {
    const minsPerHour = new Array(24).fill(0) as number[];
    const dayCount = Math.max(1, dateKeys.length);
    // Aggregate minutes overlapped in each hour across selected habits
    for (const e of entriesQ.data ?? []) {
      if (!activeHabits.find((h) => h.id === e.habitId)) continue;
      const s = typeof e.startMinutes === "number" ? e.startMinutes : null;
      const t = typeof e.endMinutes === "number" ? e.endMinutes : null;
      if (s == null || t == null || t <= s) continue;
      const startH = Math.max(0, Math.floor(s / 60));
      const endH = Math.min(23, Math.floor((t - 1) / 60));
      for (let h = startH; h <= endH; h++) {
        const hStart = h * 60;
        const hEnd = hStart + 60;
        const overlap = Math.max(0, Math.min(t, hEnd) - Math.max(s, hStart));
        if (overlap > 0) minsPerHour[h] += overlap;
      }
    }
    // Average per day, then scale 0..100 with 60 minutes → 100
    return minsPerHour.map((m) =>
      Math.max(0, Math.min(100, (m / dayCount / 60) * 100))
    );
  }, [entriesQ.data, activeHabits, dateKeys.length]);

  return (
    <div className="p-3 flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="grid w-full sm:flex gap-3 items-center flex-wrap">
          <span className="opacity-70 text-sm">View</span>
          <div className="pixel-frame">
            <Select value={view} onValueChange={(v: ViewMode) => setView(v)}>
              <SelectTrigger className="w-full sm:w-48 bg-card">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="pixel-frame">
                <SelectItem value="trend">Trend</SelectItem>
                <SelectItem value="cadence">Cadence</SelectItem>
                <SelectItem value="weekday">Weekday</SelectItem>
                <SelectItem value="streaks">Streaks</SelectItem>
                <SelectItem value="quantities">Quantities</SelectItem>
                <SelectItem value="blocks">Time blocks</SelectItem>
                <SelectItem value="hours">Hourly</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                <SelectItem value="last-24-hours">Last 24 hours</SelectItem>
                <SelectItem value="last-7-days">Last 7 days</SelectItem>
                <SelectItem value="last-30-days">Last 30 days</SelectItem>
                <SelectItem value="last-90-days">Last 90 days</SelectItem>
                <SelectItem value="last-6-months">Last 6 months</SelectItem>
                <SelectItem value="last-12-months">Last 12 months</SelectItem>
                <SelectItem value="all-time">All time</SelectItem>
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
        </div>
      </header>

      {/* Quantities view */}
      {view === "quantities" && (
        <div className="pixel-frame bg-card p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="opacity-70 text-sm">Scope</span>
            <div className="pixel-frame">
              <Select
                value={quantityScope}
                onValueChange={(v: QuantityScope) => setQuantityScope(v)}
              >
                <SelectTrigger className="w-[160px] bg-card">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="per-habit">Per habit (overlay)</SelectItem>
                  <SelectItem value="aggregated">Aggregated sum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="opacity-70 text-sm">Type</span>
            <div className="pixel-frame">
              <Select
                value={quantityChartType}
                onValueChange={(v: "line" | "stacked") =>
                  setQuantityChartType(v)
                }
              >
                <SelectTrigger className="w-[160px] bg-card">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="stacked">Stacked bars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {quantityChartType === "line" ? (
            <>
              <Fullscreen
                affordance={({ open }) => <FullScreenButton onClick={open} />}
              >
                {({ close }) => (
                  <PanZoom className="w-full h-full bg-background">
                    <ResponsiveContainer height="fill" className="h-full">
                      {(vw, vh) => (
                        <LineChart
                          width={vw}
                          height={vh}
                          series={
                            quantityScope === "aggregated"
                              ? quantityAggregatedSeries
                              : quantityOverlaySeries
                          }
                          compactXAxis={true}
                          yDomain={{
                            min: 0,
                            max: Math.max(
                              1,
                              ...((quantityScope === "aggregated"
                                ? quantityAggregatedSeries
                                : quantityOverlaySeries)[0]?.points.map(
                                (p) => p.y
                              ) ?? [0])
                            ),
                          }}
                          yTicks={(() => {
                            const maxY = Math.max(
                              1,
                              ...((quantityScope === "aggregated"
                                ? quantityAggregatedSeries
                                : quantityOverlaySeries)[0]?.points.map(
                                (p) => p.y
                              ) ?? [0])
                            );
                            const step = Math.max(1, Math.ceil(maxY / 4));
                            return Array.from(
                              { length: 5 },
                              (_, i) => i * step
                            );
                          })()}
                        />
                      )}
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
                )}
              </Fullscreen>

              <ResponsiveContainer
                height={(w) => Math.max(260, Math.floor(w * 0.4))}
              >
                {(vw, vh) => (
                  <LineChart
                    width={vw}
                    height={vh}
                    series={
                      quantityScope === "aggregated"
                        ? quantityAggregatedSeries
                        : quantityOverlaySeries
                    }
                    compactXAxis={true}
                    yDomain={{
                      min: 0,
                      max: Math.max(
                        1,
                        ...((quantityScope === "aggregated"
                          ? quantityAggregatedSeries
                          : quantityOverlaySeries)[0]?.points.map(
                          (p) => p.y
                        ) ?? [0])
                      ),
                    }}
                    yTicks={(() => {
                      const maxY = Math.max(
                        1,
                        ...((quantityScope === "aggregated"
                          ? quantityAggregatedSeries
                          : quantityOverlaySeries)[0]?.points.map(
                          (p) => p.y
                        ) ?? [0])
                      );
                      const step = Math.max(1, Math.ceil(maxY / 4));
                      return Array.from({ length: 5 }, (_, i) => i * step);
                    })()}
                  />
                )}
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <Fullscreen
                affordance={({ open }) => <FullScreenButton onClick={open} />}
              >
                {({ close }) => (
                  <PanZoom className="w-full h-full bg-background">
                    <ResponsiveContainer height="fill" className="h-full">
                      {(vw, vh) => (
                        <StackedBarChart
                          width={vw}
                          height={vh}
                          data={quantityStacked}
                        />
                      )}
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
                )}
              </Fullscreen>

              <ResponsiveContainer
                height={(w) => Math.max(200, Math.floor(w * 0.3))}
              >
                {(vw, vh) => (
                  <StackedBarChart
                    width={vw}
                    height={vh}
                    data={quantityStacked}
                  />
                )}
              </ResponsiveContainer>
            </>
          )}

          {/* <div className="mt-4">
            <Fullscreen
              affordance={({ open }) => <FullScreenButton onClick={open} />}
            >
              {({ close }) => (
                <PanZoom className="w-full h-full bg-background">
                  <ResponsiveContainer height="fill" className="h-full">
                    {(vw, vh) => (
                      <StackedBarChart
                        width={vw}
                        height={vh}
                        data={quantityStacked}
                      />
                    )}
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
              )}
            </Fullscreen>

            <ResponsiveContainer
              height={(w) => Math.max(200, Math.floor(w * 0.3))}
            >
              {(vw, vh) => (
                <StackedBarChart
                  width={vw}
                  height={vh}
                  data={quantityStacked}
                />
              )}
            </ResponsiveContainer>
          </div> */}
        </div>
      )}

      {/* Time blocks view */}
      {view === "blocks" && (
        <div className="pixel-frame bg-card p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="opacity-70 text-sm">Layout</span>
            <div className="pixel-frame">
              <Select
                value={blocksLayout}
                onValueChange={(v: BlocksLayout) => setBlocksLayout(v)}
              >
                <SelectTrigger className="w-[160px] bg-card">
                  <SelectValue placeholder="Layout" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="by-day">By day</SelectItem>
                  <SelectItem value="by-habit">
                    By habit (median block)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer height="fill" className="h-full">
                  {(vw, vh) => (
                    <TimeBlocks
                      width={vw}
                      height={vh}
                      rows={blocksResolved.rows}
                      rowLabelAt={blocksResolved.rowLabelAt}
                      blocks={blocksResolved.blocks}
                    />
                  )}
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
            )}
          </Fullscreen>

          <ResponsiveContainer
            height={() => Math.max(220, blocksResolved.rows * 28)}
          >
            {(vw, vh) => (
              <TimeBlocks
                width={vw}
                height={vh}
                rows={blocksResolved.rows}
                rowLabelAt={blocksResolved.rowLabelAt}
                blocks={blocksResolved.blocks}
              />
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Hourly heat view */}
      {view === "hours" && (
        <div className="pixel-frame bg-card p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="opacity-70 text-sm">Display</span>
            <div className="pixel-frame">
              <Select
                value={hourView}
                onValueChange={(v: "flat" | "clock") => setHourView(v)}
              >
                <SelectTrigger className="w-[160px] bg-card">
                  <SelectValue placeholder="Display" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="flat">Flat heatmap</SelectItem>
                  <SelectItem value="clock">Clock heatmap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hourView === "flat" ? (
            <>
              <Fullscreen
                affordance={({ open }) => <FullScreenButton onClick={open} />}
              >
                {({ close }) => (
                  <PanZoom className="w-full h-full bg-background">
                    <ResponsiveContainer height="fill" className="h-full">
                      {(vw, vh) => (
                        <HeatmapMatrix
                          width={vw}
                          height={vh}
                          rows={1}
                          cols={24}
                          valueAt={(_r, c) => hourlyBinsPct[c] ?? 0}
                          labelForCol={(c) => String(c).padStart(2, "0")}
                          labelForRow={() => "Avg/min"}
                          showWeekBands={false}
                        />
                      )}
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
                )}
              </Fullscreen>

              <ResponsiveContainer
                height={(w) => Math.max(160, Math.floor(w * 0.25))}
              >
                {(vw, vh) => (
                  <HeatmapMatrix
                    width={vw}
                    height={vh}
                    rows={1}
                    cols={24}
                    valueAt={(_r, c) => hourlyBinsPct[c] ?? 0}
                    labelForCol={(c) => String(c).padStart(2, "0")}
                    labelForRow={() => "Avg/min"}
                    showWeekBands={false}
                  />
                )}
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <Fullscreen
                affordance={({ open }) => <FullScreenButton onClick={open} />}
              >
                {({ close }) => (
                  <PanZoom className="w-full h-full bg-background">
                    <ResponsiveContainer height="fill" className="h-full">
                      {(vw, vh) => (
                        <ClockHeatmap
                          width={vw}
                          height={vh}
                          values={hourlyBinsPct}
                        />
                      )}
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
                )}
              </Fullscreen>

              <ResponsiveContainer
                height={(w) => Math.max(220, Math.floor(w * 0.5))}
              >
                {(vw, vh) => (
                  <ClockHeatmap width={vw} height={vh} values={hourlyBinsPct} />
                )}
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {view === "trend" && (
        <div className="pixel-frame bg-card p-3">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer height="fill" className="h-full">
                  {(vw, vh) => (
                    <LineChart
                      width={vw}
                      height={vh}
                      series={[
                        {
                          name: "Total",
                          color: "var(--secondary)",
                          points: totalScoreSeries,
                        },
                        { name: "MA7", color: "var(--chart-1)", points: ma7 },
                        { name: "MA28", color: "var(--chart-2)", points: ma28 },
                      ]}
                      goalBands={[{ from: 80, to: 100, colorVar: "--chart-1" }]}
                      compactXAxis={trendCompact}
                    />
                  )}
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
            )}
          </Fullscreen>
          <ResponsiveContainer
            height={(w) => Math.max(300, Math.min(280, Math.floor(w * 0.4)))}
          >
            {(w, h) => (
              <LineChart
                width={w}
                height={h}
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
                compactXAxis={trendCompact}
              />
            )}
          </ResponsiveContainer>
        </div>
      )}

      {view === "cadence" && (
        <div className="pixel-frame bg-card p-3">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer height="fill" className="h-full">
                  {(vw, vh) => (
                    <BarChart width={vw} height={vh} bars={weeklyBars} />
                  )}
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
            )}
          </Fullscreen>
          <ResponsiveContainer
            height={(w) => Math.max(160, Math.min(260, Math.floor(w * 0.35)))}
          >
            {(w, h) => (
              <BarChart
                width={w}
                height={h}
                bars={weeklyBars}
                onBarClick={(range) => {
                  setPreset("custom");
                  setCustomRange(range);
                }}
              />
            )}
          </ResponsiveContainer>
        </div>
      )}

      {view === "streaks" && (
        <div className="pixel-frame bg-card p-3">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer height="fill" className="h-full">
                  {(vw, vh) => (
                    <StreakTimeline
                      width={vw}
                      height={vh}
                      rows={streakRows.labels.length}
                      dates={streakRows.dates}
                      segmentsByRow={streakRows.segs}
                      labelForRow={(r) => streakRows.labels[r] ?? ""}
                    />
                  )}
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
            )}
          </Fullscreen>
          <ResponsiveContainer
            height={() => Math.max(160, streakRows.labels.length * 28)}
          >
            {(w, h) => (
              <StreakTimeline
                width={w}
                height={h}
                rows={streakRows.labels.length}
                dates={streakRows.dates}
                segmentsByRow={streakRows.segs}
                labelForRow={(r) => streakRows.labels[r] ?? ""}
              />
            )}
          </ResponsiveContainer>
        </div>
      )}

      {view === "weekday" && (
        <div className="pixel-frame bg-card p-3">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer height="fill" className="h-full">
                  {(vw, vh) => {
                    const days = enumKeys(from, to);
                    const weeks = Array.from(
                      groupByISOWeek(days).keys()
                    ).sort();
                    const rowLabels = [
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                      "Sun",
                    ];
                    const threshold =
                      typeof window !== "undefined" && window.innerWidth <= 640
                        ? 30
                        : 90;
                    const compact = days.length >= threshold;
                    function weekMonthAbbr(
                      weekStartStr: string
                    ): string | null {
                      const ws = new Date(weekStartStr + "T00:00:00");
                      for (let i = 0; i < 7; i++) {
                        const d = new Date(
                          ws.getTime() + i * 24 * 60 * 60 * 1000
                        );
                        if (d.getDate() === 1) {
                          const mm = d.getMonth();
                          return [
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
                          ][mm];
                        }
                      }
                      return null;
                    }
                    function valueAt(r: number, c: number): number {
                      const weekStart = weeks[c];
                      if (!weekStart) return 0;
                      const weekDays = enumKeys(
                        weekStart,
                        endOfISOWeek(weekStart)
                      );
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
                        width={vw}
                        height={vh}
                        rows={7}
                        cols={weeks.length}
                        valueAt={valueAt}
                        labelForCol={(c) =>
                          compact
                            ? weekMonthAbbr(weeks[c] ?? "") ?? ""
                            : (weeks[c] ?? "").slice(5)
                        }
                        labelForRow={(r) => rowLabels[r]}
                      />
                    );
                  }}
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
            )}
          </Fullscreen>
          <ResponsiveContainer
            height={(w) => Math.max(180, Math.min(260, Math.floor(w * 0.35)))}
          >
            {(w, h) => {
              const days = enumKeys(from, to);
              const weeks = Array.from(groupByISOWeek(days).keys()).sort();
              const rowLabels = [
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
                "Sun",
              ];
              const threshold =
                typeof window !== "undefined" && window.innerWidth <= 640
                  ? 30
                  : 90;
              const compact = days.length >= threshold;
              function weekMonthAbbr(weekStartStr: string): string | null {
                const ws = new Date(weekStartStr + "T00:00:00");
                for (let i = 0; i < 7; i++) {
                  const d = new Date(ws.getTime() + i * 24 * 60 * 60 * 1000);
                  if (d.getDate() === 1) {
                    const mm = d.getMonth();
                    return [
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
                    ][mm];
                  }
                }
                return null;
              }
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
                  width={w}
                  height={h}
                  rows={7}
                  cols={weeks.length}
                  valueAt={valueAt}
                  labelForCol={(c) =>
                    compact
                      ? weekMonthAbbr(weeks[c] ?? "") ?? ""
                      : (weeks[c] ?? "").slice(5)
                  }
                  labelForRow={(r) => rowLabels[r]}
                />
              );
            }}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
