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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeDaySummary } from "@/lib/score";
import type { DailyEntry } from "@/types/habit";
import LineChart, { type LineSeries } from "./components/LineChart";
import BarChart from "./components/BarChart";
import HeatmapMatrix from "./components/HeatmapMatrix";
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

type ViewMode = "trend" | "streaks" | "cadence" | "weekday";

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

          {/* View selector via Tabs */}
          <span className="opacity-70 text-sm">View</span>
          <Tabs
            value={view}
            onValueChange={(v: string) => setView(v as ViewMode)}
          >
            <div className="pixel-frame">
              <TabsList className="bg-card">
                <TabsTrigger value="trend">Trend</TabsTrigger>
                <TabsTrigger value="cadence">Cadence</TabsTrigger>
                <TabsTrigger value="weekday">Weekday</TabsTrigger>
                <TabsTrigger value="streaks">Streaks</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </header>

      {view === "trend" && (
        <div className="pixel-frame bg-card p-3">
          <Fullscreen
            affordance={({ open }) => <FullScreenButton onClick={open} />}
          >
            {({ close }) => (
              <PanZoom className="w-full h-full bg-background">
                <ResponsiveContainer
                  height={(vw) => Math.max(300, Math.floor(vw * 0.5))}
                >
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
            height={(w) => Math.max(180, Math.min(280, Math.floor(w * 0.4)))}
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
                <ResponsiveContainer
                  height={(vw) => Math.max(260, Math.floor(vw * 0.4))}
                >
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
                <ResponsiveContainer
                  height={() => Math.max(240, streakRows.labels.length * 32)}
                >
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
                <ResponsiveContainer
                  height={(vw) => Math.max(260, Math.floor(vw * 0.5))}
                >
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
