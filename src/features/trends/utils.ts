import type { DailyEntry, Habit } from "@/types/habit";

export function enumerateDateKeys(fromKey: string, toKey: string): string[] {
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

export function startOfISOWeek(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function endOfISOWeek(dateKey: string): string {
  const start = new Date(startOfISOWeek(dateKey) + "T00:00:00");
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

export function groupByISOWeek(dateKeys: string[]): Map<string, string[]> {
  const byWeek = new Map<string, string[]>();
  for (const dk of dateKeys) {
    const wk = startOfISOWeek(dk);
    const arr = byWeek.get(wk) ?? [];
    arr.push(dk);
    byWeek.set(wk, arr);
  }
  return byWeek;
}

export function rollingAverage(
  series: Array<{ x: string; y: number }>,
  windowSize: number
): Array<{ x: string; y: number }> {
  const out: Array<{ x: string; y: number }> = [];
  const queue: number[] = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    const v = series[i].y;
    queue.push(v);
    sum += v;
    if (queue.length > windowSize) sum -= queue.shift() ?? 0;
    const denom = Math.min(windowSize, queue.length);
    out.push({ x: series[i].x, y: denom > 0 ? sum / denom : 0 });
  }
  return out;
}

export function computeStreakSegments(
  _habit: Habit,
  entriesByDay: Map<string, DailyEntry>,
  orderedDates: string[]
): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  let runStart: string | null = null;
  for (const d of orderedDates) {
    const e = entriesByDay.get(d);
    const done = Boolean(e?.completed);
    if (done) {
      if (!runStart) runStart = d;
    } else {
      if (runStart) {
        const prev = new Date(d + "T00:00:00");
        prev.setDate(prev.getDate() - 1);
        out.push({ start: runStart, end: prev.toISOString().slice(0, 10) });
        runStart = null;
      }
    }
  }
  if (runStart)
    out.push({ start: runStart, end: orderedDates[orderedDates.length - 1] });
  return out;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function colorForValue(baseVar: string, pct: number): string {
  const p = Math.round(clamp01(pct) * 100);
  return `color-mix(in srgb, var(${baseVar}) ${p}%, var(--background))`;
}
